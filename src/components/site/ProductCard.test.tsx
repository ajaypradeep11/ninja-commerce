import { render, screen } from '@testing-library/react';
import type { ProductResponseDto } from '@/api/generated';
import { ProductCard } from './ProductCard';

function makeProduct(overrides: Partial<ProductResponseDto> = {}): ProductResponseDto {
  return {
    id: 'prod_1',
    name: 'Organic Cotton Tee',
    slug: 'organic-cotton-tee',
    description: 'A soft everyday tee.',
    priceCents: 2900,
    images: ['https://picsum.photos/seed/organic-cotton-tee-1/900/1125'],
    stockQty: 40,
    active: true,
    categoryId: 'cat_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    averageRating: 4.5,
    reviewCount: 8,
    ...overrides,
  };
}

describe('ProductCard', () => {
  it('renders the product name, price, and a link to the product page', () => {
    render(<ProductCard product={makeProduct()} />);

    expect(screen.getByText('Organic Cotton Tee')).toBeInTheDocument();
    expect(screen.getByText('$29.00')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/organic-cotton-tee');
  });

  it('shows a LOW STOCK badge when stockQty is between 1 and 5', () => {
    render(<ProductCard product={makeProduct({ stockQty: 3 })} />);
    expect(screen.getByText('LOW STOCK')).toBeInTheDocument();
  });

  it('shows an OUT OF STOCK badge when stockQty is 0', () => {
    render(<ProductCard product={makeProduct({ stockQty: 0 })} />);
    expect(screen.getByText('OUT OF STOCK')).toBeInTheDocument();
  });

  it('shows no stock badge when stockQty is comfortably above the low-stock threshold', () => {
    render(<ProductCard product={makeProduct({ stockQty: 40 })} />);
    expect(screen.queryByText('LOW STOCK')).not.toBeInTheDocument();
    expect(screen.queryByText('OUT OF STOCK')).not.toBeInTheDocument();
  });
});
