import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
const US_ADDRESS: AddressDto = {
  label: 'Old US address',
  line1: '99 Broadway',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'US',
};

function makeMe(addresses: AddressDto[]) {
  return { data: { id: 'u1', email: 's@example.com', role: 'CUSTOMER', addresses, createdAt: '', updatedAt: '' } };
}

// Controlled-component harness mirroring how cart/page.tsx owns `shipTo`
// state — needed to exercise selection round-trips (click/arrow key -> a
// re-render with the new `selected` prop) rather than just the callback arg.
function ControlledSelector({ initial }: { initial: AddressDto | null }) {
  const [selected, setSelected] = useState<AddressDto | null>(initial);
  return <ShipToSelector selected={selected} onSelect={setSelected} />;
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

  it('excludes non-CA addresses and preselects a CA one even if it comes first in the list', async () => {
    useMeMock.mockReturnValue(makeMe([US_ADDRESS, HOME]));
    const onSelect = vi.fn();
    render(<ShipToSelector selected={null} onSelect={onSelect} />);

    expect(screen.queryByText(/99 Broadway/)).not.toBeInTheDocument();
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

  it('checks exactly one radio when two saved addresses are identical', async () => {
    // Same line1/postalCode/label on both — a content-based key would give
    // them the same identity and (with the old aria-checked-by-key logic)
    // both would render checked at once.
    const DUP_A: AddressDto = { ...HOME };
    const DUP_B: AddressDto = { ...HOME };
    useMeMock.mockReturnValue(makeMe([DUP_A, DUP_B]));
    const user = userEvent.setup();
    render(<ControlledSelector initial={null} />);

    const radios = await screen.findAllByRole('radio', { name: /1 Main St/ });
    expect(radios).toHaveLength(2);
    await waitFor(() => expect(radios[0]).toBeChecked());

    await user.click(radios[1]);

    expect(radios[1]).toBeChecked();
    expect(radios[0]).not.toBeChecked();
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
  });

  it('moves selection with the arrow keys like a native radio group', async () => {
    useMeMock.mockReturnValue(makeMe([HOME, WORK]));
    const user = userEvent.setup();
    render(<ControlledSelector initial={null} />);

    const home = await screen.findByRole('radio', { name: /1 Main St/ });
    const work = screen.getByRole('radio', { name: /2 Market St/ });
    await waitFor(() => expect(home).toBeChecked());

    home.focus();
    await user.keyboard('{ArrowDown}');

    expect(work).toBeChecked();
    expect(home).not.toBeChecked();
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
  });
});
