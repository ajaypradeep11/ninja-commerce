import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/api/unwrap';

const useOrderMock = vi.fn();

vi.mock('@/api/hooks/account', () => ({
  useOrder: (id: string) => useOrderMock(id),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'order_1' }),
}));

import OrderDetailPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrderDetailPage', () => {
  it('shows the not-found notice for a 404', () => {
    useOrderMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError(404, 'Not found'),
      refetch: vi.fn(),
    });
    render(<OrderDetailPage />);

    expect(
      screen.getByText("We couldn’t find that order."),
    ).toBeInTheDocument();
  });

  it('shows the not-found notice for a 403', () => {
    useOrderMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError(403, 'Forbidden'),
      refetch: vi.fn(),
    });
    render(<OrderDetailPage />);

    expect(
      screen.getByText("We couldn’t find that order."),
    ).toBeInTheDocument();
  });

  it('shows an error state with a retry affordance for other errors', async () => {
    const refetchMock = vi.fn();
    useOrderMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError(500, 'Server error'),
      refetch: refetchMock,
    });
    const user = userEvent.setup();
    render(<OrderDetailPage />);

    expect(
      screen.getByText("We couldn’t load this order."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("We couldn’t find that order."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
