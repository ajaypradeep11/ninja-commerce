import Image from 'next/image';
import Link from 'next/link';
import { User } from 'lucide-react';
import { SITE } from '@/lib/site';
import { SearchBox } from './SearchBox';
import { CartBadge } from './CartBadge';

const NAV = [
  { href: '/products', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
];

// Non-breaking spaces so the gaps between messages survive HTML
// whitespace collapsing inside the marquee.
const SEP = ' '.repeat(8) + '✳' + ' '.repeat(8);
const ANNOUNCEMENT_TEXT = Array.from(
  { length: 6 },
  () => SITE.announcements.map((a) => a.toUpperCase()).join(SEP),
).join(SEP);

export function Header() {
  return (
    <header className="bg-surface">
      {/* Scrolling announcement bar (the "running bar", moved up from the footer) */}
      <div className="overflow-hidden bg-brand py-1.5">
        <div className="marquee-track font-mono text-xs tracking-wide text-surface">
          <span>{ANNOUNCEMENT_TEXT + SEP}</span>
          <span aria-hidden>{ANNOUNCEMENT_TEXT + SEP}</span>
        </div>
      </div>
      <div className="container-wide flex items-center gap-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-display text-xl text-ink">
          <Image src="/logo-animated.svg" alt="" width={56} height={56} priority />
          <span>
            {SITE.wordmark.base}
            <span className="text-brand">{SITE.wordmark.accent}</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden gap-6 text-sm md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-ink hover:text-brand">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <div className="hidden sm:block">
            <SearchBox />
          </div>
          <Link href="/account" aria-label="Account" className="p-1.5 text-ink hover:text-brand">
            <User aria-hidden className="size-5" />
          </Link>
          <CartBadge />
        </div>
      </div>
      <div className="selvedge" />
    </header>
  );
}
