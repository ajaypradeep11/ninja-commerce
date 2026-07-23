import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useOrders } from '@/api/hooks/orders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney } from '@/lib/money';
import type { OrderStatus } from '@/lib/order-actions';

const ALL_STATUSES = '__all__';
const STATUSES: OrderStatus[] = [
  'PENDING',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const STATUS_VARIANT: Record<
  OrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'outline',
  PAID: 'default',
  SHIPPED: 'default',
  DELIVERED: 'secondary',
  CANCELLED: 'destructive',
  REFUNDED: 'destructive',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(ALL_STATUSES);
  const [email, setEmail] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useOrders({
    status: status === ALL_STATUSES ? undefined : (status as OrderStatus),
    email: email || undefined,
    page,
  });
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Orders</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Search by email…"
          className="max-w-xs"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {error != null && (
        <div className="text-destructive">Failed to load orders.</div>
      )}

      {data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => void navigate(`/orders/${o.id}`)}
                >
                  <TableCell className="font-mono text-xs">{o.id}</TableCell>
                  <TableCell>
                    {new Date(o.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{o.email}</TableCell>
                  <TableCell>
                    {formatMoney(o.totalCents ?? o.subtotalCents, o.currency)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <OrderStatusBadge status={o.status as OrderStatus} />
                      {o.returnRequestedAt && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          Return requested
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {data.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
