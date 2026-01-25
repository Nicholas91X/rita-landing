/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "hel1.your-objectstorage.com", pathname: "/**" },
      { protocol: "https", hostname: "ugfcoptwievurfnbrhno.supabase.co", pathname: "/**" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
