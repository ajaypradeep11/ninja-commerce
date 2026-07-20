export const SITE = {
  name: 'LocalNinja',
  // Two-tone wordmark: `accent` renders in the brand color (yellow on the
  // ninja theme) wherever the logo lockup appears (Header, auth pages).
  wordmark: { base: 'Local', accent: 'Ninja' },
  tagline: 'Collectible LED lamps featuring the characters and worlds you love.',
  description:
    'LocalNinja brings anime-inspired LED lamps to your setup, shelf, and gaming space.',
  contactEmail: 'support@localninja.ca',
  // Scrolling announcement bar above the header.
  announcements: [
    'Free shipping above $55 CAD',
    'Same day delivery for Ottawa*',
    'Secure checkout',
  ],
  usps: [
    { icon: 'clock', text: 'Ships in 48 hours' },
    { icon: 'undo', text: 'Free returns for 30 days' },
    { icon: 'leaf', text: '16 colors, one remote' },
  ],
} as const;
