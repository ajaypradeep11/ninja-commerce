import type { Metadata, Viewport } from 'next';
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
import { SITE } from '@/lib/site';
import { resolveTheme } from '@/theme/registry';
import { themeInitScript } from '@/theme/init-script';
import '@/api/client';
import './globals.css';
import '@/theme/themes.css';
import { Providers } from './providers';

// One font per theme role per theme (see src/theme/themes.css). next/font
// self-hosts and subsets these at build time. Only the default theme's
// (ninja: Sora/Inter/Plex Mono) three families preload; the rest are declared
// with `preload: false` and load on demand when a non-default theme selects them.
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

const fontVariables = [
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
]
  .map((f) => f.variable)
  .join(' ');

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s — ${SITE.name}` },
  description: SITE.description,
  // Installed-to-home-screen behaviour. iOS ignores the manifest for these,
  // so it needs its own meta tags.
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  // Tints the status bar / browser chrome to match the header.
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme={resolveTheme(process.env.NEXT_PUBLIC_THEME)}
      // The pre-paint init script may swap data-theme before hydration.
      suppressHydrationWarning
      className={fontVariables}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body className="bg-surface font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
