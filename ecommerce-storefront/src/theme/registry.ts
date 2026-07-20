// Single source of truth for available themes. themes.css must have a
// matching [data-theme='<id>'] block per entry (enforced by theme-css.test.ts).
export const THEME_IDS = [
  'everloom',
  'noir',
  'meadow',
  'arcade',
  'atelier',
  'ninja',
  'ninja-light',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'ninja-light';

export const THEME_STORAGE_KEY = 'storefront.theme.v1';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  swatches: { surface: string; brand: string; highlight: string };
  /** Whether the theme is visually dark — drives Sonner's light/dark toast styling. */
  dark: boolean;
}

export const THEMES: readonly ThemeMeta[] = [
  { id: 'everloom', label: 'Everloom', swatches: { surface: '#faf7f2', brand: '#2f4a7a', highlight: '#a64b35' }, dark: false },
  { id: 'noir', label: 'Noir', swatches: { surface: '#12100d', brand: '#c9a25f', highlight: '#d1705a' }, dark: true },
  { id: 'meadow', label: 'Meadow', swatches: { surface: '#f7f5ec', brand: '#3f6b4a', highlight: '#a54a2c' }, dark: false },
  { id: 'arcade', label: 'Arcade', swatches: { surface: '#f4f4f0', brand: '#2244ff', highlight: '#cc0e63' }, dark: false },
  { id: 'atelier', label: 'Atelier', swatches: { surface: '#ffffff', brand: '#2b2b2b', highlight: '#c93a24' }, dark: false },
  { id: 'ninja', label: 'Ninja', swatches: { surface: '#000000', brand: '#ffd84d', highlight: '#e8be8e' }, dark: true },
  { id: 'ninja-light', label: 'Ninja Light', swatches: { surface: '#ffffff', brand: '#a16207', highlight: '#b8452f' }, dark: false },
];

export function resolveTheme(value: unknown): ThemeId {
  return typeof value === 'string' &&
    (THEME_IDS as readonly string[]).includes(value)
    ? (value as ThemeId)
    : DEFAULT_THEME;
}
