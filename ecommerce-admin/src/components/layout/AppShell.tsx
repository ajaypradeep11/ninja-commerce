import { NavLink, Outlet } from 'react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/products', label: 'Products' },
  { to: '/categories', label: 'Categories' },
  { to: '/brands', label: 'Brands' },
  { to: '/coupons', label: 'Coupons' },
  { to: '/orders', label: 'Orders' },
];

export function AppShell() {
  const { user, signOutUser } = useAuth();
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r bg-muted/30 p-4">
        <div className="mb-6 text-lg font-semibold">Store Admin</div>
        <nav className="grid gap-1">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm hover:bg-muted',
                  isActive && 'bg-muted font-medium',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto grid gap-2 pt-6">
          <div className="truncate text-xs text-muted-foreground">
            {user?.email}
          </div>
          <Button variant="outline" size="sm" onClick={() => void signOutUser()}>
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
