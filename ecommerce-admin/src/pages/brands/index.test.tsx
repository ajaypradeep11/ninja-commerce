import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// The logo upload control pulls in the Firebase app; keep tests offline.
vi.mock('@/auth/firebase', () => ({ storage: {} }));

const createMutate = vi.fn();
vi.mock('@/api/hooks/brands', () => ({
  useBrands: () => ({
    data: [
      { id: 'b1', name: 'Naruto', slug: 'naruto', sortOrder: 0 },
      { id: 'b2', name: 'Attack on Titan', slug: 'attack-on-titan', sortOrder: 1 },
    ],
    isLoading: false,
    error: null,
  }),
  useCreateBrand: () => ({ mutate: createMutate, isPending: false }),
  useUpdateBrand: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteBrand: () => ({ mutate: vi.fn(), isPending: false }),
  useReorderBrands: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { BrandsPage } from './index';

describe('BrandsPage', () => {
  it('lists brands', () => {
    render(<BrandsPage />);
    expect(screen.getByText('Naruto')).toBeInTheDocument();
    expect(screen.getByText('Attack on Titan')).toBeInTheDocument();
  });

  it('creates a brand with an auto-generated slug', async () => {
    const user = userEvent.setup();
    render(<BrandsPage />);
    await user.type(
      screen.getByPlaceholderText('New brand name'),
      'Chainsaw Man',
    );
    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Chainsaw Man', slug: 'chainsaw-man' }),
      expect.anything(),
    );
  });
});
