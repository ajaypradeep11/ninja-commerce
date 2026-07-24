import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const useShippingSettingsMock = vi.fn();
const mutateMock = vi.fn();
vi.mock('@/api/hooks/settings', () => ({
  useShippingSettings: () => useShippingSettingsMock(),
  useUpdateShippingSettings: () => ({ mutate: mutateMock, isPending: false }),
}));

import { SettingsPage } from './index';

beforeEach(() => {
  vi.clearAllMocks();
  useShippingSettingsMock.mockReturnValue({
    data: {
      freeShippingThresholdCents: 6500,
      standardShippingCents: 999,
      expeditedShippingCents: 1499,
    },
    isLoading: false,
    error: null,
  });
});

describe('SettingsPage', () => {
  it('shows the stored values in dollars', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText('Free shipping threshold (CAD)')).toHaveValue(65);
    expect(screen.getByLabelText('Standard shipping fee (CAD)')).toHaveValue(9.99);
    expect(screen.getByLabelText('Expedited shipping fee (CAD)')).toHaveValue(14.99);
  });

  it('submits the edited values as cents', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const standard = screen.getByLabelText('Standard shipping fee (CAD)');
    await user.clear(standard);
    await user.type(standard, '10.49');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    expect(mutateMock.mock.calls[0][0]).toEqual({
      freeShippingThresholdCents: 6500,
      standardShippingCents: 1049,
      expeditedShippingCents: 1499,
    });
  });

  it('accepts a value with 2 decimals that is not exactly representable in floating point', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const standard = screen.getByLabelText('Standard shipping fee (CAD)');
    await user.clear(standard);
    await user.type(standard, '10.20');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    expect(mutateMock.mock.calls[0][0]).toEqual({
      freeShippingThresholdCents: 6500,
      standardShippingCents: 1020,
      expeditedShippingCents: 1499,
    });
    expect(screen.queryByText(/max 2 decimals/i)).not.toBeInTheDocument();
  });

  it('rejects negative values', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const standard = screen.getByLabelText('Standard shipping fee (CAD)');
    await user.clear(standard);
    await user.type(standard, '-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/must be 0 or more/i)).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('rejects values with more than 2 decimals', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const standard = screen.getByLabelText('Standard shipping fee (CAD)');
    await user.clear(standard);
    await user.type(standard, '10.999');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/max 2 decimals/i)).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
