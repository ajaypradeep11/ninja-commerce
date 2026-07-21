import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutateAsync = vi.fn();
vi.mock('@/api/hooks/account', () => ({
  useRequestReturn: () => ({ mutateAsync, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { RequestReturnButton } from './RequestReturnButton';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe('RequestReturnButton', () => {
  beforeEach(() => mutateAsync.mockReset());

  it('is hidden for a non-delivered order', () => {
    render(
      <RequestReturnButton
        orderId="o1"
        status="SHIPPED"
        deliveredAt={null}
        returnRequestedAt={null}
      />,
    );
    expect(screen.queryByRole('button', { name: /return this order/i })).toBeNull();
  });

  it('shows for a recently delivered order', () => {
    render(
      <RequestReturnButton
        orderId="o1"
        status="DELIVERED"
        deliveredAt={daysAgo(5)}
        returnRequestedAt={null}
      />,
    );
    expect(
      screen.getByRole('button', { name: /return this order/i }),
    ).toBeInTheDocument();
  });

  it('is hidden once the 30-day window has closed', () => {
    render(
      <RequestReturnButton
        orderId="o1"
        status="DELIVERED"
        deliveredAt={daysAgo(31)}
        returnRequestedAt={null}
      />,
    );
    expect(screen.queryByRole('button', { name: /return this order/i })).toBeNull();
  });

  it('shows a confirmation instead of the button once a return is requested', () => {
    render(
      <RequestReturnButton
        orderId="o1"
        status="DELIVERED"
        deliveredAt={daysAgo(5)}
        returnRequestedAt={daysAgo(1)}
      />,
    );
    expect(screen.queryByRole('button', { name: /return this order/i })).toBeNull();
    expect(screen.getByText(/return requested on/i)).toBeInTheDocument();
  });

  it('calls requestReturn with the typed reason after confirming', async () => {
    mutateAsync.mockResolvedValue({});
    render(
      <RequestReturnButton
        orderId="o1"
        status="DELIVERED"
        deliveredAt={daysAgo(5)}
        returnRequestedAt={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /return this order/i }));
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'Wrong size' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^request return$/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith('Wrong size'));
  });
});
