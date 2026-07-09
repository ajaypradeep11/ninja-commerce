import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseService } from '../firebase/firebase.service';

function ctxWith(headers: Record<string, string>): ExecutionContext {
  const req: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  let firebase: { verifyIdToken: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: FirebaseAuthGuard;

  beforeEach(() => {
    firebase = { verifyIdToken: jest.fn() };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    guard = new FirebaseAuthGuard(
      firebase as unknown as FirebaseService,
      reflector as unknown as Reflector,
    );
  });

  it('allows @Public() routes without a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(ctxWith({}))).resolves.toBe(true);
  });

  it('rejects missing bearer token', async () => {
    await expect(guard.canActivate(ctxWith({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects invalid token', async () => {
    firebase.verifyIdToken.mockRejectedValue(new Error('bad'));
    await expect(
      guard.canActivate(ctxWith({ authorization: 'Bearer nope' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches AuthUser with admin claim', async () => {
    firebase.verifyIdToken.mockResolvedValue({
      uid: 'u1',
      email: 'a@b.com',
      admin: true,
    });
    const ctx = ctxWith({ authorization: 'Bearer good' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest<{ user: unknown }>();
    expect(req.user).toEqual({ uid: 'u1', email: 'a@b.com', admin: true });
  });
});
