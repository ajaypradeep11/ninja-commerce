import { Suspense } from 'react';
import { AuthForm } from '@/components/site/AuthForm';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="auth-canvas flex min-h-screen items-center justify-center bg-surface px-4 py-24 text-ink">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
