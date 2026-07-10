import { Link } from 'react-router';
import { useAdminStats } from '@/api/hooks/stats';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function DashboardPage() {
  const { data, isLoading, error } = useAdminStats();

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error != null || !data) {
    return <div className="text-destructive">Failed to load stats.</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold">{data.ordersToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Low stock ({data.lowStockProducts.length})</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {data.lowStockProducts.length === 0 && (
              <div className="text-sm text-muted-foreground">
                All products sufficiently stocked.
              </div>
            )}
            {data.lowStockProducts.map((p) => (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="flex justify-between text-sm hover:underline"
              >
                <span>{p.name}</span>
                <span className="text-muted-foreground">{p.stockQty} left</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
