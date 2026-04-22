import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  customWorkerDir: "worker",
  fallbacks: { document: "/offline" },
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.b-cdn\.net\/.*\.(png|jpg|jpeg|webp)$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "bunny-thumbnails",
          expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 },
        },
      },
      {
        urlPattern: /^\/dashboard(\/.*)?$/,
        handler: "NetworkFirst",
        options: { cacheName: "dashboard-shell", networkTimeoutSeconds: 3 },
      },
      // Catch-all for any other same-origin navigation. Required for the
      // `fallbacks.document` → /offline rule to fire on arbitrary routes
      // (next-pwa only invokes fallback via `handlerDidError` on registered
      // routes; without this, uncached URLs go straight to Chrome's native
      // offline error page).
      {
        urlPattern: ({ request, sameOrigin }) =>
          sameOrigin && request.mode === "navigate",
        handler: "NetworkFirst",
        options: { cacheName: "pages", networkTimeoutSeconds: 3 },
      },
    ],
  },
  disable: process.env.NODE_ENV === "development",
});

// CSP directives.
// - `vercel.live` is allowed in script-src/frame-src so the Vercel Live feedback
//   widget still works on preview deploys (it's injected only there; harmless in prod).
// - `iframe.mediadelivery.net` in media-src covers the Bunny Stream player's
//   internal media loads (report-only period surfaced a violation there).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.b-cdn.net https://lh3.googleusercontent.com https://hel1.your-objectstorage.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.pwnedpasswords.com https://*.upstash.io https://vitals.vercel-insights.com https://vercel.live wss://ws-us3.pusher.com",
  "frame-src 'self' https://js.stripe.com https://iframe.mediadelivery.net https://vercel.live",
  "media-src 'self' blob: https://*.b-cdn.net https://iframe.mediadelivery.net https://hel1.your-objectstorage.com",
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
          { key: "Content-Security-Policy", value: csp },
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
