import { subtotalCents, type CartLine } from '@/cart/store';
import { CheckoutButton } from './CheckoutButton';
import { Price } from './Price';

export function CartSummary({ lines }: { lines: CartLine[] }) {
  const subtotal = subtotalCents(lines);

  return (
    <div className="h-fit border border-ink p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">Subtotal</span>
        <Price cents={subtotal} className="text-lg" />
      </div>
      <p className="mt-2 text-sm text-ink/60">Shipping and any discounts are calculated at checkout.</p>
      <div className="mt-6">
        <CheckoutButton lines={lines} />
      </div>
    </div>
  );
}
