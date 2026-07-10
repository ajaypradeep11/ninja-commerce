import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from './AuthProvider';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, signOutUser } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-semibold">Not authorized</h1>
        <p className="text-muted-foreground">
          {user.email} does not have admin access.
        </p>
        <Button variant="outline" onClick={() => void signOutUser()}>
          Sign out
        </Button>
      </div>
    );
  }
  return children;
}
