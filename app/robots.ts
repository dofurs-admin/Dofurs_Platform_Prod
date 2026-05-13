import type { MetadataRoute } from 'next';

const SITE_URL = 'https://dofurs.in';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/dashboard/',
          '/forms/',
          '/search',
          '/*?*', // avoid indexing tracking-parameter duplicates
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
