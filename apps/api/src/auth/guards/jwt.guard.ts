import { ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { AppException } from '../../common/errors/app.exception'
import type { AuthenticatedUser } from '../authenticated-user'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  // Global (APP_GUARD): toda rota exige token, exceto as marcadas com
  // @Public(), como login e refresh, que existem para emiti-lo.
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) return true

    return super.canActivate(context)
  }

  // Um único 401 (UNAUTHENTICATED, em português) para token ausente,
  // malformado, expirado ou de usuário removido, no lugar do "Unauthorized"
  // genérico do passport.
  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw new AppException('UNAUTHENTICATED', 'Não autenticado', 401)
    }

    return user
  }
}
