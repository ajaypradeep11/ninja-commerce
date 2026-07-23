export const SITE = {
  name: 'LocalNinja',
  // Two-tone wordmark: `accent` renders in the brand color (yellow on the
  // ninja theme) wherever the logo lockup appears (Header, auth pages).
  wordmark: { base: 'Local', accent: 'Ninja' },
  tagline: 'Collectible LED lamps featuring the characters and worlds you love.',
  description:
    'LocalNinja brings anime-inspired LED lamps to your setup, shelf, and gaming space.',
  contactEmail: 'support@localninja.ca',
  // Facts that repeat across the policy pages, the announcement bar and the
  // hero. Kept here so a change lands everywhere at once — they're the sort of
  // numbers that quietly drift out of sync when copy-pasted.
  policy: {
    freeShipping: '$65 CAD',
    freeShippingUsd: '$49 USD',
    returnWindowDays: 30,
    processingHours: 48,
    supportHours: 'Monday – Friday, 9 AM – 5 PM EST',
    location: 'Ottawa, ON',
    social: '@localninja.ca',
  },
  // Scrolling announcement bar above the header.
  announcements: [
    'Free shipping above $65 CAD',
    'Ottawa local delivery in 1–2 days*',
    'Secure checkout',
  ],
  usps: [
    { icon: 'clock', text: 'Ships in 48 hours' },
    { icon: 'undo', text: '30-day returns' },
    { icon: 'leaf', text: '16 colors, one remote' },
  ],
} as const;
