'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { AddressDto } from '@/api/generated';
import { useMe, useUpdateAddresses } from '@/api/hooks/account';
import { AddressForm } from '@/components/site/AddressForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
type DialogState = { mode: 'add' } | { mode: 'edit'; index: number } | null;

function AddressCard({
  address,
  onEdit,
  onDelete,
  disabled,
}: {
  address: AddressDto;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div data-testid="address-card" className="border border-ink/10 p-4">
      {address.label && (
        <p className="font-mono text-xs tracking-wide text-ink/60 uppercase">
          {address.label}
        </p>
      )}
      <address className="mt-1 not-italic text-ink/80">
        {address.name && <div className="text-ink">{address.name}</div>}
        <div>{address.line1}</div>
        {address.line2 && <div>{address.line2}</div>}
        <div>
          {address.city}
          {address.state ? `, ${address.state}` : ''} {address.postalCode}
        </div>
        <div>{address.country}</div>
      </address>

      {confirming ? (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm text-ink/70">Remove this address?</span>
          <Button size="sm" onClick={onDelete} disabled={disabled}>
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirming(false)}
            disabled={disabled}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            disabled={disabled}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirming(true)}
            disabled={disabled}
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

export function AddressManager() {
  const { data: me } = useMe();
  const updateAddresses = useUpdateAddresses();
  const [dialog, setDialog] = useState<DialogState>(null);

  const addresses = me?.addresses ?? [];

  function persist(next: AddressDto[]) {
    updateAddresses.mutate(next, {
      onError: () => toast.error('Something went wrong. Try again.'),
    });
  }

  function handleAdd(values: AddressDto) {
    persist([...addresses, values]);
    setDialog(null);
  }

  function handleEdit(index: number, values: AddressDto) {
    persist(addresses.map((a, i) => (i === index ? values : a)));
    setDialog(null);
  }

  function handleDelete(index: number) {
    persist(addresses.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs tracking-wide text-ink/60 uppercase">
          Saved addresses
        </h2>
        <Button
          size="sm"
          onClick={() => setDialog({ mode: 'add' })}
          disabled={updateAddresses.isPending}
        >
          Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <p className="mt-4 text-ink/70">
          No saved addresses yet. Add one to speed up future orders.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {addresses.map((address, index) => (
            <AddressCard
              key={`${address.line1}|${address.postalCode}|${index}`}
              address={address}
              onEdit={() => setDialog({ mode: 'edit', index })}
              onDelete={() => handleDelete(index)}
              disabled={updateAddresses.isPending}
            />
          ))}
        </div>
      )}

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'edit' ? 'Edit address' : 'Add address'}
            </DialogTitle>
          </DialogHeader>
          {dialog && (
            <AddressForm
              key={dialog.mode === 'edit' ? dialog.index : 'add'}
              initial={
                dialog.mode === 'edit' ? addresses[dialog.index] : undefined
              }
              onCancel={() => setDialog(null)}
              onSubmit={(values) =>
                dialog.mode === 'add'
                  ? handleAdd(values)
                  : handleEdit(dialog.index, values)
              }
              disabled={updateAddresses.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
