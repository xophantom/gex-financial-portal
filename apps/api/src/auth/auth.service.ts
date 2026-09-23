import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AppException } from '../common/http-exception.filter';
import { resolveJwtRefreshSecret } from './jwt-secrets';

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 300;

@Injectable()
export class AuthService {
  // Campo, não leitura inline em cada método: resolveJwtRefreshSecret() lança
  // se a env var não estiver setada, e um campo roda na construção do
  // provider (mesmo momento em que JwtStrategy valida JWT_SECRET) — falha no
  // boot, não silenciosamente na primeira chamada a login()/refresh(). Também
  // evita passar `secret: undefined` para signAsync/verifyAsync: o
  // @nestjs/jwt cai de volta para o secret padrão do módulo (JWT_SECRET)
  // nesse caso, o que colapsaria access e refresh token na mesma chave.
  private readonly refreshSecret = resolveJwtRefreshSecret();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  async login(email: string, password: string) {
    const attempts = await this.redis.incrWithTtl(
      `login:${email}`,
      WINDOW_SECONDS,
    );

    if (attempts > MAX_ATTEMPTS) {
      throw new AppException(
        'TOO_MANY_REQUESTS',
        'Muitas tentativas. Tente novamente em instantes.',
        429,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = user
      ? await argon2.verify(user.passwordHash, password)
      : false;

    // Mesma mensagem e mesmo status para e-mail inexistente e senha errada:
    // distinguir os dois transforma a tela de login em verificador de contas.
    if (!user || !valid) {
      throw new AppException(
        'UNAUTHENTICATED',
        'E-mail ou senha inválidos',
        401,
      );
    }

    return this.issue(user);
  }

  async refresh(refreshToken: string) {
    const payload = await this.jwt
      .verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.refreshSecret,
      })
      .catch(() => {
        throw new AppException('UNAUTHENTICATED', 'Sessão expirada', 401);
      });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user)
      throw new AppException('UNAUTHENTICATED', 'Sessão expirada', 401);

    return this.issue(user);
  }

  private async issue(user: {
    id: string;
    name: string;
    email: string;
    role: string;
  }) {
    const claims = { sub: user.id, role: user.role };

    return {
      access_token: await this.jwt.signAsync(claims, { expiresIn: '15m' }),
      refresh_token: await this.jwt.signAsync(claims, {
        expiresIn: '7d',
        secret: this.refreshSecret,
      }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
