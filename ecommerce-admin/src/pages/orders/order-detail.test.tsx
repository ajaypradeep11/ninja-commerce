import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

const state: { status: string } = { status: 'PAID' };

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
      totalCents: 5800,
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
});
