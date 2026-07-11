import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ApiError } from '@/api/unwrap';

const useAuthMock = vi.fn();
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));

const reviewsControllerCreateMock = vi.fn();
vi.mock('@/api/generated', () => ({
  reviewsControllerCreate: (...args: unknown[]) =>
    reviewsControllerCreateMock(...args),
}));

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

import { ReviewForm } from './ReviewForm';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReviewForm', () => {
  it('renders a sign-in link with the correct next param when signed out', () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    render(<ReviewForm productId="prod_1" slug="organic-surface-tee" />);

    const link = screen.getByRole('link', { name: 'Sign in to review' });
    expect(link.getAttribute('href')).toBe(
      '/login?next=%2Fproducts%2Forganic-surface-tee',
    );
    expect(reviewsControllerCreateMock).not.toHaveBeenCalled();
  });

  it('renders nothing actionable while auth state is loading', () => {
    useAuthMock.mockReturnValue({ user: null, loading: true });
    render(<ReviewForm productId="prod_1" slug="organic-surface-tee" />);

    expect(
      screen.queryByRole('link', { name: 'Sign in to review' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submit review' }),
    ).not.toBeInTheDocument();
  });

  it('shows a validation error when submitting without a rating', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
    const user = userEvent.setup();
    render(<ReviewForm productId="prod_1" slug="organic-surface-tee" />);

    await user.type(
      screen.getByLabelText('Review'),
      'Great product, would buy again.',
    );
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(await screen.findByText('Select a rating.')).toBeInTheDocument();
    expect(reviewsControllerCreateMock).not.toHaveBeenCalled();
  });

  it('renders the verified-buyers message when the API rejects with 403', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
    reviewsControllerCreateMock.mockResolvedValue({
      error: { message: 'Forbidden' },
      response: { status: 403 },
    });
    const user = userEvent.setup();
    render(<ReviewForm productId="prod_1" slug="organic-surface-tee" />);

    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText('Review'), 'Really solid tee.');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(
      await screen.findByText('Only verified buyers can review this product.'),
    ).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('renders the duplicate-review message when the API rejects with 409', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
    reviewsControllerCreateMock.mockResolvedValue({
      error: { message: 'Conflict' },
      response: { status: 409 },
    });
    const user = userEvent.setup();
    render(<ReviewForm productId="prod_1" slug="organic-surface-tee" />);

    await user.click(screen.getByRole('radio', { name: '4 stars' }));
    await user.type(screen.getByLabelText('Review'), 'Pretty good overall.');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(
      await screen.findByText("You've already reviewed this product."),
    ).toBeInTheDocument();
  });

  it('toasts a generic error for other failures', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
    reviewsControllerCreateMock.mockRejectedValue(new ApiError(500, 'boom'));
    const user = userEvent.setup();
    render(<ReviewForm productId="prod_1" slug="organic-surface-tee" />);

    await user.click(screen.getByRole('radio', { name: '3 stars' }));
    await user.type(screen.getByLabelText('Review'), 'It was fine I guess.');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    await screen.findByRole('button', { name: 'Submit review' });
    expect(toastErrorMock).toHaveBeenCalled();
  });

  it('publishes, toasts success, resets, and refreshes on success', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
    reviewsControllerCreateMock.mockResolvedValue({
      data: {
        id: 'rev_1',
        productId: 'prod_1',
        userId: 'u1',
        rating: 5,
        text: 'Fantastic!',
        createdAt: '2026-07-10T00:00:00.000Z',
      },
    });
    const user = userEvent.setup();
    render(<ReviewForm productId="prod_1" slug="organic-surface-tee" />);

    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText('Review'), 'Fantastic!');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    await vi.waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith('Review published'),
    );
    expect(refreshMock).toHaveBeenCalled();
    expect(reviewsControllerCreateMock).toHaveBeenCalledWith({
      path: { productId: 'prod_1' },
      body: { rating: 5, text: 'Fantastic!' },
    });
  });
});
