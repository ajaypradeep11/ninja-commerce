import { formatMoney, type Currency } from '@/lib/money';
import { cn } from '@/lib/utils';

export function Price({
  cents,
  currency,
  className,
}: {
  cents: number;
  currency: Currency;
  className?: string;
}) {
  return <span className={cn('font-mono', className)}>{formatMoney(cents, currency)}</span>;
}
