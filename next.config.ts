import type { NextConfig } from 'next';

process.env.TZ = 'Asia/Kolkata';

const isDevelopment = process.env.NODE_ENV !== 'production';
const scriptSrcDirective = isDevelopment
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://scripts.clarity.ms https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://connect.facebook.net"
  : "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://scripts.clarity.ms https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://connect.facebook.net";

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      scriptSrcDirective,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://images.unsplash.com https://eyrmedtujdfeohdoofrx.supabase.co https://*.razorpay.com https://*.tile.openstreetmap.org https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://stats.g.doubleclick.net https://googleads.g.doubleclick.net https://www.google.com https://www.google.co.in https://www.facebook.com https://connect.facebook.net",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://www.clarity.ms https://nominatim.openstreetmap.org https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://stats.g.doubleclick.net https://googleads.g.doubleclick.net https://www.googleadservices.com https://www.google.com https://www.google.co.in https://www.facebook.com https://connect.facebook.net https://graph.facebook.com",
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.googletagmanager.com https://td.doubleclick.net",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/services/grooming',
        destination: '/services/grooming/bengaluru',
        permanent: true,
      },
      {
        source: '/services/grooming/bangalore',
        destination: '/services/grooming/bengaluru',
        permanent: true,
      },
      {
        source: '/services/vet',
        destination: '/services/grooming/bengaluru',
        permanent: true,
      },
      {
        source: '/services/teleconsult',
        destination: '/services/grooming/bengaluru',
        permanent: true,
      },
      {
        source: '/services/vet-visits',
        destination: '/services/grooming/bengaluru',
        permanent: true,
      },
      {
        source: '/services/pet-boarding',
        destination: '/services/grooming/bengaluru',
        permanent: true,
      },
      {
        source: '/services/pet-sitting',
        destination: '/services/grooming/bengaluru',
        permanent: true,
      },
      {
        source: '/services/training',
        destination: '/services/grooming/bengaluru',
        permanent: true,
      },
      {
        source: '/services/pet-birthday',
        destination: '/services/grooming/bengaluru',
        permanent: true,
      },
      {
        source: '/blog/home-vet-visit-preparation-guide',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/blog/questions-before-booking-pet-sitter',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/blog/do-vaccinated-pets-live-longer',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/blog/why-missing-vaccines-shortens-pet-life',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/blog/vaccine-tracking-increases-pet-lifespan',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/blog/pet-grooming-cost-bangalore-2026',
        destination: '/blog/pet-grooming-cost-bengaluru-2026',
        permanent: true,
      },
      {
        source: '/blog/summer-pet-care-bangalore',
        destination: '/blog/summer-pet-care-bengaluru',
        permanent: true,
      },
      {
        source: '/blog/golden-retriever-grooming-bangalore',
        destination: '/blog/golden-retriever-grooming-bengaluru',
        permanent: true,
      },
      {
        source: '/blog/pet-boarding-vs-pet-sitting-bangalore',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/blog/puppy-vaccination-schedule-india',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/blog/finding-trusted-vet-bangalore',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/blog/pet-friendly-bangalore-guide',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/blog/emergency-pet-care-bangalore',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/blog/boarding-vs-sitting-bangalore.svg',
        destination: '/blog/boarding-vs-sitting-bengaluru.svg',
        permanent: true,
      },
      {
        source: '/blog/emergency-pet-care-bangalore.svg',
        destination: '/blog/emergency-pet-care-bengaluru.svg',
        permanent: true,
      },
      {
        source: '/blog/finding-trusted-vet-bangalore.svg',
        destination: '/blog/finding-trusted-vet-bengaluru.svg',
        permanent: true,
      },
      {
        source: '/blog/golden-retriever-grooming-bangalore.svg',
        destination: '/blog/golden-retriever-grooming-bengaluru.svg',
        permanent: true,
      },
      {
        source: '/blog/pet-friendly-bangalore.svg',
        destination: '/blog/pet-friendly-bengaluru.svg',
        permanent: true,
      },
      {
        source: '/blog/pet-grooming-cost-bangalore.svg',
        destination: '/blog/pet-grooming-cost-bengaluru.svg',
        permanent: true,
      },
      {
        source: '/blog/summer-pet-care-bangalore.svg',
        destination: '/blog/summer-pet-care-bengaluru.svg',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'eyrmedtujdfeohdoofrx.supabase.co',
      },
    ],
  },
};

export default nextConfig;
