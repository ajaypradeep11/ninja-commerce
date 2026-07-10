import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

export function Price({ cents, className }: { cents: number; className?: string }) {
  return <span className={cn('font-mono', className)}>{formatCents(cents)}</span>;
}
