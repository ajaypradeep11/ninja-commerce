import { render, screen, within } from '@testing-library/react';
import type { OrderItemResponseDto, OrderResponseDto } from '@/api/generated';
import { formatCents } from '@/lib/money';

const useAuthMock = vi.fn();
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));

const clearCartMock = vi.fn();
vi.mock('@/cart/store', () => ({
  clearCart: (...args: unknown[]) => clearCartMock(...args),
}));

const replaceMock = vi.fn();
const searchParamsMock = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/checkout/success',
  useSearchParams: () => searchParamsMock,
}));

const pollForOrderMock = vi.fn();
vi.mock('./success-poll', () => ({
  pollForOrder: (...args: unknown[]) => pollForOrderMock(...args),
}));

vi.mock('@/api/generated', () => ({
  ordersControllerFindMine: vi.fn(),
}));

import { SuccessStates } from './SuccessStates';

function makeItem(overrides: Partial<OrderItemResponseDto> = {}): OrderItemResponseDto {
  return {
    id: 'item_1',
    orderId: 'order_1',
    productId: 'prod_1',
    name: 'Heavyweight Hoodie',
    priceCents: 7900,
    quantity: 2,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderResponseDto> = {}): OrderResponseDto {
  return {
    id: 'order_1',
    userId: 'user_1',
    email: 'shopper@example.com',
    status: 'PAID',
    stripeSessionId: 'cs_test_1',
    stripePaymentIntentId: 'pi_test_1',
    shippingAddress: null,
    subtotalCents: 15800,
    totalCents: 16800,
    items: [makeItem()],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Array.from(searchParamsMock.keys())) {
    searchParamsMock.delete(key);
  }
  pollForOrderMock.mockResolvedValue({ state: 'not-found' });
});

describe('SuccessStates', () => {
  it('does not clear the cart when session_id is absent', () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });

    render(<SuccessStates />);

    expect(clearCartMock).not.toHaveBeenCalled();
  });

  describe('paid state', () => {
    it('renders the thank-you heading, mono order id, each item, and the totalCents total', async () => {
      searchParamsMock.set('session_id', 'cs_test_1');
      useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
      const order = makeOrder({
        items: [
          makeItem({ id: 'item_1', name: 'Heavyweight Hoodie', priceCents: 7900, quantity: 2 }),
          makeItem({ id: 'item_2', name: 'Organic Cotton Tee', priceCents: 3200, quantity: 1 }),
        ],
        subtotalCents: 19000,
        totalCents: 20500,
      });
      pollForOrderMock.mockResolvedValue({ state: 'paid', order });

      render(<SuccessStates />);

      expect(await screen.findByText('Thank you')).toBeInTheDocument();
      const orderIdEl = screen.getByText('order_1');
      expect(orderIdEl).toHaveClass('font-mono');

      expect(screen.getByText('Heavyweight Hoodie')).toBeInTheDocument();
      expect(screen.getByText(formatCents(7900 * 2))).toBeInTheDocument();
      expect(screen.getByText('Organic Cotton Tee')).toBeInTheDocument();
      expect(screen.getByText(formatCents(3200 * 1))).toBeInTheDocument();

      const totalRow = screen.getByText('Total').closest('div');
      expect(within(totalRow!).getByText(formatCents(20500))).toBeInTheDocument();
    });

    it('falls back to subtotalCents for the total when totalCents is null', async () => {
      searchParamsMock.set('session_id', 'cs_test_1');
      useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
      const order = makeOrder({ totalCents: null, subtotalCents: 4200 });
      pollForOrderMock.mockResolvedValue({ state: 'paid', order });

      render(<SuccessStates />);

      await screen.findByText('Thank you');
      const totalRow = screen.getByText('Total').closest('div');
      expect(within(totalRow!).getByText(formatCents(4200))).toBeInTheDocument();
    });

    it('renders no address block and does not crash when shippingAddress is null', async () => {
      searchParamsMock.set('session_id', 'cs_test_1');
      useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
      const order = makeOrder({ shippingAddress: null });
      pollForOrderMock.mockResolvedValue({ state: 'paid', order });

      render(<SuccessStates />);

      await screen.findByText('Thank you');
      expect(screen.queryByText('Shipping to')).not.toBeInTheDocument();
    });

    it('renders no address block and does not crash when shippingAddress is malformed', async () => {
      searchParamsMock.set('session_id', 'cs_test_1');
      useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
      const order = makeOrder({ shippingAddress: { foo: 'bar' } });
      pollForOrderMock.mockResolvedValue({ state: 'paid', order });

      render(<SuccessStates />);

      await screen.findByText('Thank you');
      expect(screen.queryByText('Shipping to')).not.toBeInTheDocument();
    });

    it('renders a normalized address block for a populated Stripe-shaped snake_case address', async () => {
      searchParamsMock.set('session_id', 'cs_test_1');
      useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
      const order = makeOrder({
        shippingAddress: {
          name: 'Jane Doe',
          line1: '123 Main St',
          line2: 'Apt 4',
          city: 'Springfield',
          state: 'IL',
          postal_code: '62704',
          country: 'US',
        },
      });
      pollForOrderMock.mockResolvedValue({ state: 'paid', order });

      render(<SuccessStates />);

      await screen.findByText('Thank you');
      expect(screen.getByText('Shipping to')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('Apt 4')).toBeInTheDocument();
      expect(screen.getByText(/Springfield, IL 62704/)).toBeInTheDocument();
      expect(screen.getByText('US')).toBeInTheDocument();
    });
  });

  describe('pending-timeout state', () => {
    it('renders reassurance copy with no error tone and a link to /account/orders', async () => {
      searchParamsMock.set('session_id', 'cs_test_1');
      useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false });
      const order = makeOrder({ status: 'PENDING' });
      pollForOrderMock.mockResolvedValue({ state: 'pending-timeout', order });

      render(<SuccessStates />);

      expect(
        await screen.findByText(
          'Your payment is confirmed with Stripe; the order is still processing. It will appear in your orders shortly.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Thank you')).not.toBeInTheDocument();
      const link = screen.getByRole('link', { name: 'View your orders' });
      expect(link).toHaveAttribute('href', '/account/orders');
    });
  });
});
