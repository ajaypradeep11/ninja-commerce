import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  useCoupons,
  useCreateCoupon,
  useDeleteCoupon,
  useUpdateCoupon,
} from '@/api/hooks/coupons';
import type { ApiError } from '@/api/unwrap';
import type { CouponResponseDto } from '@/api/generated/types.gen';
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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function errorToast(e: unknown) {
  toast.error((e as ApiError).message ?? 'Something went wrong');
}

function discountLabel(coupon: CouponResponseDto): string {
  return coupon.type === 'PERCENT'
    ? `${coupon.value}% off`
    : `$${(coupon.value / 100).toFixed(2)} off`;
}

function CouponRow({
  coupon,
  onToggle,
  onDelete,
}: {
  coupon: CouponResponseDto;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-background p-2">
      <span className="w-36 truncate font-mono text-sm font-medium">
        {coupon.code}
      </span>
      <span className="w-24 text-sm">{discountLabel(coupon)}</span>
      <span className="flex-1 text-xs text-muted-foreground">
        {coupon.redemptionCount} redemption{coupon.redemptionCount === 1 ? '' : 's'}
        {' · once per customer'}
      </span>
      <Switch
        checked={coupon.active}
        onCheckedChange={onToggle}
        aria-label={`${coupon.code} active`}
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Delete ${coupon.code}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{coupon.code}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Coupons that have been redeemed cannot be deleted — deactivate
              them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function CouponsPage() {
  const { data: coupons, isLoading, error } = useCoupons();
  const create = useCreateCoupon();
  const update = useUpdateCoupon();
  const remove = useDeleteCoupon();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [value, setValue] = useState('');

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error)
    return <div className="text-destructive">Failed to load coupons.</div>;

  function onAdd() {
    const trimmed = code.trim().toUpperCase();
    const numeric = Number(value);
    if (!trimmed || !Number.isFinite(numeric) || numeric <= 0) return;
    // FIXED is entered in dollars, stored in cents; PERCENT is 1-100.
    const storedValue =
      type === 'FIXED' ? Math.round(numeric * 100) : Math.round(numeric);
    create.mutate(
      { code: trimmed, type, value: storedValue },
      {
        onSuccess: () => {
          setCode('');
          setValue('');
        },
        onError: errorToast,
      },
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-semibold">Coupons</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Each code can be redeemed once per customer, one coupon per order.
      </p>

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="CODE"
          className="w-40 font-mono uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Select
          value={type}
          onValueChange={(v) => setType(v as 'PERCENT' | 'FIXED')}
        >
          <SelectTrigger aria-label="Discount type" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PERCENT">% off</SelectItem>
            <SelectItem value="FIXED">$ off</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder={type === 'PERCENT' ? '10' : '5.00'}
          inputMode="decimal"
          className="w-28"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        />
        <Button onClick={onAdd} disabled={create.isPending}>
          Add
        </Button>
      </div>

      <div className="grid gap-2">
        {(coupons ?? []).map((coupon) => (
          <CouponRow
            key={coupon.id}
            coupon={coupon}
            onToggle={(active) =>
              update.mutate(
                { id: coupon.id, body: { active } },
                { onError: errorToast },
              )
            }
            onDelete={() => remove.mutate(coupon.id, { onError: errorToast })}
          />
        ))}
        {coupons?.length === 0 && (
          <p className="text-sm text-muted-foreground">No coupons yet.</p>
        )}
      </div>
    </div>
  );
}
