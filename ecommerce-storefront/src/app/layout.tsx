import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { resolveTheme } from '@/theme/registry';
import { themeInitScript } from '@/theme/init-script';
import { fontVariables } from '@/theme/fonts';
import '@/api/client';
import './globals.css';
import '@/theme/themes.css';
import { Providers } from './providers';

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body className="bg-surface font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
