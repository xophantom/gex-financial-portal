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

  // JwtGuard agora é global (APP_GUARD): toda rota é protegida por padrão.
  // @Public() é a única saída deliberada — sem checá-la aqui, POST
  // /auth/login e /auth/refresh ficariam presos atrás da própria
  // autenticação que eles existem para conceder.
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) return true

    return super.canActivate(context)
  }

  // O AuthGuard padrão do passport lança um erro genérico em inglês
  // ("Unauthorized"); sobrescrever handleRequest garante o código explícito
  // (UNAUTHENTICATED) e a mensagem em português exigidos pelo projeto, tanto
  // para token ausente quanto malformado, expirado ou de um usuário apagado.
  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw new AppException('UNAUTHENTICATED', 'Não autenticado', 401)
    }

    return user
  }
}
