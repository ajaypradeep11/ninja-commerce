import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AddressDto, UserResponseDto } from '@/api/generated';

const useMeMock = vi.fn();
const mutateMock = vi.fn();
const useUpdateAddressesMock = vi.fn();

vi.mock('@/api/hooks/account', () => ({
  useMe: () => useMeMock(),
  useUpdateAddresses: () => useUpdateAddressesMock(),
}));

const findAddressesMock = vi.fn();
const retrieveAddressMock = vi.fn();

vi.mock('@/lib/addresscomplete', () => ({
  findAddresses: (...args: unknown[]) => findAddressesMock(...args),
  retrieveAddress: (...args: unknown[]) => retrieveAddressMock(...args),
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
  city: 'Ottawa',
  state: 'ON',
  postalCode: 'K1A 0B1',
  country: 'CA',
};
const ADDR_2: AddressDto = {
  label: 'Work',
  line1: '2 Market St',
  city: 'Toronto',
  state: 'ON',
  postalCode: 'M5V 2T6',
  country: 'CA',
};

beforeEach(() => {
  vi.clearAllMocks();
  findAddressesMock.mockResolvedValue([]);
  useUpdateAddressesMock.mockReturnValue({
    mutate: mutateMock,
    isPending: false,
  });
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
    await user.type(screen.getByLabelText('City'), 'Kanata');
    await user.type(screen.getByLabelText('Province'), 'ON');
    await user.type(screen.getByLabelText('Postal code'), 'k2l1t9');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const payload = mutateMock.mock.calls[0][0] as AddressDto[];
    expect(payload).toHaveLength(3);
    expect(payload[2]).toMatchObject({
      line1: '3 New St',
      city: 'Kanata',
      state: 'ON',
      postalCode: 'K2L 1T9',
      country: 'CA',
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

  it('rejects a non-Canadian postal code with the exact message and does not submit', async () => {
    useMeMock.mockReturnValue({ data: makeUser([]) });
    const user = userEvent.setup();
    render(<AddressManager />);

    await user.click(screen.getByRole('button', { name: 'Add address' }));
    await user.type(screen.getByLabelText('Line 1'), '3 New St');
    await user.type(screen.getByLabelText('City'), 'Gotham');
    await user.type(screen.getByLabelText('Postal code'), '99999');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Enter a Canadian postal code (A1A 1A1).'),
    ).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('shows the country as fixed Canada with no editable input', async () => {
    useMeMock.mockReturnValue({ data: makeUser([]) });
    const user = userEvent.setup();
    render(<AddressManager />);

    await user.click(screen.getByRole('button', { name: 'Add address' }));
    const country = screen.getByLabelText('Country');
    expect(country).toHaveValue('Canada');
    expect(country).toHaveAttribute('readonly');
  });

  it('disables all mutating controls while an update is in flight', () => {
    useUpdateAddressesMock.mockReturnValue({
      mutate: mutateMock,
      isPending: true,
    });
    useMeMock.mockReturnValue({ data: makeUser([ADDR_1, ADDR_2]) });
    render(<AddressManager />);

    expect(screen.getByRole('button', { name: 'Add address' })).toBeDisabled();

    const homeCard = screen
      .getByText('Home')
      .closest('[data-testid="address-card"]');
    expect(homeCard).not.toBeNull();
    const card = within(homeCard as HTMLElement);

    expect(card.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(card.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('fills city, province, and postal code when an autocomplete suggestion is chosen', async () => {
    useMeMock.mockReturnValue({ data: makeUser([]) });
    findAddressesMock.mockResolvedValue([
      {
        id: 'CA|1',
        text: '1 Main St',
        description: 'Ottawa, ON, K1A 0B1',
        next: 'Retrieve',
      },
    ]);
    retrieveAddressMock.mockResolvedValue({
      line1: '1 Main St',
      city: 'Ottawa',
      province: 'ON',
      postalCode: 'K1A 0B1',
    });
    const user = userEvent.setup();
    render(<AddressManager />);

    await user.click(screen.getByRole('button', { name: 'Add address' }));
    await user.type(screen.getByLabelText('Line 1'), '1 Main');
    await user.click(await screen.findByRole('option', { name: /1 Main St/ }));

    await waitFor(() =>
      expect(screen.getByLabelText('Postal code')).toHaveValue('K1A 0B1'),
    );
    expect(screen.getByLabelText('Line 1')).toHaveValue('1 Main St');
    expect(screen.getByLabelText('City')).toHaveValue('Ottawa');
    expect(screen.getByLabelText('Province')).toHaveValue('ON');
  });
});
