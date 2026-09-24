import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@gex/shared';
import { AppException } from '../../common/errors/app.exception';
import type { AuthenticatedUser } from '../authenticated-user';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request: { user?: AuthenticatedUser } = context
      .switchToHttp()
      .getRequest();
    const { user } = request;

    if (!user || !required.includes(user.role)) {
      throw new AppException(
        'FORBIDDEN',
        'Seu perfil não permite esta ação',
        403,
      );
    }

    return true;
  }
}
