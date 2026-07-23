import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { PaymentBadges } from './PaymentBadges';
import { UspStrip } from './UspStrip';

const COLUMNS = [
  {
    heading: 'Shop',
    links: [{ href: '/products', label: 'All products' }],
  },
  {
    heading: 'Help',
    links: [
      { href: '/faq', label: 'FAQ' },
      { href: '/shipping', label: 'Shipping' },
      { href: '/returns', label: 'Returns & refunds' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    heading: 'About',
    links: [
      { href: '/about', label: `About ${SITE.name}` },
      { href: '/terms', label: 'Terms of service' },
      { href: '/privacy', label: 'Privacy policy' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-subtle">
      <UspStrip />

      {/* Accepted payment + satisfaction guarantee band */}
      <div className="border-t border-ink/10">
        <div className="container-wide grid gap-8 py-8 sm:grid-cols-2">
          <div>
            <h3 className="font-mono text-xs tracking-widest text-ink/60 uppercase">
              Accepted payment
            </h3>
            <PaymentBadges className="mt-3" />
          </div>
          <div className="sm:border-l sm:border-ink/10 sm:pl-8">
            <h3 className="flex items-center gap-2 font-mono text-xs tracking-widest text-ink/60 uppercase">
              <ShieldCheck aria-hidden className="size-4 text-brand" />
              100% satisfaction guaranteed
            </h3>
            <p className="mt-3 max-w-md text-sm text-ink/70">
              30-day returns — a full refund to your original payment method, no
              store credit.{' '}
              <Link
                href="/returns"
                className="text-ink underline underline-offset-4 hover:text-brand"
              >
                See returns &amp; refunds
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Link columns */}
      <div className="container-wide grid grid-cols-2 gap-8 border-t border-ink/10 py-10 sm:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="font-mono text-xs tracking-wide text-ink/60 uppercase">
              {col.heading}
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-ink hover:text-brand">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container-wide flex flex-wrap items-center justify-between gap-4 pb-8 text-sm">
        <a href={`mailto:${SITE.contactEmail}`} className="text-ink hover:text-brand">
          {SITE.contactEmail}
        </a>
      </div>

      <div className="border-t border-ink/10 py-5">
        <p className="container-wide text-xs text-ink/50">
          © 2026 {SITE.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
