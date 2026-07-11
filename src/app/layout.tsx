import type { Metadata } from 'next';
import {
  Bricolage_Grotesque,
  Public_Sans,
  IBM_Plex_Mono,
} from 'next/font/google';
import { SITE } from '@/lib/site';
import '@/api/client';
import './globals.css';
import '@/theme/themes.css';
import { Providers } from './providers';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
});
const sans = Public_Sans({ subsets: ['latin'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

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
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="bg-surface font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
