import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/**
 * Web app manifest — what lets a shopper save the storefront to their home
 * screen and launch it fullscreen. Served at /manifest.webmanifest.
 *
 * Colours mirror the site: white page background, black status bar to match
 * the header. Icons are opaque (both platforms flatten alpha to black, and
 * the mascot is black).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — Anime LED Lamps`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        // Android crops adaptive icons to a circle; this one has a safe margin.
        src: '/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Shop all', url: '/products' },
      { name: 'New arrivals', url: '/products?sort=newest' },
      { name: 'Best sellers', url: '/products?sort=best_selling' },
    ],
  };
}
