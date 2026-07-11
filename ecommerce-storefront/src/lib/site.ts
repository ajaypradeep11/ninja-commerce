export const SITE = {
  name: 'NinjaCommerce',
  // Two-tone wordmark: `accent` renders in the brand color (yellow on the
  // ninja theme) wherever the logo lockup appears (Header, auth pages).
  wordmark: { base: 'Ninja', accent: 'Commerce' },
  tagline: 'Everyday essentials from the LocalNinja crew.',
  description:
    'NinjaCommerce is the official LocalNinja store — apparel and everyday essentials that ship in 48 hours and last for years.',
  contactEmail: 'hello@localninja.ca',
  usps: [
    { icon: 'clock', text: 'Ships in 48 hours' },
    { icon: 'undo', text: 'Free returns for 30 days' },
    { icon: 'leaf', text: 'Quality materials, always' },
  ],
} as const;
