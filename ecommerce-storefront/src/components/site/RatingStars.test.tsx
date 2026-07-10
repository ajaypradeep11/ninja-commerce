import { render, screen } from '@testing-library/react';
import { RatingStars } from './RatingStars';

describe('RatingStars', () => {
  it('renders an aria-label with the rounded rating and review count', () => {
    render(<RatingStars rating={4.33} count={12} />);

    const el = screen.getByLabelText('4.3 out of 5, 12 reviews');
    expect(el).toBeInTheDocument();
  });

  it('fills the correct number of stars for the rounded rating', () => {
    render(<RatingStars rating={4.33} count={12} />);

    const glyphs = screen.getByLabelText('4.3 out of 5, 12 reviews').querySelector('[aria-hidden]');
    expect(glyphs?.textContent).toBe('★★★★☆');
  });

  it('uses singular "review" for a count of 1', () => {
    render(<RatingStars rating={5} count={1} />);
    expect(screen.getByLabelText('5.0 out of 5, 1 review')).toBeInTheDocument();
  });

  it('omits the review count from the label when count is not provided', () => {
    render(<RatingStars rating={3} />);
    expect(screen.getByLabelText('3.0 out of 5')).toBeInTheDocument();
  });

  it('renders nothing when rating is null', () => {
    const { container } = render(<RatingStars rating={null} count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
