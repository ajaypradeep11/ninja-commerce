import { BadgeCheck } from 'lucide-react';

// Real feedback pulled from our eBay seller profile.
const REVIEWS = [
  {
    quote: 'It came in great shape, and quality was surprisingly good.',
    product: 'Metal Poker Fidget Slider King Magnetic Push Block EDC Fidget Toys',
    buyer: 'mtol6071',
  },
  {
    quote: 'Fast shipping',
    product: 'Modern Warfare® II Logo Otaku Lamp (Call of Duty®) - LED Night Light',
    buyer: 'jaman-2577',
  },
  {
    quote: 'As described',
    product: 'Modern Warfare® II Logo Otaku Lamp (Call of Duty®) - LED Night Light',
    buyer: 'nro_doc',
  },
  {
    quote: 'Package arrived in perfect condition.',
    product: 'Itachi Moonlight LED Neon Poster 2FT (Naruto Shippuden)',
    buyer: 's5qhy_39',
  },
  {
    quote: 'It looks amazing. Thank you for the prompt delivery.',
    product: 'Quetzalcoatl Lucoa Miss Kobayashi’s Dragon Maid – Anime Lamp Figure',
    buyer: 'mattheperreir0',
  },
];

// eBay's four-letter wordmark colors, rendered as text so no asset is needed.
const EBAY_COLORS = ['#E53238', '#0064D2', '#F5AF02', '#86B817'];

const EBAY_STORE_URL = 'https://www.ebay.ca/usr/local_ninja';

function EbayWordmark() {
  return (
    <a
      href={EBAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Visit our eBay store"
      className="text-3xl font-bold tracking-tight transition-opacity hover:opacity-80"
    >
      {'ebay'.split('').map((letter, i) => (
        <span key={i} style={{ color: EBAY_COLORS[i] }}>
          {letter}
        </span>
      ))}
    </a>
  );
}

function ReviewCard({ review }: { review: (typeof REVIEWS)[number] }) {
  return (
    <figure className="w-80 shrink-0 rounded-xl bg-subtle p-5 whitespace-normal">
      <blockquote className="font-medium text-ink">&ldquo;{review.quote}&rdquo;</blockquote>
      <figcaption className="mt-3 space-y-1 text-sm">
        <p className="line-clamp-2 text-ink/60">{review.product}</p>
        <p className="flex items-center gap-1.5 text-ink/80">
          <BadgeCheck aria-hidden className="size-4 text-brand" />
          {review.buyer} · Verified purchase
        </p>
      </figcaption>
    </figure>
  );
}

export function EbayReviews() {
  return (
    <section className="py-16">
      <div className="container-wide flex flex-col items-center gap-2 text-center">
        <EbayWordmark />
        <p className="font-mono text-xs tracking-wide text-ink/60">
          FEEDBACK FROM EBAY
        </p>
      </div>

      {/* Slow marquee rail; two identical halves make the -50% loop seamless. */}
      <div className="mt-8 overflow-hidden">
        <div className="marquee-track marquee-slow">
          <div className="flex gap-4 pr-4">
            {REVIEWS.map((review) => (
              <ReviewCard key={review.buyer} review={review} />
            ))}
          </div>
          <div aria-hidden className="flex gap-4 pr-4">
            {REVIEWS.map((review) => (
              <ReviewCard key={`dup-${review.buyer}`} review={review} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
