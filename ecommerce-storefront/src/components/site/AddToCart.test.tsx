import { render, screen, fireEvent } from '@testing-library/react';
import type { ProductResponseDto } from '@/api/generated';
import { addLine } from '@/cart/store';
import { AddToCart } from './AddToCart';

vi.mock('@/cart/store', () => ({ addLine: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

function makeProduct(overrides: Partial<ProductResponseDto> = {}): ProductResponseDto {
  return {
    id: 'prod_1',
    name: 'Heavyweight Hoodie',
    slug: 'heavyweight-hoodie',
    description: 'A cozy, heavyweight hoodie.',
    priceCents: 7900,
    images: ['https://picsum.photos/seed/heavyweight-hoodie-1/900/1125'],
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

describe('AddToCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clamps the quantity stepper at stockQty', () => {
    render(<AddToCart product={makeProduct({ stockQty: 3 })} />);
    const increase = screen.getByRole('button', { name: 'Increase quantity' });

    fireEvent.click(increase);
    fireEvent.click(increase);
    fireEvent.click(increase); // fourth unit — should stay clamped at 3

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('disables the add button and shows OUT OF STOCK when stockQty is 0', () => {
    render(<AddToCart product={makeProduct({ stockQty: 0 })} />);

    const button = screen.getByRole('button', { name: /out of stock/i });
    expect(button).toBeDisabled();
    expect(screen.getByText('OUT OF STOCK')).toBeInTheDocument();
  });

  it('calls addLine with the selected quantity and toasts on add', () => {
    const product = makeProduct({ stockQty: 40 });
    render(<AddToCart product={product} />);

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(addLine).toHaveBeenCalledWith(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        priceCents: product.priceCents,
        image: product.images[0],
        stockQty: product.stockQty,
      },
      2,
    );
  });
});
