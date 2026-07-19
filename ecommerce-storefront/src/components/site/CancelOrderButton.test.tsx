import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutateAsync = vi.fn();
vi.mock('@/api/hooks/account', () => ({
  useCancelOrder: () => ({ mutateAsync, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CancelOrderButton } from './CancelOrderButton';

describe('CancelOrderButton', () => {
  beforeEach(() => mutateAsync.mockReset());

  it('is hidden once the order has shipped', () => {
    render(<CancelOrderButton orderId="o1" status="SHIPPED" />);
    expect(screen.queryByRole('button', { name: /cancel order/i })).toBeNull();
  });

  it.each(['PENDING', 'PAID'])('shows for a %s order', (status) => {
    render(<CancelOrderButton orderId="o1" status={status} />);
    expect(screen.getByRole('button', { name: /cancel order/i })).toBeInTheDocument();
  });

  it('calls cancel after confirming in the dialog', async () => {
    mutateAsync.mockResolvedValue({ status: 'PAID', refundId: 're_1' });
    render(<CancelOrderButton orderId="o1" status="PAID" />);
    fireEvent.click(screen.getByRole('button', { name: /cancel order/i }));
    // Dialog now open; confirm button is the destructive "Cancel order" in the footer
    const confirmButtons = screen.getAllByRole('button', { name: /cancel order/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
  });
});
