import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEMES, THEME_STORAGE_KEY } from '@/theme/registry';
import { ThemeSwitcher } from './ThemeSwitcher';

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute('data-theme', 'everloom');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders one labeled button per theme', () => {
    render(<ThemeSwitcher />);
    for (const t of THEMES) {
      expect(
        screen.getByRole('button', { name: `Switch to ${t.label} theme` }),
      ).toBeInTheDocument();
    }
  });

  it('marks the current theme as pressed', () => {
    render(<ThemeSwitcher />);
    expect(
      screen.getByRole('button', { name: 'Switch to Everloom theme' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies and persists a theme on click', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(
      screen.getByRole('button', { name: 'Switch to Ninja theme' }),
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('ninja');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('ninja');
    expect(
      screen.getByRole('button', { name: 'Switch to Ninja theme' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders nothing when NEXT_PUBLIC_SHOW_THEME_SWITCHER=false', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_THEME_SWITCHER', 'false');
    const { container } = render(<ThemeSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });
});
