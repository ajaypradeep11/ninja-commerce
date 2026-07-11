import { THEME_IDS, THEME_STORAGE_KEY } from './registry';

// Inlined into <head> before hydration so a stored theme applies pre-paint
// (no flash of the default theme). Must stay dependency-free and ES5-safe.
export function themeInitScript(): string {
  const ids = JSON.stringify(THEME_IDS);
  const key = JSON.stringify(THEME_STORAGE_KEY);
  return `(function(){try{var t=localStorage.getItem(${key});if(t&&${ids}.indexOf(t)!==-1){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
}
