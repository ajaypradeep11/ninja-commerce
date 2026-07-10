import { Clock, Undo2, Leaf, type LucideIcon } from 'lucide-react';
import { SITE } from '@/lib/site';

const ICONS: Record<string, LucideIcon> = {
  clock: Clock,
  undo: Undo2,
  leaf: Leaf,
};

export function UspStrip() {
  return (
    <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 text-sm sm:grid-cols-3 sm:px-6">
      {SITE.usps.map((usp) => {
        const Icon = ICONS[usp.icon];
        return (
          <li key={usp.text} className="flex items-center justify-center gap-3 text-ink sm:justify-start">
            {Icon && <Icon aria-hidden className="size-5 text-ink/60" />}
            <span>{usp.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
