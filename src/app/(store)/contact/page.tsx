import { SITE } from '@/lib/site';
import { StaticPageHeader } from '@/components/site/StaticPageHeader';

export const metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <StaticPageHeader eyebrow="Contact" title="Get in touch">
      <p>
        Questions about an order, a return, or a fit? Email us and a real
        person on the team will get back to you.
      </p>
      <p>
        <a
          href={`mailto:${SITE.contactEmail}`}
          className="font-mono text-lg text-indigo underline underline-offset-4 hover:no-underline"
        >
          {SITE.contactEmail}
        </a>
      </p>
      <p>We answer within two business days.</p>
    </StaticPageHeader>
  );
}
