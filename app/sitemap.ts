import type { MetadataRoute } from 'next';
import { getPublishedBlogPosts } from '@/lib/blog-posts.server';
import { getPetGroomingAreaPath, publishedBengaluruPetGroomingAreas } from '@/lib/service-areas';

const SITE_URL = 'https://dofurs.in';

function toAbsolute(pathOrUrl: string): string {
  if (!pathOrUrl) return `${SITE_URL}/logo/og-default.jpg`;
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const blogPosts = await getPublishedBlogPosts();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/contact-us`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/faqs`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/services`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/pet-grooming/bengaluru`, lastModified: now, changeFrequency: 'weekly', priority: 0.98 },
    { url: `${SITE_URL}/locations`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${SITE_URL}/refer-and-earn`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/privacy-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms-conditions`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/cancellation-adjustment-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => {
    const lastMod = parseIsoDate(post.dateModified) ?? parseIsoDate(post.datePublished) ?? parsePublishedDate(post.publishedOn) ?? now;
    const imageUrl = toAbsolute(post.heroImageSrc);
    return {
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: lastMod,
      changeFrequency: 'monthly',
      priority: 0.8,
      images: [imageUrl],
    };
  });

  const petGroomingLocationRoutes: MetadataRoute.Sitemap = publishedBengaluruPetGroomingAreas.map((area) => ({
    url: `${SITE_URL}${getPetGroomingAreaPath(area)}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...blogRoutes, ...petGroomingLocationRoutes];
}

function parsePublishedDate(input: string): Date | null {
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseIsoDate(input: string | undefined): Date | null {
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
