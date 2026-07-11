'use client';

import { useEffect, useState } from 'react';
import {
  THEMES,
  THEME_STORAGE_KEY,
  resolveTheme,
  type ThemeId,
} from '@/theme/registry';

// Live theme preview for the showcase deployment. Real stores hide it with
// NEXT_PUBLIC_SHOW_THEME_SWITCHER=false (see THEMING.md).
export function ThemeSwitcher() {
  // null until mounted — SSR doesn't know the visitor's stored theme.
  const [active, setActive] = useState<ThemeId | null>(null);

  useEffect(() => {
    setActive(resolveTheme(document.documentElement.getAttribute('data-theme')));
  }, []);

  if (process.env.NEXT_PUBLIC_SHOW_THEME_SWITCHER === 'false') return null;

  const apply = (id: ThemeId) => {
    document.documentElement.setAttribute('data-theme', id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // Private mode: attribute-only switch still works for the session.
    }
    setActive(id);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">
        Theme
      </span>
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-label={`Switch to ${t.label} theme`}
          aria-pressed={active === t.id}
          title={t.label}
          onClick={() => apply(t.id)}
          className={`size-5 rounded-full border border-ink/30 transition-shadow ${
            active === t.id ? 'ring-2 ring-brand ring-offset-1' : 'hover:ring-1 hover:ring-ink/40'
          }`}
          style={{
            background: `conic-gradient(${t.swatches.surface} 0 50%, ${t.swatches.brand} 50% 80%, ${t.swatches.highlight} 80% 100%)`,
          }}
        />
      ))}
    </div>
  );
}
