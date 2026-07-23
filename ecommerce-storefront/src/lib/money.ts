// Every price on the site is charged in Canadian dollars — ecommerce-api's
// checkout.service.ts hands Stripe `currency: 'cad'`. This used to format as
// en-US/USD, which showed shoppers a USD price tag for a CAD charge.
//
// With Stripe Adaptive Pricing enabled, the hosted checkout page may present a
// converted local currency to non-Canadian buyers; the storefront itself
// always quotes CAD, which is what the store actually settles in.
const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

export function formatCents(cents: number): string {
  // Spelled out rather than a bare "$", which reads as USD to many visitors.
  return `${cad.format(cents / 100)} CAD`;
}
