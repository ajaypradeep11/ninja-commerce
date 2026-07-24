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
    priceUsdCents: 2100,
    images: ['https://picsum.photos/seed/organic-cotton-tee-1/900/1125'],
    stockQty: 40,
    active: true,
    categoryId: 'cat_1',
    brandId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    averageRating: 4.5,
    reviewCount: 8,
    ...overrides,
  };
}

describe('ProductCard', () => {
  it('renders the CAD price by default', () => {
    render(<ProductCard product={makeProduct()} currency="CAD" />);
    expect(screen.getByText('CAD $29.00')).toBeInTheDocument();
  });

  it('renders the USD price when USD is active', () => {
    render(<ProductCard product={makeProduct()} currency="USD" />);
    expect(screen.getByText('USD $21.00')).toBeInTheDocument();
  });

  it('renders the product name and a link to the product page', () => {
    render(<ProductCard product={makeProduct()} currency="CAD" />);

    expect(screen.getByText('Organic Cotton Tee')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/organic-cotton-tee');
  });

  it('shows a LOW STOCK badge when stockQty is between 1 and 5', () => {
    render(<ProductCard product={makeProduct({ stockQty: 3 })} currency="CAD" />);
    expect(screen.getByText('LOW STOCK')).toBeInTheDocument();
  });

  it('shows an OUT OF STOCK badge when stockQty is 0', () => {
    render(<ProductCard product={makeProduct({ stockQty: 0 })} currency="CAD" />);
    expect(screen.getByText('OUT OF STOCK')).toBeInTheDocument();
  });

  it('stacks the second image as a hover swap when the product has one', () => {
    const { container } = render(
      <ProductCard
        product={makeProduct({
          images: [
            'https://picsum.photos/seed/tee-1/900/1125',
            'https://picsum.photos/seed/tee-2/900/1125',
          ],
        })}
        currency="CAD"
      />,
    );

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    // The swap is CSS-only: the second image sits on top at opacity-0 and
    // fades in on hover of the card group.
    expect(images[1].className).toContain('group-hover:opacity-100');
    // Decorative — the first image already carries the product name.
    expect(images[1]).toHaveAttribute('alt', '');
  });

  it('renders a single image when the product has no second image', () => {
    const { container } = render(<ProductCard product={makeProduct()} currency="CAD" />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('shows no stock badge when stockQty is comfortably above the low-stock threshold', () => {
    render(<ProductCard product={makeProduct({ stockQty: 40 })} currency="CAD" />);
    expect(screen.queryByText('LOW STOCK')).not.toBeInTheDocument();
    expect(screen.queryByText('OUT OF STOCK')).not.toBeInTheDocument();
  });
});
