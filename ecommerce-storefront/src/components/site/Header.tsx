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
    <>
      {/* Scrolling announcement bar — scrolls away; only the nav bar sticks. */}
      <div className="overflow-hidden bg-brand py-1.5">
        <div className="marquee-track marquee-lazy font-mono text-xs tracking-wide text-surface">
          <span>{ANNOUNCEMENT_TEXT + SEP}</span>
          <span aria-hidden>{ANNOUNCEMENT_TEXT + SEP}</span>
        </div>
      </div>
      {/* Allbirds-style floating "notch" nav: a rounded black pill inset from
          the edges, sticky, with the hero sliding underneath (the header takes
          no flow height). Token override keeps text light-on-black while brand
          yellow stays. */}
      <header
        className="sticky top-0 z-50 h-0"
        style={{ '--color-surface': '#000000', '--color-ink': '#faf7f2' } as CSSProperties}
      >
        <div className="px-3 pt-3">
          <div className="rounded-2xl bg-surface shadow-lg shadow-black/40">
        <div className="container-wide relative grid grid-cols-[1fr_auto_1fr] items-center py-4">
        <div className="justify-self-start">
          <HeaderMenu brands={brands} />
        </div>

        {/* Shrink the lockup on phones: at full size it collapses the 1fr side
            columns and buries the menu button under the logo. */}
        <Link
          href="/"
          className="flex items-center gap-2 justify-self-center font-display text-xl text-ink sm:text-3xl"
        >
          <Image
            src="/logo-animated.svg"
            alt=""
            width={64}
            height={64}
            priority
            className="size-10 sm:size-16"
          />
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
        </div>
      </header>
    </>
  );
}
