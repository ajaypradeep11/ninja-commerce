'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">
        Something went wrong on our side.
      </h1>
      <div className="selvedge mt-6 w-24" />
      <p className="mt-8 text-ink/70">
        Give it another try — if it keeps happening, let us know.
      </p>
      <Button onClick={() => reset()} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
