import { StaticPageHeader } from '@/components/site/StaticPageHeader';

export const metadata = { title: 'Shipping & returns' };

export default function ShippingReturnsPage() {
  return (
    <StaticPageHeader eyebrow="Policies" title="Shipping & returns">
      <section>
        <h2 className="font-display text-xl text-ink">Shipping</h2>
        <p className="mt-2">
          We ship every order within 48 hours of checkout — most leave our
          warehouse the same day. Within the US, expect delivery in 3–5
          business days; across the rest of Europe, it&rsquo;s 5–8 business
          days. We currently ship to the US, the UK, Germany, France, the
          Netherlands, Spain, Italy, Ireland, Austria, and Belgium.
          You&rsquo;ll get an email with tracking as soon as your order is on
          its way, and you can always check the latest status in Account →
          Orders.
        </p>
      </section>
      <section>
        <h2 className="font-display text-xl text-ink">Returns</h2>
        <p className="mt-2">
          Not the right fit? You have 30 days from the day your order arrives
          to send it back, free of charge, as long as it&rsquo;s unworn,
          unwashed, and has its tags on. Once we receive it, we&rsquo;ll
          refund your original payment method — no store credit, no
          restocking fee, no hoops to jump through. If a return takes more
          than a few extra days to process, it&rsquo;s us, not you — email
          us and we&rsquo;ll sort it out.
        </p>
      </section>
    </StaticPageHeader>
  );
}
