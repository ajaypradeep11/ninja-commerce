import { reviewsControllerList } from '@/api/generated';
import { serverFetchOptions } from '@/api/server';
import { unwrap } from '@/api/unwrap';
import { RatingStars } from '@/components/site/RatingStars';
import { ReviewForm } from '@/components/site/ReviewForm';

export async function Reviews({
  productId,
  slug,
}: {
  productId: string;
  slug: string;
}) {
  const { items, averageRating, count } = await unwrap(
    reviewsControllerList({ path: { productId }, ...serverFetchOptions }),
  );

  return (
    <section id="reviews" className="mt-10 border-t border-ink/10 pt-10">
      <p className="font-mono text-xs tracking-wide text-ink/60">REVIEWS</p>

      <div className="mt-2">
        {averageRating !== null ? (
          <p className="flex items-center gap-2">
            <RatingStars rating={averageRating} />
            <span className="font-mono text-xs text-ink/60">
              {averageRating.toFixed(1)} · {count} review
              {count === 1 ? '' : 's'}
            </span>
          </p>
        ) : (
          <p className="text-ink/60">No reviews yet</p>
        )}
      </div>

      {items.length > 0 && (
        <ul className="mt-8 grid gap-6">
          {items.map((review) => (
            <li
              key={review.id}
              className="border-t border-ink/10 pt-6 first:border-t-0 first:pt-0"
            >
              <RatingStars rating={review.rating} />
              <p className="mt-2 text-ink/80">{review.text}</p>
              <p className="mt-2 font-mono text-xs text-ink/50">
                Verified buyer ·{' '}
                {new Date(review.createdAt).toLocaleDateString('en-US')}
              </p>
            </li>
          ))}
        </ul>
      )}

      <ReviewForm productId={productId} slug={slug} />
    </section>
  );
}
