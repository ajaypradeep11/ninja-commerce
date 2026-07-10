import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const signInWithEmailAndPasswordMock = vi.fn();
const createUserWithEmailAndPasswordMock = vi.fn();
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args: unknown[]) =>
    signInWithEmailAndPasswordMock(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    createUserWithEmailAndPasswordMock(...args),
}));
vi.mock('@/auth/firebase', () => ({ auth: {} }));

const replaceMock = vi.fn();
let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParams,
}));

import { AuthForm, firebaseErrorMessage } from './AuthForm';

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

describe('firebaseErrorMessage', () => {
  it('maps known codes', () => {
    expect(firebaseErrorMessage('auth/invalid-credential')).toBe(
      'Email or password is incorrect.',
    );
    expect(firebaseErrorMessage('auth/email-already-in-use')).toBe(
      'An account with this email already exists.',
    );
    expect(firebaseErrorMessage('auth/weak-password')).toBe(
      'Password must be at least 6 characters.',
    );
  });

  it('falls back for unknown codes', () => {
    expect(firebaseErrorMessage('auth/network-request-failed')).toBe(
      'Something went wrong. Try again.',
    );
  });

  // Regression: the Auth Emulator (unlike production Identity Platform with
  // enumeration protection) returns these field-specific codes instead of
  // 'auth/invalid-credential' for a bad login. Discovered during the manual
  // emulator verification pass for this task.
  it('maps emulator-specific bad-login codes to the same friendly message', () => {
    expect(firebaseErrorMessage('auth/wrong-password')).toBe(
      'Email or password is incorrect.',
    );
    expect(firebaseErrorMessage('auth/user-not-found')).toBe(
      'Email or password is incorrect.',
    );
  });
});

describe('AuthForm', () => {
  it('shows a field error for an invalid email', async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText(/enter a valid email/i),
    ).toBeInTheDocument();
    expect(signInWithEmailAndPasswordMock).not.toHaveBeenCalled();
  });

  it('shows a field error for a short password', async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText('Email'), 'shopper@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText(/at least 6 characters/i),
    ).toBeInTheDocument();
    expect(signInWithEmailAndPasswordMock).not.toHaveBeenCalled();
  });

  it('maps a rejected sign-in to a friendly error message', async () => {
    signInWithEmailAndPasswordMock.mockRejectedValue({
      code: 'auth/invalid-credential',
    });
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText('Email'), 'shopper@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Email or password is incorrect.'),
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('maps the emulator-shaped wrong-password rejection the same way', async () => {
    signInWithEmailAndPasswordMock.mockRejectedValue({
      code: 'auth/wrong-password',
    });
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText('Email'), 'shopper@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Email or password is incorrect.'),
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('signs up and navigates to / on success', async () => {
    createUserWithEmailAndPasswordMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AuthForm mode="signup" />);

    await user.type(screen.getByLabelText('Email'), 'shopper@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(createUserWithEmailAndPasswordMock).toHaveBeenCalledWith(
        {},
        'shopper@example.com',
        'password123',
      ),
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'));
  });

  it('navigates to the sanitized next param on success', async () => {
    searchParams = new URLSearchParams({ next: '/account' });
    signInWithEmailAndPasswordMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText('Email'), 'shopper@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/account'));
  });

  it('rejects an external next value (open-redirect guard)', async () => {
    searchParams = new URLSearchParams({ next: 'https://evil.example.com' });
    signInWithEmailAndPasswordMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText('Email'), 'shopper@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'));
  });

  it('rejects a backslash-variant next value (open-redirect guard)', async () => {
    // WHATWG URL parsing normalizes leading backslashes to forward slashes,
    // so '/\evil.com' would resolve to '//evil.com' (protocol-relative) if
    // only the first character were checked.
    searchParams = new URLSearchParams({ next: '/\\evil.com' });
    signInWithEmailAndPasswordMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText('Email'), 'shopper@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'));
  });

  it('preserves the next param in the swap link', () => {
    searchParams = new URLSearchParams({ next: '/account' });
    render(<AuthForm mode="login" />);

    const link = screen.getByRole('link', { name: 'Create one' });
    expect(link.getAttribute('href')).toBe(
      `/signup?next=${encodeURIComponent('/account')}`,
    );
  });
});
