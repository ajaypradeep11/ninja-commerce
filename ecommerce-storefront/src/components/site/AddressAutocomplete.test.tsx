import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import type { RetrievedAddress } from '@/lib/addresscomplete';

const findAddressesMock = vi.fn();
const retrieveAddressMock = vi.fn();

vi.mock('@/lib/addresscomplete', () => ({
  findAddresses: (...args: unknown[]) => findAddressesMock(...args),
  retrieveAddress: (...args: unknown[]) => retrieveAddressMock(...args),
}));

import { AddressAutocomplete } from './AddressAutocomplete';

function Harness({ onSelect }: { onSelect: (a: RetrievedAddress) => void }) {
  const { register } = useForm<{ line1: string }>();
  return (
    <AddressAutocomplete
      id="address-line1"
      registration={register('line1')}
      onSelect={onSelect}
    />
  );
}

const SUGGESTION = {
  id: 'CA|1',
  text: '1 Main St',
  description: 'Ottawa, ON, K1A 0B1',
  next: 'Retrieve' as const,
};
const CONTAINER = {
  id: 'CA|2',
  text: '10 Apt Blvd',
  description: '24 addresses',
  next: 'Find' as const,
};
const ADDRESS: RetrievedAddress = {
  line1: '1 Main St',
  city: 'Ottawa',
  province: 'ON',
  postalCode: 'K1A 0B1',
};

beforeEach(() => {
  vi.clearAllMocks();
  findAddressesMock.mockResolvedValue([]);
});

describe('AddressAutocomplete', () => {
  it('does not search under 3 characters', async () => {
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), '1M');
    await new Promise((r) => setTimeout(r, 400));

    expect(findAddressesMock).not.toHaveBeenCalled();
  });

  it('debounces typing into a single Find call and lists suggestions', async () => {
    findAddressesMock.mockResolvedValue([SUGGESTION]);
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), '1 Main');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /1 Main St/ })).toBeInTheDocument(),
    );

    expect(findAddressesMock).toHaveBeenCalledTimes(1);
    expect(findAddressesMock).toHaveBeenCalledWith('1 Main', undefined);
  });

  it('retrieves and reports the address when a suggestion is clicked', async () => {
    findAddressesMock.mockResolvedValue([SUGGESTION]);
    retrieveAddressMock.mockResolvedValue(ADDRESS);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSelect={onSelect} />);

    await user.type(screen.getByRole('combobox'), '1 Main');
    await user.click(
      await screen.findByRole('option', { name: /1 Main St/ }),
    );

    expect(retrieveAddressMock).toHaveBeenCalledWith('CA|1');
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(ADDRESS));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('drills into a container suggestion with a LastId Find instead of retrieving', async () => {
    findAddressesMock
      .mockResolvedValueOnce([CONTAINER])
      .mockResolvedValueOnce([SUGGESTION]);
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), '10 Apt');
    await user.click(
      await screen.findByRole('option', { name: /10 Apt Blvd/ }),
    );

    await screen.findByRole('option', { name: /1 Main St/ });
    expect(findAddressesMock).toHaveBeenLastCalledWith('10 Apt', 'CA|2');
    expect(retrieveAddressMock).not.toHaveBeenCalled();
  });

  it('supports keyboard selection with ArrowDown + Enter', async () => {
    findAddressesMock.mockResolvedValue([SUGGESTION]);
    retrieveAddressMock.mockResolvedValue(ADDRESS);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSelect={onSelect} />);

    await user.type(screen.getByRole('combobox'), '1 Main');
    await screen.findByRole('option', { name: /1 Main St/ });
    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(ADDRESS));
  });

  it('closes the dropdown on Escape and shows nothing when lookups return empty', async () => {
    findAddressesMock.mockResolvedValue([SUGGESTION]);
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    const input = screen.getByRole('combobox');
    await user.type(input, '1 Main');
    await screen.findByRole('option', { name: /1 Main St/ });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Empty results (e.g. no key configured) → no dropdown, typing unblocked.
    findAddressesMock.mockResolvedValue([]);
    await user.type(input, ' more');
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('cancels a pending debounce on Escape so the dropdown does not reopen', async () => {
    findAddressesMock.mockResolvedValueOnce([SUGGESTION]);
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    const input = screen.getByRole('combobox');
    await user.type(input, '1 Main');
    await screen.findByRole('option', { name: /1 Main St/ });

    // Continue typing (re-arms the debounce), then dismiss before it fires.
    findAddressesMock.mockResolvedValueOnce([SUGGESTION]);
    await user.type(input, ' St');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    // The debounce armed by the post-open typing must never have fired.
    expect(findAddressesMock).toHaveBeenCalledTimes(1);
  });

  it('sets aria-activedescendant to the active option after ArrowDown', async () => {
    findAddressesMock.mockResolvedValue([SUGGESTION]);
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    const input = screen.getByRole('combobox');
    await user.type(input, '1 Main');
    const option = await screen.findByRole('option', { name: /1 Main St/ });

    expect(input).not.toHaveAttribute('aria-activedescendant');
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', option.id);
  });
});
