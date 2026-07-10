import { render, screen } from '@testing-library/react';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('disables Prev, enables Next, and preserves other params on page 1 of 3', () => {
    render(
      <Pagination
        page={1}
        total={25}
        pageSize={12}
        basePath="/products"
        searchParams={{ category: 'tees' }}
      />,
    );

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Prev' })).not.toBeInTheDocument();
    expect(screen.getByText('Prev')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/products?category=tees&page=2',
    );
  });

  it('enables both Prev and Next on a middle page', () => {
    render(
      <Pagination page={2} total={25} pageSize={12} basePath="/products" searchParams={{}} />,
    );

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prev' })).toHaveAttribute('href', '/products?page=1');
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/products?page=3');
  });

  it('disables Next on the last page', () => {
    render(
      <Pagination page={3} total={25} pageSize={12} basePath="/products" searchParams={{}} />,
    );

    expect(screen.getByRole('link', { name: 'Prev' })).toHaveAttribute('href', '/products?page=2');
    expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByText('Next')).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders null when there is only a single page', () => {
    const { container } = render(
      <Pagination page={1} total={5} pageSize={12} basePath="/products" searchParams={{}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
