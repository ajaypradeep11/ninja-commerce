'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { auth } from '@/auth/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type FormValues = z.infer<typeof schema>;

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  // Production Identity Platform (with enumeration protection) returns
  // 'auth/invalid-credential' for any bad login. The Auth Emulator instead
  // still returns the older, field-specific codes ('auth/wrong-password',
  // 'auth/user-not-found') — map all three to the same message so we never
  // reveal which field was wrong and both environments show the right copy.
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
};

export function firebaseErrorMessage(code: string): string {
  return FIREBASE_ERROR_MESSAGES[code] ?? 'Something went wrong. Try again.';
}

function errorCodeOf(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return '';
}

// Open-redirect guard: only ever redirect to same-origin, path-relative
// destinations. Anything else (protocol-relative, absolute, javascript:, ...)
// falls back to '/'. Reject a second character of '/' or '\' — browsers'
// WHATWG URL parsing normalizes leading backslashes to forward slashes, so
// '/\evil.com' would otherwise resolve to the protocol-relative '//evil.com'.
function safeNext(raw: string | null): string {
  if (!raw || raw[0] !== '/') return '/';
  const second = raw[1];
  if (second === '/' || second === '\\') return '/';
  return raw;
}

const COPY = {
  login: {
    heading: 'Sign in',
    submit: 'Sign in',
    swapHref: '/signup',
    swapPrompt: "Don't have an account?",
    swapLabel: 'Create one',
  },
  signup: {
    heading: 'Create account',
    submit: 'Create account',
    swapHref: '/login',
    swapPrompt: 'Already have an account?',
    swapLabel: 'Sign in',
  },
} as const;

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const copy = COPY[mode];
  const swapHref =
    next === '/'
      ? copy.swapHref
      : `${copy.swapHref}?next=${encodeURIComponent(next)}`;

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, values.email, values.password);
      } else {
        await createUserWithEmailAndPassword(
          auth,
          values.email,
          values.password,
        );
      }
      router.replace(next);
    } catch (error) {
      setFormError(firebaseErrorMessage(errorCodeOf(error)));
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="font-display text-3xl">{copy.heading}</h1>
      <div className="selvedge mt-4 mb-8" />
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="grid gap-4"
        noValidate
      >
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-madder">{errors.email.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-sm text-madder">{errors.password.message}</p>
          )}
        </div>
        {formError && <p className="text-sm text-madder">{formError}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {copy.submit}
        </Button>
      </form>
      <p className="mt-6 text-sm text-ink/70">
        {copy.swapPrompt}{' '}
        <Link
          href={swapHref}
          className="font-medium text-indigo underline underline-offset-4"
        >
          {copy.swapLabel}
        </Link>
      </p>
    </div>
  );
}
