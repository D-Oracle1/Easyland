// NOTE: next-pwa was removed. Its precaching service worker served stale
// assets after deploys and broke client-side navigation until users cleared
// site data. public/sw.js is now a self-unregistering kill switch that cleans
// up any previously-installed worker. Do not re-add a precaching SW without a
// reliable per-deploy cache-busting/update strategy.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  turbopack: {},
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts', '@radix-ui/react-icons'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '*.vercel.app' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          // camera/mic: calls, voice notes, QR scanner; geolocation: attendance
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), browsing-topics=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/create-Director',
        destination: '/create-director',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();
    return {
      // Browsers fetch these well-known paths on their own; serve the generated
      // app icon (logo on the brand tile) instead of the old static files.
      beforeFiles: [
        { source: '/favicon.ico', destination: '/api/app-icon/favicon' },
        { source: '/apple-touch-icon.png', destination: '/api/app-icon/apple' },
        { source: '/apple-touch-icon-precomposed.png', destination: '/api/app-icon/apple' },
      ],
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
