import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

const state: {
  status: string;
  returnRequestedAt: string | null;
  returnReason: string | null;
} = { status: 'PAID', returnRequestedAt: null, returnReason: null };

vi.mock('@/api/hooks/orders', () => ({
  useOrder: () => ({
    data: {
      id: 'o1',
      email: 'buyer@example.com',
      status: state.status,
      stripeSessionId: 'cs_123',
      stripePaymentIntentId: 'pi_123',
      shippingAddress: { name: 'Demo Buyer', line1: '1 Main St' },
      subtotalCents: 5800,
      taxCents: 754,
      totalCents: 6554,
      deliveredAt: null,
      returnRequestedAt: state.returnRequestedAt,
      returnReason: state.returnReason,
      items: [
        {
          id: 'i1',
          productId: 'p1',
          name: 'Organic Cotton Tee',
          priceCents: 2900,
          quantity: 2,
        },
      ],
      createdAt: '2026-07-09T10:00:00.000Z',
      updatedAt: '2026-07-09T10:00:00.000Z',
    },
    isLoading: false,
    error: null,
  }),
  useUpdateOrderStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useRefundOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelOrder: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { OrderDetailPage } from './order-detail';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/o1']}>
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrderDetailPage', () => {
  beforeEach(() => {
    state.returnRequestedAt = null;
    state.returnReason = null;
  });

  it('PAID order offers Mark shipped and Refund', () => {
    state.status = 'PAID';
    renderPage();
    expect(
      screen.getByRole('button', { name: /mark shipped/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refund/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /mark delivered/i }),
    ).not.toBeInTheDocument();
  });

  it('SHIPPED order offers Mark delivered', () => {
    state.status = 'SHIPPED';
    renderPage();
    expect(
      screen.getByRole('button', { name: /mark delivered/i }),
    ).toBeInTheDocument();
  });

  it('REFUNDED order offers no actions', () => {
    state.status = 'REFUNDED';
    renderPage();
    expect(
      screen.queryByRole('button', { name: /mark|refund/i }),
    ).not.toBeInTheDocument();
  });

  it('shows line items and totals', () => {
    state.status = 'PAID';
    renderPage();
    expect(screen.getByText('Organic Cotton Tee')).toBeInTheDocument();
    expect(screen.getByText('× 2')).toBeInTheDocument();
    expect(screen.getAllByText('$58.00').length).toBeGreaterThan(0);
  });

  it('itemizes tax between subtotal and total when taxCents is set', () => {
    state.status = 'PAID';
    renderPage();
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('Tax')).toBeInTheDocument();
    expect(screen.getByText('$7.54')).toBeInTheDocument();
    // total = subtotal 58.00 + tax 7.54
    expect(screen.getByText('$65.54')).toBeInTheDocument();
  });

  it('shows no return banner when none was requested', () => {
    state.status = 'DELIVERED';
    renderPage();
    expect(screen.queryByText('Return requested')).not.toBeInTheDocument();
  });

  it('shows the return banner with the reason when a return was requested', () => {
    state.status = 'DELIVERED';
    state.returnRequestedAt = '2026-07-15T10:00:00.000Z';
    state.returnReason = 'Wrong size';
    renderPage();
    expect(screen.getByText('Return requested')).toBeInTheDocument();
    expect(screen.getByText('Wrong size')).toBeInTheDocument();
  });
});
