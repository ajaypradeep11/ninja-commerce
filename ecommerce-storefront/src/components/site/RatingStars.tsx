export function RatingStars({ rating, count }: { rating: number | null; count?: number }) {
  if (rating === null) return null;
  const filled = Math.round(rating);
  return (
    <span
      className="font-mono text-xs text-ink/70"
      aria-label={`${rating.toFixed(1)} out of 5${count !== undefined ? `, ${count} review${count === 1 ? '' : 's'}` : ''}`}
    >
      <span aria-hidden>
        {'★'.repeat(filled)}
        {'☆'.repeat(5 - filled)}
      </span>
      {count !== undefined && <span aria-hidden> ({count})</span>}
    </span>
  );
}
