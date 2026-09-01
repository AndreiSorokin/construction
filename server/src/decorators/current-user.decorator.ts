import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser { id: string; role: string; name: string; orgId: string; }

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | string => {
    const req = ctx.switchToHttp().getRequest();
    return data ? req.user?.[data] : req.user;
  },
);
