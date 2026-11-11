import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { parseOperatorId } from '../raffles/domain';
import { AuthService, Principal } from './auth.service';

export const AUTH_SERVICE = Symbol('AUTH_SERVICE');

type AuthedRequest = Request & { principal?: Principal };

function bearerOf(request: Request): string | null {
  const header = request.headers.authorization;
  if (typeof header === 'string') {
    const [scheme, token] = header.split(' ');
    if (scheme === 'Bearer' && token) {
      return token;
    }
  }
  const queryToken = (request.query as Record<string, unknown> | undefined)?.token;
  if (typeof queryToken === 'string' && queryToken) {
    return queryToken;
  }
  return null;
}

/** A buyer or an operator with a live session (D4). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = bearerOf(request);
    const principal = token ? await this.auth.authenticate(token) : null;
    if (!principal) {
      throw new UnauthorizedException('A valid session is required');
    }
    request.principal = principal;
    return true;
  }
}

/**
 * Operators only. Runs after SessionGuard. The operator id is the user id
 * from the session, never a value from the request (DT-17).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const principal = context.switchToHttp().getRequest<AuthedRequest>().principal;
    if (!principal || principal.role !== 'admin') {
      throw new ForbiddenException('Operators only');
    }
    // Throws InvalidOperatorIdError (403) for an id outside DT-17.
    parseOperatorId(principal.id);
    return true;
  }
}

/** The caller of a guarded route. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const principal = context.switchToHttp().getRequest<AuthedRequest>().principal;
    if (!principal) {
      throw new UnauthorizedException('A valid session is required');
    }
    return principal;
  },
);

/** The canonical operator id of the admin calling the route. */
export function operatorIdOf(principal: Principal): string {
  return parseOperatorId(principal.id);
}
