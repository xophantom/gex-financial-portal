import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AppException } from '../common/http-exception.filter';
import { resolveJwtRefreshSecret } from './jwt-secrets';

const MAX_ATTEMPTS_PER_EMAIL = 10;
const EMAIL_WINDOW_SECONDS = 300;
// Mais alto que o limite por e-mail de propósito: o limite por e-mail já
// barra força bruta contra UMA conta; este existe para o caso que ele não
// cobre — um IP tentando muitas contas diferentes, poucas vezes cada uma.
const MAX_ATTEMPTS_PER_IP = 30;
const IP_WINDOW_SECONDS = 300;

// Hash argon2id fixo, gerado uma única vez (não a cada request) com os
// mesmos parâmetros usados para hashear senha de verdade — existe só para
// argon2.verify pagar o mesmo custo de CPU que pagaria contra o hash de um
// usuário real, quando o e-mail não existe. A senha que o gerou não importa
// e nunca é comparada com nada: o resultado do verify contra este hash é
// sempre descartado (nunca vira `valid = true`). Sem isto, a resposta para
// "e-mail inexistente" volta imediatamente, e a resposta para "e-mail existe,
// senha errada" só volta depois do argon2.verify de verdade — medido contra
// o binário real: 3.6ms vs 43.5ms, uma oracle de enumeração de contas pelo
// tempo de resposta, mesmo com corpos de resposta idênticos.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$NZgu8zFbSVZkqFpSgF0NmA$Is1czcXXrf+qFEl+t5LRNtEALabV2KLfgdtbg6nomzc';

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

  async login(email: string, password: string, ip: string) {
    // A chave de rate limit é normalizada para minúsculas (e-mails com
    // capitalização diferente não devem escapar do contador), mas a consulta
    // ao banco abaixo usa o e-mail exatamente como recebido: a coluna não é
    // citext e a comparação do Postgres é case-sensitive, então normalizar
    // ali mudaria o comportamento de login (um e-mail com capitalização
    // diferente do que está salvo passaria a encontrar o usuário quando hoje
    // não encontra) — uma mudança de comportamento que este fix não pediu e
    // que merece sua própria decisão, não um efeito colateral do rate limit.
    const emailKey = `login:email:${email.toLowerCase()}`;
    const ipKey = `login:ip:${ip}`;

    const [emailAttempts, ipAttempts] = await Promise.all([
      this.redis.incrWithTtl(emailKey, EMAIL_WINDOW_SECONDS),
      this.redis.incrWithTtl(ipKey, IP_WINDOW_SECONDS),
    ]);

    if (
      emailAttempts > MAX_ATTEMPTS_PER_EMAIL ||
      ipAttempts > MAX_ATTEMPTS_PER_IP
    ) {
      throw new AppException(
        'TOO_MANY_REQUESTS',
        'Muitas tentativas. Tente novamente em instantes.',
        429,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email } });

    let valid: boolean;
    if (user) {
      valid = await argon2.verify(user.passwordHash, password);
    } else {
      await argon2.verify(DUMMY_PASSWORD_HASH, password);
      valid = false;
    }

    // Mesma mensagem e mesmo status para e-mail inexistente e senha errada:
    // distinguir os dois transforma a tela de login em verificador de contas.
    if (!user || !valid) {
      throw new AppException(
        'UNAUTHENTICATED',
        'E-mail ou senha inválidos',
        401,
      );
    }

    // Só a chave por e-mail é resetada: um login legítimo não deve custar
    // tentativas futuras deste usuário, mas resetar o contador por IP a cada
    // sucesso abriria uma brecha — um atacante fazendo credential stuffing
    // contra várias contas poderia logar de vez em quando na própria conta
    // só para zerar o limite compartilhado e continuar testando as outras.
    await this.redis.del(emailKey);

    return this.issue(user);
  }

  async refresh(refreshToken: string) {
    const payload = await this.jwt
      .verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.refreshSecret,
        algorithms: ['HS256'],
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
