import { act, render, screen } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { vi } from 'vitest';

const onAuthStateChangedMock = vi.fn();
const signOutMock = vi.fn();
vi.mock('./firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
  signOut: (...args: unknown[]) => signOutMock(...args),
}));
// interceptors.ts is imported for its side effect from AuthProvider's module
// scope; it also touches '@/api/client', which is safe to load as-is.
vi.mock('./interceptors', () => ({}));

import { AuthProvider, useAuth } from './AuthProvider';

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? `user:${user.uid}` : 'signed-out'}</div>;
}

function fakeUser(overrides: Partial<User> = {}): User {
  return { uid: 'u1', ...overrides } as unknown as User;
}

describe('AuthProvider', () => {
  it('starts in a loading state, then reflects the signed-in user', async () => {
    let fire: (u: User | null) => void = () => {};
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      fire = cb;
      return () => {};
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText('loading')).toBeInTheDocument();

    await act(async () => fire(fakeUser()));
    expect(await screen.findByText('user:u1')).toBeInTheDocument();
  });

  it('reports signed-out once the callback fires with null', async () => {
    let fire: (u: User | null) => void = () => {};
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      fire = cb;
      return () => {};
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => fire(null));
    expect(await screen.findByText('signed-out')).toBeInTheDocument();
  });

  it('never hangs on loading, even when a promise on the user object rejects (Phase 2 regression)', async () => {
    let fire: (u: User | null) => void = () => {};
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      fire = cb;
      return () => {};
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    const failingUser = fakeUser({
      getIdToken: vi.fn().mockRejectedValue(new Error('Network error')),
      getIdTokenResult: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    await act(async () => fire(failingUser));
    // The provider must set state synchronously off the auth callback and
    // never await per-user token work before clearing `loading` — otherwise
    // a rejected promise leaves the app stuck on the loading skeleton.
    expect(await screen.findByText('user:u1')).toBeInTheDocument();
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
  });

  it('unsubscribes from onAuthStateChanged on unmount', () => {
    const unsubscribe = vi.fn();
    onAuthStateChangedMock.mockImplementation(() => unsubscribe);
    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('useAuth throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      'useAuth must be used within AuthProvider',
    );
    spy.mockRestore();
  });

  it('signOutUser delegates to firebase signOut', async () => {
    let fire: (u: User | null) => void = () => {};
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      fire = cb;
      return () => {};
    });
    signOutMock.mockResolvedValue(undefined);

    function SignOutProbe() {
      const { signOutUser } = useAuth();
      return <button onClick={() => void signOutUser()}>sign out</button>;
    }

    render(
      <AuthProvider>
        <SignOutProbe />
      </AuthProvider>,
    );
    await act(async () => fire(fakeUser()));
    screen.getByText('sign out').click();
    await act(async () => {});
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
