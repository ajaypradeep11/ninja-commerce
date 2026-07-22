import Image from 'next/image';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { StaticPageHeader } from '@/components/site/StaticPageHeader';

export const metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <StaticPageHeader eyebrow="About" title={`About ${SITE.name}`}>
      <section>
        <h2 className="font-display text-xl text-ink">Our story</h2>
        <p className="mt-2">
          We are Ajay and Aleena, just a couple who love anime, and we decided
          to turn our shared passion into a shop we could share with the world.
        </p>
        <p className="mt-4">
          Our journey really began when we instantly bonded over our favorite
          shows. The true spark happened when Aleena pulled a Saitama figure
          keychain right out of her bag, we completely geeked out, and that
          shared love for anime eventually inspired us to build this store
          together.
        </p>
        <figure className="mt-6">
          <Image
            src="/about-saitama-keychain.png"
            alt="The Saitama figure keychain that sparked it all, resting on a set of keys."
            width={1582}
            height={1133}
            sizes="(max-width: 640px) 100vw, 640px"
            className="w-full rounded-2xl object-cover"
          />
          <figcaption className="mt-2 text-sm italic text-ink/70">
            The Saitama keychain that started it all.
          </figcaption>
        </figure>
        <p className="mt-4">
          We wanted to create a place where fellow fans could easily find
          amazing gear to light up their own spaces. From our LED anime lamps
          and lightboxes to our t-shirts and keystraps, we hand-pick and curate
          items that we would proudly display in our own home.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Our Ottawa</h2>
        <p className="mt-2">
          Our business home base is proudly located right here in Ottawa,
          Ontario, Canada. The &ldquo;Local&rdquo; in {SITE.name} represents our
          commitment to our community. We process, pack, and ship right from
          here, and we are thrilled to offer our Ottawa neighbours special
          perks however we can.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Our promise</h2>
        <p className="mt-2">
          Whether you&rsquo;re a lifelong otaku or just discovering your very
          first series, our goal is to help you celebrate your fandom. As a
          small, two-person business, every single order means the world to us.
          We are committed to providing top-notch customer service, careful
          packaging, and products that make you smile the moment you open the
          box.
        </p>
        <p className="mt-4">
          Thank you for stopping by, supporting our small business, and sharing
          in our love for anime.
        </p>
        <p className="mt-4">
          Stay awesome,
          <br />
          <span className="font-semibold text-ink">Ajay &amp; Aleena</span>
          <br />
          <span className="italic">Founders, {SITE.name}</span>
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Let&rsquo;s connect</h2>
        <p className="mt-2">
          Come hang out with us on Instagram and TikTok at{' '}
          <span className="font-semibold text-ink">{SITE.policy.social}</span>{' '}
          to see our latest drops, epic anime setups, and more.
        </p>
        <p className="mt-4">
          <Link
            href="/products?sort=best_selling"
            className="text-brand underline underline-offset-4 hover:no-underline"
          >
            Shop our favourites
          </Link>
        </p>
      </section>
    </StaticPageHeader>
  );
}
