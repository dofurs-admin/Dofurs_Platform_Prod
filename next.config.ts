import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV !== 'production';
const scriptSrcDirective = isDevelopment
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://scripts.clarity.ms https://cdn.jsdelivr.net"
  : "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://scripts.clarity.ms https://cdn.jsdelivr.net";

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
      "img-src 'self' data: blob: https://images.unsplash.com https://eyrmedtujdfeohdoofrx.supabase.co https://*.razorpay.com https://*.tile.openstreetmap.org",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://www.clarity.ms https://nominatim.openstreetmap.org",
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
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
