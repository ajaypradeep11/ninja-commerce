'use client';

import { Minus, Plus } from 'lucide-react';

export function QtyStepper({
  value,
  onChange,
  max,
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  max: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center border border-ink">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="p-2 text-ink hover:text-indigo disabled:opacity-40"
        disabled={disabled || value <= 1}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <span className="w-8 text-center font-mono">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="p-2 text-ink hover:text-indigo disabled:opacity-40"
        disabled={disabled || value >= max}
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}
