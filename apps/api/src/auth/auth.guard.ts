import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';

export const Public = () => SetMetadata('publicRoute', true);
export type AuthenticatedRequest = Awaited<ReturnType<AuthService['authenticate']>>;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('publicRoute', [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest();
    Object.assign(request, await this.auth.authenticate(request.headers.authorization));
    return true;
  }
}
