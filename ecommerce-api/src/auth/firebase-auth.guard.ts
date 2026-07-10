import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseService } from '../firebase/firebase.service';
import { AuthUser } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: AuthUser }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (isPublic) {
      if (token) {
        try {
          const decoded = await this.firebase.verifyIdToken(token);
          req.user = {
            uid: decoded.uid,
            email: decoded.email ?? '',
            admin: decoded.admin === true,
          };
        } catch {
          // public route: ignore bad tokens
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const decoded = await this.firebase.verifyIdToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email ?? '',
        admin: decoded.admin === true,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
