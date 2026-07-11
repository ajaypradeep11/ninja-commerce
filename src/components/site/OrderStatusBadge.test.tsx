import { render, screen } from '@testing-library/react';
import { OrderStatusBadge } from './OrderStatusBadge';

describe('OrderStatusBadge', () => {
  it('renders PENDING as "Awaiting payment" in ink/60', () => {
    render(<OrderStatusBadge status="PENDING" />);
    const badge = screen.getByText('Awaiting payment');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-ink/60');
  });

  it('renders PAID as "Paid" ink-on-subtle', () => {
    render(<OrderStatusBadge status="PAID" />);
    const badge = screen.getByText('Paid');
    expect(badge).toHaveClass('bg-subtle');
    expect(badge).toHaveClass('text-ink');
  });

  it('renders SHIPPED as "Shipped" ink-on-subtle', () => {
    render(<OrderStatusBadge status="SHIPPED" />);
    const badge = screen.getByText('Shipped');
    expect(badge).toHaveClass('bg-subtle');
    expect(badge).toHaveClass('text-ink');
  });

  it('renders DELIVERED as "Delivered" ink-on-subtle', () => {
    render(<OrderStatusBadge status="DELIVERED" />);
    const badge = screen.getByText('Delivered');
    expect(badge).toHaveClass('bg-subtle');
    expect(badge).toHaveClass('text-ink');
  });

  it('renders CANCELLED as "Cancelled" in ink/40', () => {
    render(<OrderStatusBadge status="CANCELLED" />);
    const badge = screen.getByText('Cancelled');
    expect(badge).toHaveClass('text-ink/40');
  });

  it('renders REFUNDED as "Refunded" in highlight', () => {
    render(<OrderStatusBadge status="REFUNDED" />);
    const badge = screen.getByText('Refunded');
    expect(badge).toHaveClass('text-highlight');
  });
});
