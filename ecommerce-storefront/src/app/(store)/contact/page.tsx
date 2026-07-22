import Link from 'next/link';
import { SITE } from '@/lib/site';
import { StaticPageHeader } from '@/components/site/StaticPageHeader';

export const metadata = { title: 'Contact' };

const { policy, contactEmail } = SITE;

export default function ContactPage() {
  return (
    <StaticPageHeader eyebrow="Contact" title="Get in touch">
      <p>
        We&rsquo;d love to hear from you. Whether you have a question about your
        order, need help finding the right anime lamp, or just want to chat,
        we&rsquo;re always here to help.
      </p>
      <p>
        Have a quick question? Check our{' '}
        <Link
          href="/faq"
          className="text-brand underline underline-offset-4 hover:no-underline"
        >
          FAQ
        </Link>{' '}
        or our{' '}
        <Link
          href="/shipping"
          className="text-brand underline underline-offset-4 hover:no-underline"
        >
          shipping
        </Link>{' '}
        and{' '}
        <Link
          href="/returns"
          className="text-brand underline underline-offset-4 hover:no-underline"
        >
          returns
        </Link>{' '}
        policies first — we might have already answered it there.
      </p>

      <section>
        <h2 className="font-display text-xl text-ink">Reach out directly</h2>
        <dl className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-ink">Email:</dt>
            <dd>
              <a
                href={`mailto:${contactEmail}`}
                className="font-mono text-brand underline underline-offset-4 hover:no-underline"
              >
                {contactEmail}
              </a>
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-ink">Business hours:</dt>
            <dd>{policy.supportHours}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-ink">Location:</dt>
            <dd>{policy.location}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Let&rsquo;s connect</h2>
        <p className="mt-2">
          Follow us for our latest drops, anime setups, and more on Instagram
          and TikTok at{' '}
          <span className="font-semibold text-ink">{policy.social}</span>.
        </p>
      </section>
    </StaticPageHeader>
  );
}
