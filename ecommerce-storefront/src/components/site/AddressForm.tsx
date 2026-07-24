'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { AddressDto } from '@/api/generated';
import { AddressAutocomplete } from '@/components/site/AddressAutocomplete';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Canada-only store: country is fixed to CA and postal codes must be Canadian.
const POSTAL_CODE_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

const schema = z.object({
  name: z.string().optional(),
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
  name: '',
  label: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
};

export function AddressForm({
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
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: initial ? { ...BLANK, ...initial } : BLANK,
  });

  function submit(values: FormOutput) {
    const address: AddressDto = {
      name: values.name || undefined,
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
        <Label htmlFor="address-name">Full name</Label>
        <Input
          id="address-name"
          placeholder="Who receives the package"
          {...register('name')}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address-label">Address Label</Label>
        <Input
          id="address-label"
          placeholder="e.g. Home, Work"
          {...register('label')}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address-line1">Address Line 1</Label>
        <AddressAutocomplete
          id="address-line1"
          placeholder="Start typing your address…"
          ariaInvalid={!!errors.line1}
          registration={register('line1')}
          onSelect={(address) => {
            setValue('line1', address.line1, { shouldValidate: true });
            setValue('line2', address.line2 ?? '');
            setValue('city', address.city, { shouldValidate: true });
            setValue('state', address.province);
            setValue('postalCode', address.postalCode, {
              shouldValidate: true,
            });
          }}
        />
        {errors.line1 && (
          <p className="text-sm text-highlight">{errors.line1.message}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address-line2">Address Line 2</Label>
        <Input
          id="address-line2"
          placeholder="Apartment, suite, unit (optional)"
          {...register('line2')}
        />
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
