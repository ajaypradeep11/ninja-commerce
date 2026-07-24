import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AddressDto } from '@/api/generated';

const useMeMock = vi.fn();
const mutateMock = vi.fn();
vi.mock('@/api/hooks/account', () => ({
  useMe: () => useMeMock(),
  useUpdateAddresses: () => ({ mutate: mutateMock, isPending: false }),
}));
const useAuthMock = vi.fn();
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock('@/lib/addresscomplete', () => ({
  findAddresses: vi.fn().mockResolvedValue([]),
  retrieveAddress: vi.fn(),
}));

import { ShipToSelector } from './ShipToSelector';

const HOME: AddressDto = {
  name: 'Riley Shopper',
  label: 'Home',
  line1: '1 Main St',
  city: 'Ottawa',
  state: 'ON',
  postalCode: 'K1A 0B1',
  country: 'CA',
};
const WORK: AddressDto = {
  label: 'Work',
  line1: '2 Market St',
  city: 'Toronto',
  state: 'ON',
  postalCode: 'M5V 2T6',
  country: 'CA',
};

function makeMe(addresses: AddressDto[]) {
  return { data: { id: 'u1', email: 's@example.com', role: 'CUSTOMER', addresses, createdAt: '', updatedAt: '' } };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthMock.mockReturnValue({ user: { uid: 'u1' } });
});

describe('ShipToSelector', () => {
  it('renders nothing when signed out', () => {
    useAuthMock.mockReturnValue({ user: null });
    useMeMock.mockReturnValue({ data: undefined });
    const { container } = render(
      <ShipToSelector selected={null} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('preselects the first saved address', async () => {
    useMeMock.mockReturnValue(makeMe([HOME, WORK]));
    const onSelect = vi.fn();
    render(<ShipToSelector selected={null} onSelect={onSelect} />);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(HOME));
  });

  it('lets the shopper pick a different address', async () => {
    useMeMock.mockReturnValue(makeMe([HOME, WORK]));
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ShipToSelector selected={HOME} onSelect={onSelect} />);

    expect(screen.getByRole('radio', { name: /1 Main St/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /2 Market St/ }));
    expect(onSelect).toHaveBeenCalledWith(WORK);
  });

  it('adds a new address through the shared form and selects it', async () => {
    useMeMock.mockReturnValue(makeMe([]));
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ShipToSelector selected={null} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Add address' }));
    await user.type(screen.getByLabelText('Address Line 1'), '3 New St');
    await user.type(screen.getByLabelText('City'), 'Kanata');
    await user.type(screen.getByLabelText('Postal code'), 'K2L 1T9');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    expect(mutateMock.mock.calls[0][0]).toHaveLength(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ line1: '3 New St', postalCode: 'K2L 1T9' }),
    );
  });
});
