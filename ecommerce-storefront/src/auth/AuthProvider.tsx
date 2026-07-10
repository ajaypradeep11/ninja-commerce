'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import './interceptors';

type AuthState = {
  user: User | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>(
    { user: null, loading: true },
  );

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        // Set state synchronously off the callback: no per-user async work
        // (e.g. token/claims fetch) is awaited before clearing `loading`.
        // Awaiting such a promise here was the Phase 2 bug — if it rejected,
        // nothing ever cleared `loading` and the app hung on the spinner.
        setState({ user, loading: false });
      }),
    [],
  );

  const signOutUser = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ ...state, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
