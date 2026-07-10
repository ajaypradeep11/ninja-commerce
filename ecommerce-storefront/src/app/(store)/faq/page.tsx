import { StaticPageHeader } from '@/components/site/StaticPageHeader';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export const metadata = { title: 'FAQ' };

const FAQS = [
  {
    value: 'sizes',
    question: 'What sizes do you carry?',
    answer:
      'We cut XS through XL in a relaxed, true-to-size unisex fit — most people wear their usual size. If you run between two sizes, size up; our cotton is preshrunk but still has a little room to settle in after the first wash.',
  },
  {
    value: 'shipping-time',
    question: 'How long does shipping take?',
    answer:
      "Every order ships within 48 hours of being placed. From there, it's 3–5 business days within the US and 5–8 business days for the rest of Europe. You'll get a tracking link by email as soon as your order leaves our warehouse.",
  },
  {
    value: 'returns',
    question: "What's your return policy?",
    answer:
      "You have 30 days from delivery to send anything back, for free, as long as it's unworn and unwashed. We'll refund your original payment method once the return arrives — no store credit, no restocking fee.",
  },
  {
    value: 'countries',
    question: 'Do you ship to my country?',
    answer:
      "Right now we ship to the US, the UK, and most of Western Europe — Germany, France, the Netherlands, Spain, Italy, Ireland, Austria, and Belgium. We're working on adding more countries; if yours isn't listed yet, drop us a line and we'll let you know when it is.",
  },
  {
    value: 'discount',
    question: 'How do I use a discount code?',
    answer:
      "Add your items to the cart and head to checkout. On the Stripe checkout page there's a field for promotion codes — enter it there and the discount applies before you pay. Codes can't be added after an order is placed, so double-check it's in before you confirm.",
  },
  {
    value: 'tracking',
    question: 'How do I track my order?',
    answer:
      'Sign in and go to Account → Orders to see where things stand. Every order moves through three stages — Paid, Shipped, and Delivered — and we’ll also email you when your tracking number is ready.',
  },
];

export default function FaqPage() {
  return (
    <StaticPageHeader eyebrow="Help" title="Frequently asked questions">
      <Accordion type="single" collapsible className="w-full">
        {FAQS.map((faq) => (
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
    </StaticPageHeader>
  );
}
