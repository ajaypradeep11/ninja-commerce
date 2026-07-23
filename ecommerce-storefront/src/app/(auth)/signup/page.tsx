import { Suspense } from 'react';
import { AuthForm } from '@/components/site/AuthForm';

export const metadata = { title: 'Create account' };

export default function SignupPage() {
  return (
    <main className="auth-canvas flex min-h-screen items-center justify-center bg-surface px-4 py-24 text-ink">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
