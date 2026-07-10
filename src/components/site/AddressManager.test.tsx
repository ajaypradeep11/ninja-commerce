import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AddressDto, UserResponseDto } from '@/api/generated';

const useMeMock = vi.fn();
const mutateMock = vi.fn();

vi.mock('@/api/hooks/account', () => ({
  useMe: () => useMeMock(),
  useUpdateAddresses: () => ({ mutate: mutateMock, isPending: false }),
}));

import { AddressManager } from './AddressManager';

function makeUser(addresses: AddressDto[]): UserResponseDto {
  return {
    id: 'user_1',
    email: 'shopper@example.com',
    role: 'CUSTOMER',
    addresses,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const ADDR_1: AddressDto = {
  label: 'Home',
  line1: '1 Main St',
  city: 'Springfield',
  postalCode: '12345',
  country: 'US',
};
const ADDR_2: AddressDto = {
  label: 'Work',
  line1: '2 Market St',
  city: 'Metropolis',
  postalCode: '54321',
  country: 'US',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddressManager', () => {
  it('renders a card for each saved address', () => {
    useMeMock.mockReturnValue({ data: makeUser([ADDR_1, ADDR_2]) });
    render(<AddressManager />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('1 Main St')).toBeInTheDocument();
    expect(screen.getByText('2 Market St')).toBeInTheDocument();
  });

  it('shows the empty-state copy when there are no saved addresses', () => {
    useMeMock.mockReturnValue({ data: makeUser([]) });
    render(<AddressManager />);

    expect(
      screen.getByText(
        'No saved addresses yet. Add one to speed up future orders.',
      ),
    ).toBeInTheDocument();
  });

  it('submits the whole next array (length 3) when adding a new address', async () => {
    useMeMock.mockReturnValue({ data: makeUser([ADDR_1, ADDR_2]) });
    const user = userEvent.setup();
    render(<AddressManager />);

    await user.click(screen.getByRole('button', { name: 'Add address' }));
    await user.type(screen.getByLabelText('Line 1'), '3 New St');
    await user.type(screen.getByLabelText('City'), 'Gotham');
    await user.type(screen.getByLabelText('Postal code'), '99999');
    await user.type(screen.getByLabelText('Country'), 'us');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const payload = mutateMock.mock.calls[0][0] as AddressDto[];
    expect(payload).toHaveLength(3);
    expect(payload[2]).toMatchObject({
      line1: '3 New St',
      city: 'Gotham',
      postalCode: '99999',
      country: 'US',
    });
  });

  it('submits the whole next array (length 1) after confirming a delete', async () => {
    useMeMock.mockReturnValue({ data: makeUser([ADDR_1, ADDR_2]) });
    const user = userEvent.setup();
    render(<AddressManager />);

    const homeCard = screen
      .getByText('Home')
      .closest('[data-testid="address-card"]');
    expect(homeCard).not.toBeNull();
    const card = within(homeCard as HTMLElement);

    await user.click(card.getByRole('button', { name: 'Delete' }));
    await user.click(card.getByRole('button', { name: 'Confirm' }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const payload = mutateMock.mock.calls[0][0] as AddressDto[];
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({ label: 'Work' });
  });

  it('rejects a 3-letter country code with the exact message and does not submit', async () => {
    useMeMock.mockReturnValue({ data: makeUser([]) });
    const user = userEvent.setup();
    render(<AddressManager />);

    await user.click(screen.getByRole('button', { name: 'Add address' }));
    await user.type(screen.getByLabelText('Line 1'), '3 New St');
    await user.type(screen.getByLabelText('City'), 'Gotham');
    await user.type(screen.getByLabelText('Postal code'), '99999');
    await user.type(screen.getByLabelText('Country'), 'USA');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Use a 2-letter country code'),
    ).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
