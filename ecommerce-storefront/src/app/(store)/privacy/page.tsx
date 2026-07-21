import { SITE } from '@/lib/site';
import { StaticPageHeader } from '@/components/site/StaticPageHeader';

export const metadata = { title: 'Privacy policy' };

const { contactEmail, name } = SITE;

export default function PrivacyPage() {
  return (
    <StaticPageHeader eyebrow="Legal" title="Privacy policy">
      <p className="text-sm text-ink/50">Last updated: July 21, 2026</p>
      <p>
        Thank you for visiting {name}. This privacy policy tells you how we use
        personal information collected at this site. Please read it before using
        the site or submitting any personal information. By using the site, you
        are accepting the practices described here.
      </p>

      <section>
        <h2 className="font-display text-xl text-ink">
          1. Information we collect
        </h2>
        <p className="mt-2">
          The information we collect is used to improve the content of our web
          pages, customize the content and layout for each individual visitor,
          notify you about updates to our website, and share with agents or
          contractors who assist in supporting our internal operations. We
          collect:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Domain name and email address of visitors to our web page.</li>
          <li>
            Information volunteered by the consumer, such as survey information,
            site registrations, account creation details, and contact
            preferences.
          </li>
          <li>Name, postal address, and telephone number.</li>
          <li>
            Payment information, such as credit card numbers and billing
            addresses.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">
          2. Cookies and tracking technologies
        </h2>
        <p className="mt-2">
          We use cookies to store your preferences, record session information
          such as the items in your shopping cart, record past activity at the
          site in order to provide better service when you return, and customize
          page content based on your browser type or other information sent by
          your browser.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">
          3. Sharing of information
        </h2>
        <p className="mt-2">
          We do not sell your personal information to any outside companies or
          organizations. We only share information with trusted third-party
          service providers or agents who assist in supporting our internal
          operations.
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink">Mailing lists:</span> if you
            supply us with your postal address or email online, you may receive
            periodic mailings from us with information on new products,
            services, or upcoming events. If you do not wish to receive these,
            please let us know by emailing us.
          </li>
          <li>
            <span className="font-semibold text-ink">Telephone contact:</span> if
            you supply your telephone number online, you will only receive
            telephone contact from us regarding orders you have placed online.
            We keep your phone number confidential and remove it from lists
            shared with other organizations.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">4. Ad servers</h2>
        <p className="mt-2">
          We do not partner with or have special relationships with any ad server
          companies.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">
          5. Changes to our policy
        </h2>
        <p className="mt-2">
          From time to time, we may use customer information for new,
          unanticipated uses not previously disclosed in this notice. If our
          information practices change, we will post the changes on our website
          to notify you and provide you with the ability to opt out of these new
          uses. You can also prevent your information from being used for
          purposes other than those for which it was originally collected by
          emailing us.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">6. Security</h2>
        <p className="mt-2">
          When we transfer and receive certain types of sensitive information,
          such as financial or payment data, we redirect visitors to a secure
          server.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Contact us</h2>
        <p className="mt-2">
          If you feel that this site is not following its stated information
          policy, or if you have any questions, concerns, or comments about this
          privacy policy, you may contact us at{' '}
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
