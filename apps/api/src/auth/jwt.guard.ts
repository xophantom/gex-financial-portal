import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppException } from '../common/http-exception.filter';
import type { AuthenticatedUser } from './jwt.strategy';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  // O AuthGuard padrão do passport lança um erro genérico em inglês
  // ("Unauthorized"); sobrescrever handleRequest garante o código explícito
  // (UNAUTHENTICATED) e a mensagem em português exigidos pelo projeto, tanto
  // para token ausente quanto malformado, expirado ou de um usuário apagado.
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false,
  ): TUser {
    if (err || !user) {
      throw new AppException('UNAUTHENTICATED', 'Não autenticado', 401);
    }

    return user;
  }
}
