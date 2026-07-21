'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useRequestReturn } from '@/api/hooks/account';
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

const RETURN_WINDOW_DAYS = 30;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function RequestReturnButton({
  orderId,
  status,
  deliveredAt,
  returnRequestedAt,
}: {
  orderId: string;
  status: string;
  deliveredAt: string | null;
  returnRequestedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const requestReturn = useRequestReturn(orderId);

  if (returnRequestedAt) {
    return (
      <p className="text-sm text-ink/60">
        Return requested on {formatDate(returnRequestedAt)}
      </p>
    );
  }

  if (status !== 'DELIVERED' || !deliveredAt) return null;
  const withinWindow = Date.now() - new Date(deliveredAt).getTime() <= RETURN_WINDOW_MS;
  if (!withinWindow) return null;

  async function onConfirm() {
    try {
      await requestReturn.mutateAsync(reason.trim() || undefined);
      toast.success('Return requested — we’ll email you with next steps.');
      setOpen(false);
      setReason('');
    } catch {
      toast.error('Could not request a return. Please try again.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Return this order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a return</DialogTitle>
          <DialogDescription>
            You have {RETURN_WINDOW_DAYS} days from delivery to send this back, free of
            charge. Once we receive it, we&rsquo;ll refund your original payment
            method.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label
            htmlFor="return-reason"
            className="font-mono text-xs tracking-wide text-ink/60 uppercase"
          >
            Reason (optional)
          </label>
          <textarea
            id="return-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Never mind</Button>
          </DialogClose>
          <Button
            onClick={() => void onConfirm()}
            disabled={requestReturn.isPending}
          >
            {requestReturn.isPending ? 'Requesting…' : 'Request return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
