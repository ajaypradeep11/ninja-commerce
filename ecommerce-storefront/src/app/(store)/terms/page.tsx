import Link from 'next/link';
import { SITE } from '@/lib/site';
import { StaticPageHeader } from '@/components/site/StaticPageHeader';

export const metadata = { title: 'Terms of service' };

const { policy, contactEmail, name } = SITE;

export default function TermsPage() {
  return (
    <StaticPageHeader eyebrow="Legal" title="Terms of service">
      <p className="text-sm text-ink/50">Last updated: July 20, 2026</p>
      <p>
        These Terms of Service govern your use of our website, services, and the
        purchase of any products from us. By accessing our website or purchasing
        from us, you agree to be bound by these terms.
      </p>

      <section>
        <h2 className="font-display text-xl text-ink">
          1. Overview &amp; acceptance
        </h2>
        <p className="mt-2">
          This website is operated by {name}. Throughout the site, the terms
          &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; refer to{' '}
          {name}. By visiting our site and/or purchasing something from us, you
          engage in our &ldquo;Service&rdquo; and agree to be bound by these
          terms and conditions. If you do not agree to all of them, you may not
          access the website or use any services.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">2. Online store terms</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink">Age of majority:</span> by
            agreeing to these terms, you represent that you are at least the age
            of majority in your province or state of residence, or that you have
            given us your consent to allow any of your minor dependents to use
            this site.
          </li>
          <li>
            <span className="font-semibold text-ink">Prohibited uses:</span> you
            may not use our products for any illegal or unauthorized purpose,
            nor may you violate any laws in your jurisdiction in the use of the
            Service.
          </li>
          <li>
            <span className="font-semibold text-ink">Account security:</span> if
            you create an account, you are responsible for maintaining the
            confidentiality of your account details and password, and for
            restricting access to your computer.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">
          3. Products, pricing, and availability
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink">Product descriptions:</span>{' '}
            we make every effort to display the colors, features, and images of
            our products as accurately as possible. We cannot guarantee that
            your monitor&rsquo;s display of any color will be accurate.
          </li>
          <li>
            <span className="font-semibold text-ink">Pricing:</span> prices are
            subject to change without notice. We reserve the right to modify or
            discontinue the Service, or any part of it, at any time.
          </li>
          <li>
            <span className="font-semibold text-ink">Accuracy of billing:</span>{' '}
            we reserve the right to refuse any order you place with us, and may,
            at our sole discretion, limit or cancel quantities purchased per
            person, per household, or per order.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">
          4. Shipping and local delivery
        </h2>
        <p className="mt-2">
          We process orders within {policy.processingHours} hours, excluding
          weekends and statutory holidays. Standard shipping typically takes 4 to
          7 business days, while expedited shipping takes 2 to 4 business days.
          Free expedited local delivery is available for eligible Ottawa,
          Ontario residents on purchases over {policy.freeShipping}, as set out
          in our{' '}
          <Link
            href="/shipping-returns"
            className="text-brand underline underline-offset-4 hover:no-underline"
          >
            shipping policy
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">
          5. Returns, exchanges, and refunds
        </h2>
        <p className="mt-2">
          You have {policy.returnWindowDays} days from the delivery date to
          request a return or exchange through your website account. Items must
          be unused, unworn, and in their original packaging. For hygiene
          reasons, opened socks cannot be returned. Please review our full{' '}
          <Link
            href="/shipping-returns"
            className="text-brand underline underline-offset-4 hover:no-underline"
          >
            return and exchange policy
          </Link>{' '}
          for complete details.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">
          6. Intellectual property
        </h2>
        <p className="mt-2">
          All content included on this site — text, graphics, logos, button
          icons, images, audio clips, digital downloads, and data compilations —
          is the property of {name} or its content suppliers and is protected by
          international copyright laws. You may not reproduce, duplicate, copy,
          sell, or exploit any portion of the Service without our express
          written permission.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">
          7. Limitation of liability
        </h2>
        <p className="mt-2">
          {name} does not guarantee, represent or warrant that your use of our
          service will be uninterrupted, timely, secure, or error-free. In no
          case shall {name}, our directors, officers, employees, affiliates, or
          agents be liable for any injury, loss, claim, or any direct, indirect,
          incidental, punitive, special, or consequential damages arising from
          your use of the service or any products procured using the service.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">
          8. Changes to these terms
        </h2>
        <p className="mt-2">
          You can review the most current version of the Terms of Service at any
          time on this page. We reserve the right, at our sole discretion, to
          update, change or replace any part of these terms by posting updates
          to our website. It is your responsibility to check this page
          periodically for changes.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Contact</h2>
        <p className="mt-2">
          Questions about these terms can be sent to{' '}
          <a
            href={`mailto:${contactEmail}`}
            className="text-brand underline underline-offset-4 hover:no-underline"
          >
            {contactEmail}
          </a>
          .
        </p>
      </section>
    </StaticPageHeader>
  );
}
