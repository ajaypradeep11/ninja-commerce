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

export function Header() {
  return (
    <header className="bg-surface">
      <div className="container-wide flex items-center gap-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-display text-xl text-ink">
          <Image src="/logo-animated.svg" alt="" width={72} height={72} priority />
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
