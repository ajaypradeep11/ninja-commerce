import { SITE } from '@/lib/site';
import { StaticPageHeader } from '@/components/site/StaticPageHeader';

export const metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <StaticPageHeader eyebrow="About" title={`About ${SITE.name}`}>
      <p>
        {SITE.name} makes organic cotton basics — tees, hoodies, sweatpants,
        and the handful of essentials you reach for every day. No seasonal
        drops, no seventeen colorways. Just the things you already own, made
        better.
      </p>
      <p>
        We&rsquo;d rather sell you one hoodie that lasts five years than four
        that fall apart in one. That means heavier fabric than you&rsquo;re
        used to, flat-felled seams that don&rsquo;t unravel, and cuts that
        hold their shape after the fiftieth wash. If something we make
        doesn&rsquo;t outlast the trend it was cut for, we&rsquo;ve done it
        wrong.
      </p>
      <p>
        Every piece starts as GOTS-certified organic cotton, grown without
        synthetic pesticides and traceable back to the farm. We work with a
        small number of mills we&rsquo;ve visited in person, because we want
        to know exactly whose hands touched the fabric before it touched
        yours.
      </p>
    </StaticPageHeader>
  );
}
