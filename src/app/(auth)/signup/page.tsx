import { Suspense } from 'react';
import { AuthForm } from '@/components/site/AuthForm';

export const metadata = { title: 'Create account' };

export default function SignupPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-24">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
