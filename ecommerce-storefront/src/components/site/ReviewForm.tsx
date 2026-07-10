'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { reviewsControllerCreate } from '@/api/generated';
import { ApiError, unwrap } from '@/api/unwrap';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';

const schema = z.object({
  rating: z.coerce
    .number('Select a rating.')
    .int('Select a rating.')
    .min(1, 'Select a rating.')
    .max(5, 'Select a rating.'),
  text: z
    .string()
    .min(1, 'Write a few words before submitting.')
    .max(2000, 'Reviews are limited to 2000 characters.'),
});

// The rating input comes off a radio group as a string; `z.coerce.number()`
// accepts that at the input boundary and coerces it to a number by the time
// it reaches `onSubmit`. RHF needs both shapes: `FormInput` (pre-coercion,
// what `register` wires up to the DOM) and `FormOutput` (post-coercion, what
// `handleSubmit` hands to `onSubmit`).
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function ReviewForm({
  productId,
  slug,
}: {
  productId: string;
  slug: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
  });

  if (loading) return null;

  if (!user) {
    return (
      <div className="mt-10">
        <Link
          href={`/login?next=${encodeURIComponent(`/products/${slug}`)}`}
          className="inline-block font-mono text-xs tracking-wide text-indigo underline underline-offset-4"
        >
          Sign in to review
        </Link>
      </div>
    );
  }

  async function onSubmit(values: FormOutput) {
    setFormError(null);
    try {
      await unwrap(
        reviewsControllerCreate({
          path: { productId },
          body: { rating: values.rating, text: values.text },
        }),
      );
      toast.success('Review published');
      reset();
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setFormError('Only verified buyers can review this product.');
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setFormError("You've already reviewed this product.");
        return;
      }
      toast.error('Something went wrong. Try again.');
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="mt-10 grid gap-4"
      noValidate
    >
      <div>
        <span className="font-mono text-xs tracking-wide text-ink/60">
          YOUR RATING
        </span>
        <div role="radiogroup" aria-label="Rating" className="mt-2 flex gap-2">
          {STAR_VALUES.map((value) => (
            <label
              key={value}
              className="flex size-9 cursor-pointer items-center justify-center border border-ink font-mono text-sm text-ink/70 transition-colors has-checked:bg-ink has-checked:text-cotton hover:text-indigo"
            >
              <input
                type="radio"
                value={value}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                className="sr-only"
                {...register('rating')}
              />
              {value}
            </label>
          ))}
        </div>
        {errors.rating && (
          <p className="mt-2 text-sm text-madder">{errors.rating.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <label
          htmlFor="review-text"
          className="font-mono text-xs tracking-wide text-ink/60 uppercase"
        >
          Review
        </label>
        <textarea
          id="review-text"
          rows={4}
          aria-invalid={!!errors.text}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
          {...register('text')}
        />
        {errors.text && (
          <p className="text-sm text-madder">{errors.text.message}</p>
        )}
      </div>

      {formError && <p className="text-sm text-madder">{formError}</p>}

      <Button type="submit" disabled={isSubmitting} className="w-fit">
        Submit review
      </Button>
    </form>
  );
}
