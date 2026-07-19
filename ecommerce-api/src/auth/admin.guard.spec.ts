import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function ctxWithUser(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('rejects non-admin users', () => {
    expect(() =>
      guard.canActivate(
        ctxWithUser({ uid: 'u1', email: 'a@b.com', admin: false }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows admins', () => {
    expect(
      guard.canActivate(
        ctxWithUser({ uid: 'u1', email: 'a@b.com', admin: true }),
      ),
    ).toBe(true);
  });
});
