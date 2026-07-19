import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const createMutate = vi.fn();
vi.mock('@/api/hooks/coupons', () => ({
  useCoupons: () => ({
    data: [
      {
        id: 'c1',
        code: 'SAVE10',
        type: 'PERCENT',
        value: 10,
        active: true,
        redemptionCount: 3,
      },
      {
        id: 'c2',
        code: 'FIVE-OFF',
        type: 'FIXED',
        value: 500,
        active: false,
        redemptionCount: 0,
      },
    ],
    isLoading: false,
    error: null,
  }),
  useCreateCoupon: () => ({ mutate: createMutate, isPending: false }),
  useUpdateCoupon: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCoupon: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { CouponsPage } from './index';

describe('CouponsPage', () => {
  it('lists coupons with discount labels and redemption counts', () => {
    render(<CouponsPage />);
    expect(screen.getByText('SAVE10')).toBeInTheDocument();
    expect(screen.getByText('10% off')).toBeInTheDocument();
    expect(screen.getByText('FIVE-OFF')).toBeInTheDocument();
    expect(screen.getByText('$5.00 off')).toBeInTheDocument();
    expect(screen.getByText(/3 redemptions/)).toBeInTheDocument();
  });

  it('creates a percent coupon with an uppercased code', async () => {
    const user = userEvent.setup();
    render(<CouponsPage />);
    await user.type(screen.getByPlaceholderText('CODE'), 'welcome10');
    await user.type(screen.getByPlaceholderText('10'), '10');
    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(createMutate).toHaveBeenCalledWith(
      { code: 'WELCOME10', type: 'PERCENT', value: 10 },
      expect.anything(),
    );
  });
});
