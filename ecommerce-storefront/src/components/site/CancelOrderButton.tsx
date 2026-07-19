'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useCancelOrder } from '@/api/hooks/account';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// Statuses a customer can still cancel (before it ships).
const CANCELLABLE = ['PENDING', 'PAID'];

export function CancelOrderButton({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const cancel = useCancelOrder(orderId);

  if (!CANCELLABLE.includes(status)) return null;

  async function onConfirm() {
    try {
      const res = await cancel.mutateAsync();
      toast.success(
        res.refundId
          ? 'Order cancelled — your refund is being processed.'
          : 'Order cancelled.',
      );
      setOpen(false);
    } catch {
      toast.error('Could not cancel this order. Please try again.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Cancel order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>
            {status === 'PAID'
              ? 'Your payment will be refunded to your original payment method. This can’t be undone.'
              : 'This will cancel your unpaid order.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Keep order</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
