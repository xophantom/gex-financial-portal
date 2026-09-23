import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): unknown => {
    const request: { user: unknown } = context.switchToHttp().getRequest();
    return request.user;
  },
);
