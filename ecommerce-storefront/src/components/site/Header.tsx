import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { User } from 'lucide-react';
import { brandsControllerFindAll } from '@/api/generated';
import { serverFetchOptions } from '@/api/server';
import { unwrap } from '@/api/unwrap';
import { SITE } from '@/lib/site';
import { SearchBox } from './SearchBox';
import { CartBadge } from './CartBadge';
import { HeaderMenu } from './HeaderMenu';

// Non-breaking spaces so the gaps between messages survive HTML
// whitespace collapsing inside the marquee.
const SEP = ' '.repeat(8) + '✳' + ' '.repeat(8);
const ANNOUNCEMENT_TEXT = Array.from(
  { length: 6 },
  () => SITE.announcements.map((a) => a.toUpperCase()).join(SEP),
).join(SEP);

export async function Header() {
  // Brands feed the hamburger menu's "Anime" group; a failed fetch (e.g. API
  // down during build) degrades to an empty group rather than a crash.
  const brands = await unwrap(
    brandsControllerFindAll({ ...serverFetchOptions }),
  ).catch(() => []);

  return (
    <header className="bg-surface">
      {/* Scrolling announcement bar (the "running bar", moved up from the footer) */}
      <div className="overflow-hidden bg-brand py-1.5">
        <div className="marquee-track font-mono text-xs tracking-wide text-surface">
          <span>{ANNOUNCEMENT_TEXT + SEP}</span>
          <span aria-hidden>{ANNOUNCEMENT_TEXT + SEP}</span>
        </div>
      </div>
      {/* simplymdrn-style row: hamburger left, centered lockup, icons right.
          Pure-black bar: override the surface/ink tokens locally so text and
          the dropdown go light-on-black while brand yellow stays. */}
      <div
        className="bg-surface"
        style={{ '--color-surface': '#000000', '--color-ink': '#faf7f2' } as CSSProperties}
      >
        <div className="container-wide relative grid grid-cols-[1fr_auto_1fr] items-center py-5">
        <div className="justify-self-start">
          <HeaderMenu brands={brands} />
        </div>

        <Link
          href="/"
          className="flex items-center gap-2 justify-self-center font-display text-3xl text-ink"
        >
          <Image src="/logo-animated.svg" alt="" width={64} height={64} priority />
          <span>
            {SITE.wordmark.base}
            <span className="text-brand">{SITE.wordmark.accent}</span>
          </span>
        </Link>

        <div className="flex items-center gap-4 justify-self-end">
          <div className="hidden sm:block">
            <SearchBox />
          </div>
          <Link href="/account" aria-label="Account" className="p-1.5 text-ink hover:text-brand">
            <User aria-hidden className="size-5" />
          </Link>
          <CartBadge />
        </div>
        </div>
      </div>
      <div className="selvedge" />
    </header>
  );
}
