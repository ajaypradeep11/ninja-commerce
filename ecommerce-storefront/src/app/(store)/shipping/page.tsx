import { SITE } from '@/lib/site';
import { StaticPageHeader } from '@/components/site/StaticPageHeader';

export const metadata = { title: 'Shipping' };

const { policy, contactEmail } = SITE;

export default function ShippingPage() {
  return (
    <StaticPageHeader eyebrow="Policies" title="Shipping">
      <p className="text-sm text-ink/50">Last updated: July 20, 2026</p>

      <section>
        <h2 className="font-display text-xl text-ink">
          Order processing &amp; tracking
        </h2>
        <p className="mt-2">
          Every order is packed with care and ships out within{' '}
          {policy.processingHours} hours (we just take weekends and statutory
          holidays off to recharge our ninja skills). As soon as your package is
          on its way, we&rsquo;ll send you a friendly email with a tracking link
          so you can watch its journey right to your doorstep.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Shipping within Canada</h2>
        <p className="mt-2">
          <span className="font-semibold text-ink">
            Standard shipping (4 to 7 business days):
          </span>{' '}
          free on all orders over {policy.freeShipping}. For smaller orders,
          standard rates are calculated at checkout.
        </p>
        <p className="mt-4">
          <span className="font-semibold text-ink">
            Expedited shipping (2 to 4 business days):
          </span>{' '}
          rates are automatically calculated at checkout based on your exact
          location.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Ottawa local delivery</h2>
        <p className="mt-2">
          Are you in our neighbourhood? Because we&rsquo;re based here, we offer
          local residents free expedited delivery in 1 to 2 days on any order
          over {policy.freeShipping}. Just enter your eligible Ottawa postal
          code at checkout and your free local delivery option will appear.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">International shipping</h2>
        <p className="mt-2">
          We ship worldwide, with free standard international shipping on
          eligible orders over {policy.freeShippingInternational}. Standard
          delivery takes 15 to 25 business days, and faster expedited options
          are calculated at checkout based on your location.
        </p>
        <p className="mt-4">
          Due to some regional mailing restrictions, our anime lamps,
          lightboxes, and keystraps are currently only available for domestic
          shipping within Canada and the US.
        </p>
        <p className="mt-4">
          International orders may be subject to import taxes, customs duties,
          and fees levied by your destination country once the package arrives.
          These charges are the customer&rsquo;s responsibility and are not
          included in the item price or shipping cost at checkout. Customs
          clearance can occasionally cause delays beyond our estimated
          timelines, which are outside our control.
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
