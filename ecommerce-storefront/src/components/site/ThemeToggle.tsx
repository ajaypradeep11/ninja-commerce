'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY, resolveTheme, type ThemeId } from '@/theme/registry';

/**
 * Dark/light switch: toggles between the ninja (dark) and ninja-light themes.
 * Reads the live data-theme after mount so SSR markup stays theme-agnostic.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeId | null>(null);

  useEffect(() => {
    setTheme(resolveTheme(document.documentElement.dataset.theme));
  }, []);

  const isDark = theme === 'ninja';

  function toggle() {
    const next: ThemeId = isDark ? 'ninja-light' : 'ninja';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode etc. — theme still applies for this page */
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-1.5 text-ink hover:text-brand"
    >
      {isDark ? (
        <Sun aria-hidden className="size-5" />
      ) : (
        <Moon aria-hidden className="size-5" />
      )}
    </button>
  );
}
