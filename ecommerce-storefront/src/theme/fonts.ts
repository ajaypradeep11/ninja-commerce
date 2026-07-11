import {
  Archivo,
  Bricolage_Grotesque,
  Cormorant_Garamond,
  Fraunces,
  IBM_Plex_Mono,
  Inter,
  Karla,
  Libre_Caslon_Text,
  Nunito_Sans,
  Public_Sans,
  Sora,
  Space_Grotesk,
} from 'next/font/google';

/*
 * Font config — the single place to add or swap fonts.
 *
 * To add a font for your theme:
 *   1. Import its loader from 'next/font/google' above.
 *   2. Call it below with `variable: '--font-<name>'`, `subsets: ['latin']`,
 *      explicit `weight` if the family is not a variable font, and
 *      `preload: false` unless your DEFAULT theme uses it (preloading
 *      every family costs ~30KB+ of font bytes per page each).
 *   3. Add the const to THEME_FONTS, then point a theme at it in
 *      src/theme/themes.css: `--font-display: var(--font-<name>)`.
 *
 * next/font requires these calls to be static and module-scope — they are
 * compiled away at build time, which is why this file is code, not JSON.
 * src/theme/fonts.test.ts fails the suite if this file and themes.css
 * drift (unloaded reference or unused loader). Keep loaders as top-level
 * `const` (export is fine); `variable:` as a quoted literal for sync-test guard.
 */
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', preload: false });
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans', preload: false });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cormorant', preload: false });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', preload: false });
const nunitoSans = Nunito_Sans({ subsets: ['latin'], variable: '--font-nunito-sans', preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', preload: false });
const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo', preload: false });
const caslon = Libre_Caslon_Text({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-caslon', preload: false });
const karla = Karla({ subsets: ['latin'], variable: '--font-karla', preload: false });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });

export const THEME_FONTS = [
  bricolage,
  publicSans,
  plexMono,
  cormorant,
  inter,
  fraunces,
  nunitoSans,
  spaceGrotesk,
  archivo,
  caslon,
  karla,
  sora,
] as const;

// Joined className that exposes every font's CSS variable on <html>.
// Module-scope constant → stable across server render and hydration.
export const fontVariables = THEME_FONTS.map((f) => f.variable).join(' ');
