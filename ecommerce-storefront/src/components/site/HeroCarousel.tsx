'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export type HeroSlide = {
  src: string;
  /** Per-slide crop tuning — each shot is framed differently. */
  className?: string;
};

const SLIDE_MS = 5000;

/**
 * The hero's image layer: a stack of full-bleed shots that cross-fade on a
 * timer. Only the images live here — the gradient scrim and the headline stay
 * server-rendered in the page so the copy and CTAs are in the initial HTML.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    // Reduced-motion visitors hold on the first slide rather than getting a
    // cross-fade they didn't ask for.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const id = setInterval(
      () => setIndex((current) => (current + 1) % slides.length),
      SLIDE_MS,
    );
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <>
      {slides.map((slide, i) => (
        <Image
          key={slide.src}
          src={slide.src}
          alt=""
          fill
          // Only the leading slide is LCP-critical; the rest have the whole
          // first interval to load before their turn comes around.
          priority={i === 0}
          sizes="100vw"
          className={[
            'rounded-2xl object-cover transition-opacity duration-1000 ease-in-out',
            i === index ? 'opacity-100' : 'opacity-0',
            slide.className ?? '',
          ].join(' ')}
        />
      ))}
    </>
  );
}
