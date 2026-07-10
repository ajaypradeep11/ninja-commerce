import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { ApiError } from '@/api/unwrap';
import type { CartLine } from '@/cart/store';

const useAuthMock = vi.fn();
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const checkoutControllerCreateMock = vi.fn();
vi.mock('@/api/generated', () => ({
  checkoutControllerCreate: (...args: unknown[]) => checkoutControllerCreateMock(...args),
}));

const toastErrorMock = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

const applyCartRefreshMock = vi.fn();
vi.mock('./cart-refresh', () => ({
  applyCartRefresh: (...args: unknown[]) => applyCartRefreshMock(...args),
}));

import { CheckoutButton } from './CheckoutButton';

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 'prod_1',
    slug: 'heavyweight-hoodie',
    name: 'Heavyweight Hoodie',
    priceCents: 7900,
    image: 'https://picsum.photos/seed/heavyweight-hoodie-1/900/1125',
    quantity: 2,
    stockQty: 40,
    ...overrides,
  };
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const assignMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  applyCartRefreshMock.mockResolvedValue({ removedUnavailable: false });
  vi.stubGlobal('location', { ...window.location, assign: assignMock });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CheckoutButton', () => {
  it('redirects to login with a next param when signed out, without calling checkout', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    const user = userEvent.setup();
    renderWithClient(<CheckoutButton lines={[makeLine()]} />);

    await user.click(screen.getByRole('button', { name: 'Checkout' }));

    expect(pushMock).toHaveBeenCalledWith('/login?next=/cart');
    expect(checkoutControllerCreateMock).not.toHaveBeenCalled();
  });

  it('posts the cart lines and redirects to the Stripe URL on success', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
    checkoutControllerCreateMock.mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/session_123', orderId: 'order_1' },
    });
    const lines = [makeLine({ productId: 'prod_1', quantity: 2 }), makeLine({ productId: 'prod_2', quantity: 1 })];
    const user = userEvent.setup();
    renderWithClient(<CheckoutButton lines={lines} />);

    await user.click(screen.getByRole('button', { name: 'Checkout' }));

    expect(checkoutControllerCreateMock).toHaveBeenCalledWith({
      body: {
        items: [
          { productId: 'prod_1', quantity: 2 },
          { productId: 'prod_2', quantity: 1 },
        ],
      },
    });
    await vi.waitFor(() => expect(assignMock).toHaveBeenCalledWith('https://checkout.stripe.com/session_123'));
  });

  it('toasts the exact API message and re-runs the refresh on a 409 conflict', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
    checkoutControllerCreateMock.mockResolvedValue({
      error: { message: 'Only 1 left of Heavyweight Hoodie' },
      response: { status: 409 },
    });
    const lines = [makeLine({ quantity: 3, stockQty: 1 })];
    const user = userEvent.setup();
    renderWithClient(<CheckoutButton lines={lines} />);

    await user.click(screen.getByRole('button', { name: 'Checkout' }));

    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Only 1 left of Heavyweight Hoodie'));
    expect(applyCartRefreshMock).toHaveBeenCalledWith(lines);
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('toasts the exact API message and re-runs the refresh on a 404', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
    checkoutControllerCreateMock.mockResolvedValue({
      error: { message: 'Product no longer exists' },
      response: { status: 404 },
    });
    const lines = [makeLine()];
    const user = userEvent.setup();
    renderWithClient(<CheckoutButton lines={lines} />);

    await user.click(screen.getByRole('button', { name: 'Checkout' }));

    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Product no longer exists'));
    expect(applyCartRefreshMock).toHaveBeenCalledWith(lines);
  });

  it('toasts a generic failure message for other errors, without re-running the refresh', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
    checkoutControllerCreateMock.mockRejectedValue(new ApiError(500, 'boom'));
    const lines = [makeLine()];
    const user = userEvent.setup();
    renderWithClient(<CheckoutButton lines={lines} />);

    await user.click(screen.getByRole('button', { name: 'Checkout' }));

    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Checkout failed. Try again.'));
    expect(applyCartRefreshMock).not.toHaveBeenCalled();
  });

  it('is disabled when the cart is empty', () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
    renderWithClient(<CheckoutButton lines={[]} />);

    expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled();
  });

  it('is disabled with helper text when any line is out of stock', () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
    const lines = [makeLine({ productId: 'prod_1' }), makeLine({ productId: 'prod_2', stockQty: 0, quantity: 1 })];
    renderWithClient(<CheckoutButton lines={lines} />);

    expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled();
    expect(screen.getByText('Remove out-of-stock items to check out.')).toBeInTheDocument();
  });
});
