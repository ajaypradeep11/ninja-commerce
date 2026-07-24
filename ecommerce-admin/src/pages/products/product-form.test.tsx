import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

const createMutate = vi.fn();
const updateMutate = vi.fn();
const existingProduct = {
  id: 'p1',
  name: 'Organic Cotton Tee',
  slug: 'organic-cotton-tee',
  description: 'Soft tee',
  priceCents: 2999,
  priceUsdCents: 2199,
  images: [],
  stockQty: 10,
  active: true,
  categoryId: 'c1',
  averageRating: null,
  reviewCount: 0,
  createdAt: '',
  updatedAt: '',
};
vi.mock('@/api/hooks/products', () => ({
  useProduct: () => ({ data: existingProduct, isLoading: false, error: null }),
  useCreateProduct: () => ({ mutate: createMutate, isPending: false }),
  useUpdateProduct: () => ({ mutate: updateMutate, isPending: false }),
}));
const stableCategories = [
  { id: 'c1', name: 'Tees', slug: 'tees', sortOrder: 0 },
  { id: 'c2', name: 'Hoodies', slug: 'hoodies', sortOrder: 1 },
];
vi.mock('@/api/hooks/categories', () => ({
  useCategories: () => ({
    data: stableCategories,
    isLoading: false,
    error: null,
  }),
}));
const stableBrands = [{ id: 'b1', name: 'Naruto', slug: 'naruto', sortOrder: 0 }];
vi.mock('@/api/hooks/brands', () => ({
  useBrands: () => ({
    data: stableBrands,
    isLoading: false,
    error: null,
  }),
}));
vi.mock('@/components/ImageUpload', () => ({
  ImageUpload: () => <div data-testid="image-upload" />,
}));

import { ProductFormPage } from './product-form';

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/products/new']}>
      <Routes>
        <Route path="/products/new" element={<ProductFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={['/products/p1']}>
      <Routes>
        <Route path="/products/:id" element={<ProductFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductFormPage (create)', () => {
  beforeEach(() => createMutate.mockClear());

  it('auto-generates the slug from the name', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText('Name'), 'Organic Cotton Tee');
    expect(screen.getByLabelText('Slug')).toHaveValue('organic-cotton-tee');
  });

  it('stops auto-generating after the slug is manually edited', async () => {
    const user = userEvent.setup();
    renderNew();
    const slug = screen.getByLabelText('Slug');
    await user.type(slug, 'custom-slug');
    await user.type(screen.getByLabelText('Name'), 'New Name');
    expect(slug).toHaveValue('custom-slug');
  });

  it('submits dollars converted to integer cents', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText('Name'), 'Tee');
    await user.type(screen.getByPlaceholderText(/describe the product/i), 'Nice tee');
    await user.type(screen.getByLabelText('Price (CAD)'), '29.99');
    await user.type(screen.getByLabelText('Price (USD)'), '21.99');
    await user.type(screen.getByLabelText('Stock'), '10');
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Tees' }));
    await user.click(screen.getByRole('button', { name: /create product/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      name: 'Tee',
      slug: 'tee',
      priceCents: 2999,
      priceUsdCents: 2199,
      stockQty: 10,
      categoryId: 'c1',
      active: true,
    });
  });

  it('rejects an invalid price', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText('Name'), 'Tee');
    await user.type(screen.getByPlaceholderText(/describe the product/i), 'Nice tee');
    await user.type(screen.getByLabelText('Price (CAD)'), '1.999');
    await user.type(screen.getByLabelText('Price (USD)'), '29.99');
    await user.type(screen.getByLabelText('Stock'), '10');
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Tees' }));
    await user.click(screen.getByRole('button', { name: /create product/i }));

    expect(await screen.findByText(/valid price/i)).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('blocks submit when the USD price is empty', async () => {
    const user = userEvent.setup();
    renderNew();

    await user.type(screen.getByLabelText('Name'), 'Lamp');
    await user.type(screen.getByLabelText('Price (CAD)'), '54.99');
    await user.click(screen.getByRole('button', { name: /save|create/i }));

    expect(await screen.findByText('Enter a valid price')).toBeInTheDocument();
  });

  it('fills the USD price from CAD when the autofill button is clicked', async () => {
    const user = userEvent.setup();
    renderNew();

    await user.type(screen.getByLabelText('Price (CAD)'), '54.99');
    await user.click(screen.getByRole('button', { name: 'Autofill from CAD' }));

    expect(screen.getByLabelText('Price (USD)')).toHaveValue('39.99');
  });
});

describe('ProductFormPage (edit)', () => {
  beforeEach(() => updateMutate.mockClear());

  it('prefills the category select from the fetched product and submits it unchanged', async () => {
    const user = userEvent.setup();
    renderEdit();

    // All other fields land from the fetched product.
    await waitFor(() =>
      expect(screen.getByLabelText('Name')).toHaveValue('Organic Cotton Tee'),
    );

    // The category trigger should reflect the fetched category, not the placeholder.
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Category' }),
      ).toHaveTextContent('Tees'),
    );

    // Submit without touching the category select at all (user just clicks save).
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0]).toMatchObject({
      id: 'p1',
      body: expect.objectContaining({ categoryId: 'c1' }),
    });
  });
});
