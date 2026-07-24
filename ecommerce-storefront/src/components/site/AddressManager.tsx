'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { AddressDto } from '@/api/generated';
import { useMe, useUpdateAddresses } from '@/api/hooks/account';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Canada-only store: country is fixed to CA and postal codes must be Canadian.
const POSTAL_CODE_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

const schema = z.object({
  label: z.string().optional(),
  line1: z.string().min(1, 'Line 1 is required.'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required.'),
  state: z.string().optional(),
  postalCode: z
    .string()
    .regex(POSTAL_CODE_RE, 'Enter a Canadian postal code (A1A 1A1).')
    .transform((v) => {
      const compact = v.toUpperCase().replace(/[ -]/g, '');
      return `${compact.slice(0, 3)} ${compact.slice(3)}`;
    }),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

// Empty strings (not undefined) so RHF treats optional fields as controlled
// inputs from the start, matching what a pre-filled edit form would hand back.
const BLANK: FormInput = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
};

function AddressForm({
  initial,
  onSubmit,
  onCancel,
  disabled,
}: {
  initial?: AddressDto;
  onSubmit: (values: AddressDto) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: initial ? { ...BLANK, ...initial } : BLANK,
  });

  function submit(values: FormOutput) {
    const address: AddressDto = {
      label: values.label || undefined,
      line1: values.line1,
      line2: values.line2 || undefined,
      city: values.city,
      state: values.state || undefined,
      postalCode: values.postalCode,
      country: 'CA',
    };
    onSubmit(address);
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(submit)(e)}
      className="grid gap-4"
      noValidate
    >
      <div className="grid gap-2">
        <Label htmlFor="address-label">Label</Label>
        <Input id="address-label" {...register('label')} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address-line1">Line 1</Label>
        <Input
          id="address-line1"
          aria-invalid={!!errors.line1}
          {...register('line1')}
        />
        {errors.line1 && (
          <p className="text-sm text-highlight">{errors.line1.message}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address-line2">Line 2</Label>
        <Input id="address-line2" {...register('line2')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="address-city">City</Label>
          <Input
            id="address-city"
            aria-invalid={!!errors.city}
            {...register('city')}
          />
          {errors.city && (
            <p className="text-sm text-highlight">{errors.city.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="address-state">Province</Label>
          <Input id="address-state" {...register('state')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="address-postal-code">Postal code</Label>
          <Input
            id="address-postal-code"
            aria-invalid={!!errors.postalCode}
            {...register('postalCode')}
          />
          {errors.postalCode && (
            <p className="text-sm text-highlight">{errors.postalCode.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="address-country">Country</Label>
          <Input id="address-country" value="Canada" readOnly disabled />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

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
