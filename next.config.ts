import type { NextConfig } from 'next';
import {
  PET_GROOMING_CITY_PATH,
  bengaluruAreas,
  getPetGroomingAreaPath,
  isPublishedPetGroomingArea,
} from './lib/service-areas';

process.env.TZ = 'Asia/Kolkata';

const isDevelopment = process.env.NODE_ENV !== 'production';
const enableStaticWebpRewrite = process.env.NEXT_PUBLIC_ENABLE_STATIC_WEBP_REWRITE === 'true';
const staticWebpRewriteBases = ['/Birthday', '/v1.2.2', '/services'];
const scriptSrcDirective = isDevelopment
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://www.clarity.ms https://scripts.clarity.ms https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://connect.facebook.net"
  : "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://www.clarity.ms https://scripts.clarity.ms https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://connect.facebook.net";

const publicPageCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  },
  {
    key: 'CDN-Cache-Control',
    value: 'public, max-age=3600, stale-while-revalidate=86400',
  },
  {
    key: 'Cloudflare-CDN-Cache-Control',
    value: 'public, max-age=3600, stale-while-revalidate=86400',
  },
];

const publicAssetCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
  },
  {
    key: 'CDN-Cache-Control',
    value: 'public, max-age=604800, stale-while-revalidate=2592000',
  },
  {
    key: 'Cloudflare-CDN-Cache-Control',
    value: 'public, max-age=604800, stale-while-revalidate=2592000',
  },
];

const immutableNextAssetCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=31536000, immutable',
  },
  {
    key: 'CDN-Cache-Control',
    value: 'public, max-age=31536000, immutable',
  },
  {
    key: 'Cloudflare-CDN-Cache-Control',
    value: 'public, max-age=31536000, immutable',
  },
];

const optimizedImageCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
  },
  {
    key: 'CDN-Cache-Control',
    value: 'public, max-age=604800, stale-while-revalidate=2592000',
  },
  {
    key: 'Cloudflare-CDN-Cache-Control',
    value: 'public, max-age=604800, stale-while-revalidate=2592000',
  },
];

const publicPageCacheSources = [
  '/',
  '/pet-grooming/:path*',
  '/locations/:path*',
  '/about',
  '/blog/:path*',
  '/contact-us',
  '/faqs',
  '/privacy-policy',
  '/refer-and-earn',
  '/refund-cancellation-policy',
  '/cancellation-adjustment-policy',
  '/terms-conditions',
];

const publicAssetCacheSources = [
  '/Birthday/:path*',
  '/logo/:path*',
  '/services/:path*',
  '/v1.2.2/:path*',
];

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

const legacyLocationRedirects = bengaluruAreas.map((area) => ({
  source: `/locations/${area.slug}`,
  destination: isPublishedPetGroomingArea(area)
    ? getPetGroomingAreaPath(area)
    : `${PET_GROOMING_CITY_PATH}#bengaluru-coverage`,
  permanent: true,
}));

const nextConfig: NextConfig = {
  experimental: {
    optimizeCss: true,
  },
  async redirects() {
    return [
      ...legacyLocationRedirects,
      {
        source: '/pet-grooming',
        destination: PET_GROOMING_CITY_PATH,
        permanent: true,
      },
      {
        source: '/services/grooming',
        destination: PET_GROOMING_CITY_PATH,
        permanent: true,
      },
      {
        source: '/services/grooming/bangalore',
        destination: PET_GROOMING_CITY_PATH,
        permanent: true,
      },
      {
        source: '/services/grooming/bengaluru',
        destination: PET_GROOMING_CITY_PATH,
        permanent: true,
      },
      {
        source: '/grooming',
        destination: PET_GROOMING_CITY_PATH,
        permanent: true,
      },
      {
        source: '/grooming/:slug',
        destination: '/pet-grooming/:slug',
        permanent: true,
      },
      {
        source: '/services/vet',
        destination: PET_GROOMING_CITY_PATH,
        permanent: true,
      },
      {
        source: '/services/teleconsult',
        destination: PET_GROOMING_CITY_PATH,
        permanent: true,
      },
      {
        source: '/services/vet-visits',
        destination: PET_GROOMING_CITY_PATH,
        permanent: true,
      },
      {
        source: '/services/pet-boarding',
        destination: PET_GROOMING_CITY_PATH,
        permanent: true,
      },
      {
        source: '/services/pet-sitting',
        destination: PET_GROOMING_CITY_PATH,
        permanent: true,
      },
      {
        source: '/services/training',
        destination: PET_GROOMING_CITY_PATH,
        permanent: true,
      },
      {
        source: '/services/pet-birthday',
        destination: PET_GROOMING_CITY_PATH,
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
  async rewrites() {
    if (!enableStaticWebpRewrite) {
      return [];
    }

    return {
      beforeFiles: staticWebpRewriteBases.flatMap((basePath) => [
        {
          source: `${basePath}/:path*.png`,
          destination: `${basePath}/:path*.webp`,
        },
        {
          source: `${basePath}/:path*.jpg`,
          destination: `${basePath}/:path*.webp`,
        },
        {
          source: `${basePath}/:path*.jpeg`,
          destination: `${basePath}/:path*.webp`,
        },
      ]),
    };
  },
  async headers() {
    return [
      ...publicPageCacheSources.map((source) => ({
        source,
        headers: publicPageCacheHeaders,
      })),
      ...publicAssetCacheSources.map((source) => ({
        source,
        headers: publicAssetCacheHeaders,
      })),
      {
        source: '/_next/static/:path*',
        headers: immutableNextAssetCacheHeaders,
      },
      {
        source: '/_next/image/:path*',
        headers: optimizedImageCacheHeaders,
      },
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 70, 75],
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
