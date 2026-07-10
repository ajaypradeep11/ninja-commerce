import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

const createMutate = vi.fn();
vi.mock('@/api/hooks/products', () => ({
  useProduct: () => ({ data: undefined, isLoading: false, error: null }),
  useCreateProduct: () => ({ mutate: createMutate, isPending: false }),
  useUpdateProduct: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/api/hooks/categories', () => ({
  useCategories: () => ({
    data: [{ id: 'c1', name: 'Tees', slug: 'tees', sortOrder: 0 }],
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
    await user.type(screen.getByLabelText('Description'), 'Nice tee');
    await user.type(screen.getByLabelText('Price (USD)'), '29.99');
    await user.type(screen.getByLabelText('Stock'), '10');
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Tees' }));
    await user.click(screen.getByRole('button', { name: /create product/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      name: 'Tee',
      slug: 'tee',
      priceCents: 2999,
      stockQty: 10,
      categoryId: 'c1',
      active: true,
    });
  });

  it('rejects an invalid price', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText('Name'), 'Tee');
    await user.type(screen.getByLabelText('Description'), 'Nice tee');
    await user.type(screen.getByLabelText('Price (USD)'), '1.999');
    await user.type(screen.getByLabelText('Stock'), '10');
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Tees' }));
    await user.click(screen.getByRole('button', { name: /create product/i }));

    expect(await screen.findByText(/valid price/i)).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });
});
