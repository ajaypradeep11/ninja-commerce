import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('renders bold, italic, and lists as formatted elements', () => {
    const { container } = render(
      <Markdown>{'**Bold** and *italic*\n\n- one\n- two'}</Markdown>,
    );
    expect(container.querySelector('strong')?.textContent).toBe('Bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders headings and links (links open safely in a new tab)', () => {
    const { container } = render(
      <Markdown>{'## Specs\n\n[site](https://example.com)'}</Markdown>,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Specs');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('does not render raw HTML (XSS-safe)', () => {
    const { container } = render(
      <Markdown>{'<img src=x onerror=alert(1)>hello'}</Markdown>,
    );
    // The raw <img> is not injected as an element; it stays inert text.
    expect(container.querySelector('img')).toBeNull();
  });
});
