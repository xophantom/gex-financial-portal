import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  role: string;
}

export interface AuthenticatedUser {
  id: string;
  role: string;
  name: string;
  email: string;
}

// Mesmo padrão de fallback do RedisService (REDIS_URL) e do ClockService
// (APP_TIMEZONE): um valor de desenvolvimento documentado em .env.example,
// não um segredo de produção — em produção a env var real sempre sobrepõe.
// Função, não constante de módulo: precisa ler process.env no momento em
// que o Nest instancia o provider (compile()/create()), não em quando este
// arquivo é importado — testes só definem a env var depois de subir os
// containers descartáveis, e o import de AppModule acontece antes disso.
export function resolveJwtSecret(): string {
  return process.env.JWT_SECRET ?? 'challenge_only_change_me';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: resolveJwtSecret(),
    });
  }

  // Retornar null (em vez de lançar) deixa o AuthGuard tratar "sem usuário"
  // e "token inválido" pelo mesmo caminho, em handleRequest — um único lugar
  // decide o formato do erro 401, em vez de duas rotas divergentes.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) return null;

    return { id: user.id, role: user.role, name: user.name, email: user.email };
  }
}
