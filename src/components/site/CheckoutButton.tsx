'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { checkoutControllerCreate } from '@/api/generated';
import { ApiError, unwrap } from '@/api/unwrap';
import { useAuth } from '@/auth/AuthProvider';
import type { CartLine } from '@/cart/store';
import { Button } from '@/components/ui/button';
import { applyCartRefresh } from './cart-refresh';

export function CheckoutButton({ lines }: { lines: CartLine[] }) {
  const { user } = useAuth();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () =>
      unwrap(
        checkoutControllerCreate({
          body: { items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) },
        }),
      ),
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        toast.error(error.message);
        void applyCartRefresh(lines);
        return;
      }
      if (error instanceof ApiError && error.status === 502) {
        toast.error(error.message);
        return;
      }
      toast.error('Checkout failed. Try again.');
    },
  });

  const hasOutOfStock = lines.some((l) => l.stockQty === 0);
  const disabled = mutation.isPending || lines.length === 0 || hasOutOfStock;

  function handleClick() {
    if (!user) {
      router.push('/login?next=/cart');
      return;
    }
    mutation.mutate();
  }

  return (
    <div>
      <Button
        onClick={handleClick}
        disabled={disabled}
        size="lg"
        className="w-full bg-brand text-surface hover:bg-brand/90"
      >
        Checkout
      </Button>
      {hasOutOfStock && (
        <p className="mt-2 font-mono text-sm text-highlight">Remove out-of-stock items to check out.</p>
      )}
    </div>
  );
}
