import type { NextConfig } from "next";

// Pragmatic Content-Security-Policy. script-src/style-src keep 'unsafe-inline'
// because Next.js injects inline runtime scripts and the theme pre-paint inline
// script (src/theme/init-script.ts); a strict nonce-based CSP would require
// middleware. The high-value restrictions (frame-ancestors, connect-src,
// img-src, object-src, form-action) are still enforced.
const isDev = process.env.NODE_ENV !== 'production';

// The browser makes client-side calls (checkout, cart stock refresh, reviews,
// account, order polling) to the API — which lives on a DIFFERENT origin than
// the storefront. connect-src must allow it, or every client fetch is blocked.
// In dev the API is http://localhost:3002 (from NEXT_PUBLIC_API_URL); in prod it
// is the Cloud Run URL (covered by https://*.run.app). We include the explicit
// NEXT_PUBLIC_API_URL origin so whichever backend it points at is allowed, plus
// ws: in dev for Next's HMR socket.
const apiOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
      : '';
  } catch {
    return '';
  }
})();

const connectSrc = [
  "'self'",
  apiOrigin,
  'https://*.googleapis.com',
  'https://*.run.app',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  isDev ? 'ws: http://localhost:*' : '',
]
  .filter(Boolean)
  .join(' ');

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://picsum.photos https://*.googleusercontent.com data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "frame-src https://*.firebaseapp.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://checkout.stripe.com",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: CSP },
];

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: 'picsum.photos' }] },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
