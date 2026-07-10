import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useMyOrdersMock = vi.fn();

vi.mock('@/api/hooks/account', () => ({
  useMyOrders: () => useMyOrdersMock(),
}));

import OrdersPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrdersPage', () => {
  it('shows the empty state when there are no orders', () => {
    useMyOrdersMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<OrdersPage />);

    expect(screen.getByText('No orders yet.')).toBeInTheDocument();
  });

  it('shows an error state with a retry affordance on failure, not the empty state', async () => {
    const refetchMock = vi.fn();
    useMyOrdersMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('network down'),
      refetch: refetchMock,
    });
    const user = userEvent.setup();
    render(<OrdersPage />);

    expect(
      screen.getByText("We couldn’t load your orders."),
    ).toBeInTheDocument();
    expect(screen.queryByText('No orders yet.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
