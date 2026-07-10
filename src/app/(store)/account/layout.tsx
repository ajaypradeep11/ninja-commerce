'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/auth/RequireAuth';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/account', label: 'Profile' },
  { href: '/account/orders', label: 'Orders' },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Account</h1>

        <nav
          aria-label="Account"
          className="mt-6 flex gap-6 border-b border-ink/10"
        >
          {TABS.map((tab) => {
            const active =
              tab.href === '/account'
                ? pathname === '/account'
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'pb-3 font-mono text-xs tracking-wide uppercase',
                  active
                    ? 'border-b-2 border-ink text-ink'
                    : 'text-ink/60 hover:text-ink',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8">{children}</div>
      </div>
    </RequireAuth>
  );
}
