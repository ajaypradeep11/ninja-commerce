import type { Metadata } from 'next';
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
// self-hosts and subsets these at build time; unused families cost nothing
// at runtime beyond their @font-face declarations.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' });
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cormorant' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' });
const nunitoSans = Nunito_Sans({ subsets: ['latin'], variable: '--font-nunito-sans' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo' });
const caslon = Libre_Caslon_Text({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-caslon' });
const karla = Karla({ subsets: ['latin'], variable: '--font-karla' });
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
      <body className="bg-surface font-sans text-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
