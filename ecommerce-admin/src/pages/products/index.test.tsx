import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

vi.mock('@/api/hooks/products', () => ({
  useProducts: () => ({
    data: {
      items: [
        {
          id: 'p1',
          name: 'Organic Cotton Tee',
          slug: 'organic-cotton-tee',
          priceCents: 2900,
          stockQty: 40,
          active: true,
          averageRating: 4.5,
          reviewCount: 2,
          category: { id: 'c1', name: 'Tees' },
        },
        {
          id: 'p2',
          name: 'Retired Crewneck',
          slug: 'retired-crewneck',
          priceCents: 5900,
          stockQty: 0,
          active: false,
          averageRating: null,
          reviewCount: 0,
          category: { id: 'c2', name: 'Hoodies' },
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    },
    isLoading: false,
    error: null,
    isPlaceholderData: false,
  }),
  useBulkCreateProducts: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/api/hooks/categories', () => ({
  useCategories: () => ({ data: [], isLoading: false, error: null }),
}));

import { ProductsPage } from './index';

describe('ProductsPage', () => {
  it('renders products with price, stock, and status', () => {
    render(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Organic Cotton Tee')).toBeInTheDocument();
    expect(screen.getByText('$29.00')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('4.5 (2)')).toBeInTheDocument();
  });
});
