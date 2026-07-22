import Link from 'next/link';
import { SITE } from '@/lib/site';
import { StaticPageHeader } from '@/components/site/StaticPageHeader';

export const metadata = { title: 'Returns & refunds' };

const { policy, contactEmail } = SITE;

export default function ReturnsPage() {
  return (
    <StaticPageHeader eyebrow="Policies" title="Returns & refunds">
      <p className="text-sm text-ink/50">Last updated: July 20, 2026</p>

      <section>
        <h2 className="font-display text-xl text-ink">
          Returns &amp; exchanges
        </h2>
        <p className="mt-2">
          You have a full {policy.returnWindowDays} days from the day your order
          arrives to request a return or an exchange. Because you ordered online
          with us, we already have your details on file — no proof of purchase
          is required.
        </p>
        <p className="mt-4">
          To be accepted, items need to be unused and unworn, in the exact same
          condition they arrived in, with all original tags, labels, and
          protective seals intact. For figures and collectibles, the
          manufacturer&rsquo;s box must be entirely unopened and undamaged.
        </p>
        <p className="mt-4">
          A few things we can&rsquo;t accept back: final sale and clearance
          items, digital goods, and socks once the packaging has been opened,
          for hygiene reasons.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Starting a return</h2>
        <p className="mt-2">
          No lengthy email needed. Log in to your{' '}
          <Link
            href="/account/orders"
            className="text-brand underline underline-offset-4 hover:no-underline"
          >
            account
          </Link>
          , find the order you want to send back, click{' '}
          <span className="font-semibold text-ink">Return / Exchange</span>, and
          pick your reason from the drop-down. We&rsquo;ll email you the
          instructions for where to send your package.
        </p>
        <p className="mt-4">
          Please submit the request through your account before mailing anything
          back, so our warehouse knows to expect it.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Refunds</h2>
        <p className="mt-2">
          Once your package reaches us and our team checks it over, we&rsquo;ll
          email you to confirm it has been processed. Approved refunds go back
          to your original payment method within 5 to 10 business days.
          Depending on your bank or credit card company, it can sometimes take
          an extra few days to officially post to your account — if you&rsquo;re
          worried, just let us know.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Return shipping costs</h2>
        <p className="mt-2">
          <span className="font-semibold text-ink">If we made a mistake:</span>{' '}
          received a damaged product or the wrong item? We&rsquo;ll gladly cover
          all return shipping costs to make it right.
        </p>
        <p className="mt-4">
          <span className="font-semibold text-ink">
            If you simply changed your mind:
          </span>{' '}
          we kindly ask that you cover the return shipping costs, which are
          deducted from your final refund.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">
          We&rsquo;re here for you
        </h2>
        <p className="mt-2">
          Still have questions? Email{' '}
          <a
            href={`mailto:${contactEmail}`}
            className="text-brand underline underline-offset-4 hover:no-underline"
          >
            {contactEmail}
          </a>
          . Our hours are {policy.supportHours}.
        </p>
      </section>
    </StaticPageHeader>
  );
}
