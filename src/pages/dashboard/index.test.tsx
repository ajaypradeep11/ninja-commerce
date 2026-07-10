import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

vi.mock('@/api/hooks/stats', () => ({
  useAdminStats: () => ({
    data: {
      ordersToday: 7,
      lowStockProducts: [
        { id: 'p2', name: 'Heavyweight Hoodie', slug: 'heavyweight-hoodie', stockQty: 3 },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

import { DashboardPage } from './index';

describe('DashboardPage', () => {
  it('shows orders today and low-stock products with links', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('7')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /heavyweight hoodie/i });
    expect(link).toHaveAttribute('href', '/products/p2');
    expect(screen.getByText(/3 left/i)).toBeInTheDocument();
  });
});
