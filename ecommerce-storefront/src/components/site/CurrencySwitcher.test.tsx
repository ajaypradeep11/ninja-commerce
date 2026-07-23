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

it('writes the chosen currency to the cookie and refreshes', async () => {
  const user = userEvent.setup();
  render(<CurrencySwitcher current="CAD" />);

  await user.click(screen.getByRole('button', { name: 'USD $' }));

  expect(document.cookie).toContain('localninja.currency=USD');
  expect(refreshMock).toHaveBeenCalled();
});

it('marks the active currency as pressed', () => {
  render(<CurrencySwitcher current="USD" />);
  expect(screen.getByRole('button', { name: 'USD $' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'CAD $' })).toHaveAttribute('aria-pressed', 'false');
});
