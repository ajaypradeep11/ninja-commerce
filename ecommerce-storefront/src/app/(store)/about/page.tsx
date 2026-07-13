import { SITE } from '@/lib/site';
import { StaticPageHeader } from '@/components/site/StaticPageHeader';

export const metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <StaticPageHeader eyebrow="About" title={`About ${SITE.name}`}>
      <p>
        {SITE.name} is the LocalNinja destination for anime-inspired LED
        lamps. We bring fan-favorite characters, emblems, and worlds off the
        screen and into the spaces where you watch, play, collect, and create.
      </p>
      <p>
        Each lamp pairs detailed acrylic artwork with a light base that offers
        16 colors and remote control. Power it by USB or batteries, set the
        mood from across the room, and give your desk, shelf, or gaming setup a
        glow that feels unmistakably yours.
      </p>
      <p>
        Our collection is curated for fans who care about the details. We show
        multiple views of every design, keep the shopping experience simple,
        and make it easy to find a lamp for your favorite series—or the next
        gift for someone else&rsquo;s collection.
      </p>
    </StaticPageHeader>
  );
}
