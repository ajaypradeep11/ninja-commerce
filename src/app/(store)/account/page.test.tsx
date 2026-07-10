import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useMeMock = vi.fn();
const signOutUserMock = vi.fn();
const pushMock = vi.fn();

vi.mock('@/api/hooks/account', () => ({
  useMe: () => useMeMock(),
}));
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ signOutUser: signOutUserMock }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock('@/components/site/AddressManager', () => ({
  AddressManager: () => null,
}));

import AccountPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountPage', () => {
  it('shows an error state with a retry affordance when /me fails', async () => {
    const refetchMock = vi.fn();
    useMeMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('network down'),
      refetch: refetchMock,
    });
    const user = userEvent.setup();
    render(<AccountPage />);

    expect(
      screen.getByText("We couldn’t load your account."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
