export const SITE = {
  name: 'NinjaCommerce',
  // Two-tone wordmark: `accent` renders in the brand color (yellow on the
  // ninja theme) wherever the logo lockup appears (Header, auth pages).
  wordmark: { base: 'Ninja', accent: 'Commerce' },
  tagline: 'Collectible LED lamps featuring the characters and worlds you love.',
  description:
    'NinjaCommerce brings anime-inspired LED lamps to your setup, shelf, and gaming space.',
  contactEmail: 'hello@localninja.ca',
  usps: [
    { icon: 'clock', text: 'Ships in 48 hours' },
    { icon: 'undo', text: 'Free returns for 30 days' },
    { icon: 'leaf', text: '16 colors, one remote' },
  ],
} as const;
