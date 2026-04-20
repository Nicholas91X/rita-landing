import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.b-cdn.net https://lh3.googleusercontent.com https://hel1.your-objectstorage.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.pwnedpasswords.com https://*.upstash.io https://vitals.vercel-insights.com",
  "frame-src 'self' https://js.stripe.com https://iframe.mediadelivery.net",
  "media-src 'self' blob: https://*.b-cdn.net",
  "worker-src 'self' blob:",
  "form-action 'self' https://checkout.stripe.com",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "hel1.your-objectstorage.com", pathname: "/**" },
      { protocol: "https", hostname: "ugfcoptwievurfnbrhno.supabase.co", pathname: "/**" },
      { protocol: "https", hostname: "vz-c25ae704-e5b.b-cdn.net", pathname: "/**" },
      { protocol: "https", hostname: "vz-0ccb063d-cf5.b-cdn.net", pathname: "/**" },
      { protocol: "https", hostname: "cdn.vz-0ccb063d-cf5.b-cdn.net", pathname: "/**" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // CSP in report-only mode — flip to enforcing in PR #3 after verifying no violations.
          { key: "Content-Security-Policy-Report-Only", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
