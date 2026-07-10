import { render, screen } from '@testing-library/react';
import { StockLine } from './StockLine';

describe('StockLine', () => {
  it('shows "Out of stock" when stockQty is 0', () => {
    render(<StockLine stockQty={0} />);
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('shows "Only N left" when stockQty is between 1 and 5', () => {
    render(<StockLine stockQty={3} />);
    expect(screen.getByText('Only 3 left')).toBeInTheDocument();
  });

  it('shows "In stock" when stockQty is comfortably above the low-stock threshold', () => {
    render(<StockLine stockQty={40} />);
    expect(screen.getByText('In stock')).toBeInTheDocument();
  });
});
