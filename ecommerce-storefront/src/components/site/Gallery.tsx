'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [selected, setSelected] = useState(0);
  const activeImage = images[selected] ?? images[0];

  return (
    <div>
      <div className="relative aspect-3/4 overflow-hidden bg-subtle">
        {activeImage && (
          <Image
            src={activeImage}
            alt={alt}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((image, i) => (
            <button
              key={image}
              type="button"
              aria-label={`View image ${i + 1}`}
              onClick={() => setSelected(i)}
              className={cn(
                'relative aspect-3/4 overflow-hidden bg-subtle outline-offset-2',
                i === selected && 'ring-2 ring-ink ring-offset-2',
              )}
            >
              <Image src={image} alt="" fill sizes="20vw" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
