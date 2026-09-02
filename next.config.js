/** @type {import('next').NextConfig} */

// Sent on every response. The app has no third-party scripts or frames, so the
// policy can stay tight; loosen a directive only when something concrete needs it.
const securityHeaders = [
  // Stop the app being framed into someone else's page (clickjacking).
  { key: 'X-Frame-Options', value: 'DENY' },
  // Never let a browser re-interpret a response as a different content type.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't leak the dashboard URL (or query params) to external sites.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here needs these device APIs.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  // Force HTTPS once deployed. Harmless on localhost (browsers ignore it there).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next injects inline bootstrap scripts (and our theme/currency scripts),
      // so 'unsafe-inline' is required until those move to nonces.
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
      "style-src 'self' 'unsafe-inline'",
      // Google avatars on OAuth sign-in; data: for the inline SVG/PNG icons.
      "img-src 'self' data: blob: https://lh3.googleusercontent.com",
      "font-src 'self' data:",
      // Same-origin API only — no third-party beacons.
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework version to scanners.
  poweredByHeader: false,
  experimental: {
    // Next 14 key. (`serverExternalPackages` is the Next 15 name and is
    // silently ignored here — these packages must stay out of the bundler
    // because they load native/Node-only code at runtime.)
    serverComponentsExternalPackages: ['pdf-parse', 'bcryptjs', 'nodemailer'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Private data must never be stored by a SHARED cache, but the user's
        // own browser may keep a copy as long as it revalidates first — that is
        // what lets the ETags in lib/http.ts turn repeat loads into 304s.
        // Routes that set their own Cache-Control (etagJson) override this.
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache' },
          { key: 'Vary', value: 'Cookie' },
        ],
      },
      {
        // Content-hashed build assets are safe to cache forever.
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
    ];
  },
};
module.exports = nextConfig;
