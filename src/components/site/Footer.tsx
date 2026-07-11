import Link from 'next/link';
import { SITE } from '@/lib/site';
import { UspStrip } from './UspStrip';

const MARQUEE_TEXT = Array.from({ length: 8 }, () => `${SITE.name.toUpperCase()} ✳`).join(' ');

export function Footer() {
  return (
    <footer className="bg-subtle">
      <UspStrip />

      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 border-t border-ink/10 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <h3 className="font-mono text-xs tracking-wide text-ink/60 uppercase">Shop</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/products" className="text-ink hover:text-brand">
                All products
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-mono text-xs tracking-wide text-ink/60 uppercase">Help</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/faq" className="text-ink hover:text-brand">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/shipping-returns" className="text-ink hover:text-brand">
                Shipping &amp; returns
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-ink hover:text-brand">
                Contact
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-mono text-xs tracking-wide text-ink/60 uppercase">About</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/about" className="text-ink hover:text-brand">
                About {SITE.name}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-8 text-sm sm:px-6">
        <a href={`mailto:${SITE.contactEmail}`} className="text-ink hover:text-brand">
          {SITE.contactEmail}
        </a>
      </div>

      <div className="overflow-hidden border-t border-ink/10 py-6">
        <div className="marquee-track font-display text-3xl text-ink/80 sm:text-4xl">
          <span>{MARQUEE_TEXT}&nbsp;</span>
          <span aria-hidden>{MARQUEE_TEXT}&nbsp;</span>
        </div>
      </div>
    </footer>
  );
}
