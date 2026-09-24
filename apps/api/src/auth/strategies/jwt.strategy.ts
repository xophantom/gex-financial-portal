import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { UserRole } from '@gex/shared'
import { PrismaService } from '../../infra/prisma/prisma.service'
import type { AuthenticatedUser } from '../authenticated-user'
import { resolveJwtSecret } from '../jwt-secrets'

interface JwtPayload {
  sub: string
  role: UserRole
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: resolveJwtSecret(),
      // Algoritmo fixo, em vez do que o jsonwebtoken infere do tipo do
      // segredo: trocar o segredo por uma chave não amplia o que é aceito.
      algorithms: ['HS256'],
    })
  }

  // null em vez de lançar: JwtGuard.handleRequest trata usuário removido como
  // qualquer outro token inválido, com o mesmo 401.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    })
    if (!user) return null

    return { id: user.id, role: user.role, name: user.name, email: user.email }
  }
}
