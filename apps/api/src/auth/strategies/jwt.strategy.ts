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
      // Hoje só é seguro por acidente: um secretOrKey do tipo string faz o
      // jsonwebtoken inferir só algoritmos HS*. Declarar explicitamente
      // impede essa proteção implícita de regredir silenciosamente se o
      // secret um dia virar um objeto/chave assimétrica.
      algorithms: ['HS256'],
    })
  }

  // Retornar null (em vez de lançar) deixa o AuthGuard tratar "sem usuário"
  // e "token inválido" pelo mesmo caminho, em handleRequest — um único lugar
  // decide o formato do erro 401, em vez de duas rotas divergentes.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    })
    if (!user) return null

    return { id: user.id, role: user.role, name: user.name, email: user.email }
  }
}
