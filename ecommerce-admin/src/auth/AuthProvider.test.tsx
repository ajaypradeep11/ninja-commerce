import { act, render, screen } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { vi } from 'vitest';

const onAuthStateChangedMock = vi.fn();
vi.mock('./firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
  signOut: vi.fn(),
}));

import { AuthProvider, useAuth } from './AuthProvider';

function Probe() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return (
    <div>
      {user ? `user:${user.uid}` : 'signed-out'} admin:{String(isAdmin)}
    </div>
  );
}

function fakeUser(claims: Record<string, unknown>): User {
  return {
    uid: 'u1',
    getIdTokenResult: vi.fn().mockResolvedValue({ claims }),
  } as unknown as User;
}

describe('AuthProvider', () => {
  it('exposes loading, then admin user state', async () => {
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

    await act(async () => fire(fakeUser({ admin: true })));
    expect(await screen.findByText('user:u1 admin:true')).toBeInTheDocument();
  });

  it('reports non-admin for missing claim', async () => {
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
    await act(async () => fire(fakeUser({})));
    expect(await screen.findByText('user:u1 admin:false')).toBeInTheDocument();
  });

  it('reports signed-out', async () => {
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
    expect(await screen.findByText(/signed-out/)).toBeInTheDocument();
  });

  it('handles token refresh rejection gracefully', async () => {
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
    const failingUser = {
      uid: 'u1',
      getIdTokenResult: vi
        .fn()
        .mockRejectedValue(new Error('Network error')),
    } as unknown as User;

    await act(async () => fire(failingUser));
    expect(
      await screen.findByText('user:u1 admin:false'),
    ).toBeInTheDocument();
  });
});
