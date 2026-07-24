import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { CurrencySwitcher } from './CurrencySwitcher';

beforeEach(() => {
  vi.clearAllMocks();
  document.cookie = 'localninja.currency=; max-age=0; path=/';
});

const trigger = () => screen.getByRole('button', { name: /^Currency:/ });

it('shows the active currency on the trigger', () => {
  render(<CurrencySwitcher current="CAD" />);
  expect(trigger()).toHaveAccessibleName('Currency: Canada (CAD $)');
});

it('keeps the menu closed until the trigger is clicked', async () => {
  const user = userEvent.setup();
  render(<CurrencySwitcher current="CAD" />);

  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  await user.click(trigger());
  expect(screen.getByRole('menu')).toBeInTheDocument();
});

it('writes the chosen currency to the cookie and refreshes', async () => {
  const user = userEvent.setup();
  render(<CurrencySwitcher current="CAD" />);

  await user.click(trigger());
  await user.click(screen.getByRole('menuitemradio', { name: /United States/ }));

  expect(document.cookie).toContain('localninja.currency=USD');
  expect(refreshMock).toHaveBeenCalled();
});

it('marks the active option as checked', async () => {
  const user = userEvent.setup();
  render(<CurrencySwitcher current="USD" />);

  await user.click(trigger());

  expect(
    screen.getByRole('menuitemradio', { name: /United States/ }),
  ).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('menuitemradio', { name: /Canada/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
});

it('does not refresh when the already-active currency is re-picked', async () => {
  const user = userEvent.setup();
  render(<CurrencySwitcher current="CAD" />);

  await user.click(trigger());
  await user.click(screen.getByRole('menuitemradio', { name: /Canada/ }));

  // Re-selecting what is already active is a no-op — refreshing would throw the
  // rendered page away for nothing.
  expect(refreshMock).not.toHaveBeenCalled();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('closes on Escape without changing currency', async () => {
  const user = userEvent.setup();
  render(<CurrencySwitcher current="CAD" />);

  await user.click(trigger());
  await user.keyboard('{Escape}');

  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(refreshMock).not.toHaveBeenCalled();
});
