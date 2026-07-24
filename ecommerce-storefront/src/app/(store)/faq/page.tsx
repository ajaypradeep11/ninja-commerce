import { SITE } from '@/lib/site';
import { StaticPageHeader } from '@/components/site/StaticPageHeader';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export const metadata = { title: 'FAQ' };

const { policy, contactEmail } = SITE;

// Grouped the way the printed FAQ is, so the two stay easy to diff.
const SECTIONS = [
  {
    heading: 'Orders & shipping',
    faqs: [
      {
        value: 'shipping-time',
        question: 'How long does shipping take?',
        answer:
          'Standard shipping typically takes 4 to 7 business days, while expedited shipping takes 2 to 4 business days. All orders are processed and prepared within 48 hours, excluding weekends and statutory holidays.',
      },
      {
        value: 'free-shipping',
        question: 'Do you offer free shipping?',
        answer: `Yes. We offer free standard shipping on all Canadian orders over ${policy.freeShipping}.`,
      },
      {
        value: 'ottawa',
        question: 'I live in Ottawa — do I get anything special?',
        answer: `You do. Because we pack and ship from Ottawa, local residents get free expedited delivery in 1 to 2 days on any order over ${policy.freeShipping}. Enter your eligible Ottawa postal code at checkout and the option appears.`,
      },
      {
        value: 'tracking',
        question: 'How can I track my order?',
        answer:
          'As soon as your order leaves our warehouse we’ll email you a tracking link. You can also sign in and go to Account → Orders, where every order moves through Paid, Shipped, and Delivered.',
      },
    ],
  },
  {
    heading: 'Returns & exchanges',
    faqs: [
      {
        value: 'returns',
        question: 'What is your return policy?',
        answer: `You have ${policy.returnWindowDays} days from your delivery date to request a return or an exchange. Items must be unused, unworn, and in their original packaging with all tags and seals intact.`,
      },
      {
        value: 'start-return',
        question: 'How do I start a return or exchange?',
        answer:
          'Log in to your account, find the order, and choose Return / Exchange, then pick your reason from the drop-down. No proof of purchase is required since it’s an online order. Please submit the request before mailing anything back.',
      },
      {
        value: 'non-returnable',
        question: 'Are there any non-returnable items?',
        answer:
          'Yes. Final sale items, digital goods, and socks — once the packaging has been opened, for hygiene reasons — cannot be returned.',
      },
      {
        value: 'refund-time',
        question: 'How long do refunds take?',
        answer:
          'Once your return is received and inspected, approved refunds are processed back to your original payment method within 5 to 10 business days. If you changed your mind, return shipping is deducted from the refund; if we sent the wrong or a damaged item, we cover it.',
      },
    ],
  },
  {
    heading: 'Products & collectibles',
    faqs: [
      {
        value: 'licensed',
        question: 'Are your products officially licensed?',
        answer:
          'Yes. We specialize in high-quality, officially licensed anime lamps, figures, t-shirts and collectibles featuring your favorite characters and worlds.',
      },
      {
        value: 'lamp-contents',
        question: 'What comes with the LED lamps?',
        answer:
          'Each lamp comes with 16 vibrant colors and a handy remote control so you can customize your display.',
      },
    ],
  },
  {
    heading: 'Contact & support',
    faqs: [
      {
        value: 'support',
        question: 'How can I get in touch with customer service?',
        answer: `You can reach our team anytime by emailing ${contactEmail}, or through the form on our Contact page. We’re available ${policy.supportHours}.`,
      },
      {
        value: 'discount',
        question: 'How do I use a discount code?',
        answer:
          'Enter your code at checkout before you pay and the discount applies to your order total. One coupon can be used per purchase, and each coupon can only be used once per customer, so double-check it’s applied before confirming.',
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <StaticPageHeader eyebrow="Help" title="Frequently asked questions">
      {SECTIONS.map((section) => (
        <section key={section.heading}>
          <h2 className="font-display text-xl text-ink">{section.heading}</h2>
          <Accordion type="single" collapsible className="w-full">
            {section.faqs.map((faq) => (
              <AccordionItem key={faq.value} value={faq.value}>
                <AccordionTrigger className="text-base text-ink">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-ink/70">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </StaticPageHeader>
  );
}
