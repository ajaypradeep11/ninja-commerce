'use client';

import { useEffect, useState } from 'react';
import type { AddressDto } from '@/api/generated';
import { useMe, useUpdateAddresses } from '@/api/hooks/account';
import { useAuth } from '@/auth/AuthProvider';
import { AddressForm } from '@/components/site/AddressForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const addressKey = (a: AddressDto) => `${a.line1}|${a.postalCode}|${a.label ?? ''}`;

// Cart-side picker for the saved-address book. Selecting is optional — with
// nothing selected the shopper types the address on Stripe's page as before.
export function ShipToSelector({
  selected,
  onSelect,
}: {
  selected: AddressDto | null;
  onSelect: (address: AddressDto | null) => void;
}) {
  const { user } = useAuth();
  const { data: me } = useMe();
  const updateAddresses = useUpdateAddresses();
  const [adding, setAdding] = useState(false);

  const addresses = me?.addresses ?? [];

  // Preselect the first saved address once the profile loads.
  const firstKey = addresses.length > 0 ? addressKey(addresses[0]) : null;
  useEffect(() => {
    if (!selected && addresses.length > 0) onSelect(addresses[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey]);

  if (!user) return null;

  function handleAdd(values: AddressDto) {
    updateAddresses.mutate([...addresses, values]);
    onSelect(values);
    setAdding(false);
  }

  return (
    <div className="border border-ink/10 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs tracking-wide text-ink/60 uppercase">
          Ship to
        </h2>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <p className="mt-3 text-sm text-ink/60">
          No saved addresses — add one, or enter it on the payment page.
        </p>
      ) : (
        <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Ship to">
          {addresses.map((address) => {
            const isSelected = selected !== null && addressKey(address) === addressKey(selected);
            return (
              <button
                key={addressKey(address)}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelect(address)}
                className={`border p-3 text-left text-sm ${
                  isSelected ? 'border-ink bg-ink/5' : 'border-ink/10'
                }`}
              >
                {address.label && (
                  <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">
                    {address.label}
                    {' — '}
                  </span>
                )}
                {address.name && <span>{address.name}, </span>}
                <span>
                  {address.line1}, {address.city}
                  {address.state ? `, ${address.state}` : ''} {address.postalCode}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={adding} onOpenChange={(open) => !open && setAdding(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add address</DialogTitle>
          </DialogHeader>
          {adding && (
            <AddressForm
              onCancel={() => setAdding(false)}
              onSubmit={handleAdd}
              disabled={updateAddresses.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
