import { useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import {
  useOrder,
  useRefundOrder,
  useUpdateOrderStatus,
} from '@/api/hooks/orders';
import type { ApiError } from '@/api/unwrap';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatUsd } from '@/lib/money';
import {
  availableOrderActions,
  type OrderStatus,
} from '@/lib/order-actions';
import { OrderStatusBadge } from './index';

function errorToast(e: unknown) {
  toast.error((e as ApiError).message ?? 'Something went wrong');
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const [refundRequested, setRefundRequested] = useState(false);

  const { data: order, isLoading, error } = useOrder(
    id,
    refundRequested ? 3000 : undefined,
  );
  const updateStatus = useUpdateOrderStatus();
  const refund = useRefundOrder();

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error != null || !order) {
    return <div className="text-destructive">Failed to load order.</div>;
  }

  const status = order.status as OrderStatus;
  const { nextStatus, canRefund } = availableOrderActions(status);
  const refundPending = refundRequested && status !== 'REFUNDED';
  const address = order.shippingAddress as Record<string, string> | null;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Order {order.id}</h1>
        <OrderStatusBadge status={status} />
        {refundPending && (
          <span className="text-sm text-muted-foreground">refund pending…</span>
        )}
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.name}{' '}
                  <span className="text-muted-foreground">
                    × {item.quantity}
                  </span>
                </span>
                <span>{formatUsd(item.priceCents * item.quantity)}</span>
              </div>
            ))}
            <Separator />
            {order.taxCents != null && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatUsd(order.subtotalCents)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatUsd(order.taxCents)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm font-medium">
              <span>Total</span>
              <span>{formatUsd(order.totalCents ?? order.subtotalCents)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <div>{order.email}</div>
            {address && (
              <div className="text-muted-foreground">
                {['name', 'line1', 'line2', 'city', 'state', 'postal_code', 'country']
                  .map((k) => address[k])
                  .filter(Boolean)
                  .join(', ')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <div>Session: {order.stripeSessionId ?? '—'}</div>
            <div>Payment intent: {order.stripePaymentIntentId ?? '—'}</div>
            <div>Created: {new Date(order.createdAt).toLocaleString()}</div>
            <div>Updated: {new Date(order.updatedAt).toLocaleString()}</div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          {nextStatus && (
            <Button
              disabled={updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate(
                  { id: order.id, status: nextStatus },
                  { onError: errorToast },
                )
              }
            >
              {nextStatus === 'SHIPPED' ? 'Mark shipped' : 'Mark delivered'}
            </Button>
          )}
          {canRefund && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={refundPending}>
                  Refund
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Refund {formatUsd(order.totalCents ?? order.subtotalCents)}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This triggers a full refund in Stripe. The order flips to
                    REFUNDED when Stripe confirms via webhook.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      refund.mutate(order.id, {
                        onSuccess: () => setRefundRequested(true),
                        onError: errorToast,
                      })
                    }
                  >
                    Refund
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
