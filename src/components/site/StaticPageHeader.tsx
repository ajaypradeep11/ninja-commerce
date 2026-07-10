import type { ReactNode } from 'react';

interface StaticPageHeaderProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
}

/**
 * Shared look for static content pages (about, FAQ, shipping & returns,
 * contact): mono eyebrow, display h1, selvedge divider, max-w-prose body.
 */
export function StaticPageHeader({ eyebrow, title, children }: StaticPageHeaderProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-xs tracking-wide text-ink/60 uppercase">{eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">{title}</h1>
      <div className="selvedge mt-6" />
      <div className="mt-8 max-w-prose space-y-4 text-ink/70">{children}</div>
    </div>
  );
}
