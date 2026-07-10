import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const createMutate = vi.fn();
vi.mock('@/api/hooks/categories', () => ({
  useCategories: () => ({
    data: [
      { id: 'c1', name: 'Tees', slug: 'tees', sortOrder: 0 },
      { id: 'c2', name: 'Hoodies', slug: 'hoodies', sortOrder: 1 },
    ],
    isLoading: false,
    error: null,
  }),
  useCreateCategory: () => ({ mutate: createMutate, isPending: false }),
  useUpdateCategory: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCategory: () => ({ mutate: vi.fn(), isPending: false }),
  useReorderCategories: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { CategoriesPage } from './index';

describe('CategoriesPage', () => {
  it('lists categories', () => {
    render(<CategoriesPage />);
    expect(screen.getByText('Tees')).toBeInTheDocument();
    expect(screen.getByText('Hoodies')).toBeInTheDocument();
  });

  it('creates a category with an auto-generated slug', async () => {
    const user = userEvent.setup();
    render(<CategoriesPage />);
    await user.type(
      screen.getByPlaceholderText('New category name'),
      'Winter Wear',
    );
    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Winter Wear', slug: 'winter-wear' }),
      expect.anything(),
    );
  });
});
