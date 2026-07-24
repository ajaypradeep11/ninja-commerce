import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useShippingSettings,
  useUpdateShippingSettings,
} from '@/api/hooks/settings';
import type { ApiError } from '@/api/unwrap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const dollars = z.coerce
  .number<number>()
  .min(0, 'Must be 0 or more')
  .max(10000, 'Too large')
  .refine((v) => Math.round(v * 100) === v * 100, 'Max 2 decimals');

const formSchema = z.object({
  freeShippingThreshold: dollars,
  standardShippingFee: dollars,
  expeditedShippingFee: dollars,
});
type FormValues = z.infer<typeof formSchema>;

const toCents = (v: number) => Math.round(v * 100);

export function SettingsPage() {
  const { data, isLoading, error } = useShippingSettings();
  const update = useUpdateShippingSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: data
      ? {
          freeShippingThreshold: data.freeShippingThresholdCents / 100,
          standardShippingFee: data.standardShippingCents / 100,
          expeditedShippingFee: data.expeditedShippingCents / 100,
        }
      : undefined,
  });

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error) return <div className="text-destructive">Failed to load settings.</div>;

  function onSubmit(values: FormValues) {
    update.mutate(
      {
        freeShippingThresholdCents: toCents(values.freeShippingThreshold),
        standardShippingCents: toCents(values.standardShippingFee),
        expeditedShippingCents: toCents(values.expeditedShippingFee),
      },
      {
        onSuccess: () => toast.success('Shipping settings saved'),
        onError: (e: unknown) =>
          toast.error((e as ApiError).message ?? 'Could not save settings'),
      },
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Shipping fees are charged at Stripe checkout. Orders at or above the
        threshold get free standard shipping; expedited is always charged.
      </p>
      <form
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        className="mt-6 grid gap-4"
        noValidate
      >
        {(
          [
            ['freeShippingThreshold', 'Free shipping threshold (CAD)'],
            ['standardShippingFee', 'Standard shipping fee (CAD)'],
            ['expeditedShippingFee', 'Expedited shipping fee (CAD)'],
          ] as const
        ).map(([field, label]) => (
          <div key={field} className="grid gap-2">
            <Label htmlFor={field}>{label}</Label>
            <Input
              id={field}
              type="number"
              step="0.01"
              min="0"
              {...form.register(field)}
            />
            {form.formState.errors[field] && (
              <p className="text-sm text-destructive">
                {form.formState.errors[field]?.message}
              </p>
            )}
          </div>
        ))}
        <div>
          <Button type="submit" disabled={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
