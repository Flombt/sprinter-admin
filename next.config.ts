import type { NextConfig } from 'next';

// Le faux backend E2E ne doit jamais accompagner une build de production.
if (process.env.ADMIN_E2E_MOCK === '1' && process.env.NODE_ENV === 'production') {
  throw new Error('ADMIN_E2E_MOCK=1 est interdit en production : le mode maquette est réservé aux tests.');
}

/**
 * En-têtes de sécurité communs à toutes les réponses (§10.2).
 * La CSP, qui dépend d'un nonce par requête, est posée par `proxy.ts`.
 */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'Cache-Control', value: 'private, no-store' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()',
  },
];

const nextConfig: NextConfig = {
  experimental: { optimizePackageImports: ['radix-ui'] },
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
