import { Suspense } from 'react';
import { SuccessStates } from '@/components/site/SuccessStates';

export const metadata = { title: 'Order confirmation' };

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Suspense>
        <SuccessStates />
      </Suspense>
    </div>
  );
}
