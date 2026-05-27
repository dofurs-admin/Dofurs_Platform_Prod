import { createClient } from '@supabase/supabase-js';
import {
  getRelatedPostsFromCollection,
  staticBlogPosts,
  type BlogPost,
  type BlogSection,
} from '@/lib/blog-posts';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';

type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  read_time: string | null;
  published_on: string | null;
  date_published: string | null;
  date_modified: string | null;
  author: string | null;
  tags: string[] | null;
  hero_image_src: string;
  hero_image_alt: string;
  sections: unknown;
  status: 'draft' | 'published' | 'archived';
  display_order: number | null;
  created_at: string;
  updated_at: string;
};

const BLOG_POST_SELECT = [
  'id',
  'slug',
  'title',
  'excerpt',
  'category',
  'read_time',
  'published_on',
  'date_published',
  'date_modified',
  'author',
  'tags',
  'hero_image_src',
  'hero_image_alt',
  'sections',
  'status',
  'display_order',
  'created_at',
  'updated_at',
].join(', ');

let publicSupabaseClient: ReturnType<typeof createClient> | null = null;

function getPublicSupabaseClient() {
  if (!publicSupabaseClient) {
    publicSupabaseClient = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return publicSupabaseClient;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function normalizeSections(value: unknown): BlogSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((section) => {
    if (!section || typeof section !== 'object') {
      return [];
    }

    const candidate = section as { heading?: unknown; paragraphs?: unknown; bullets?: unknown };
    if (typeof candidate.heading !== 'string' || !isNonEmptyStringArray(candidate.paragraphs)) {
      return [];
    }

    return [{
      heading: candidate.heading,
      paragraphs: candidate.paragraphs,
      bullets: isNonEmptyStringArray(candidate.bullets) ? candidate.bullets : undefined,
    }];
  });
}

function formatDisplayDate(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function rowToBlogPost(row: BlogPostRow): BlogPost {
  const datePublished = row.date_published ?? row.created_at.slice(0, 10);

  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    readTime: row.read_time ?? '5 min read',
    publishedOn: row.published_on ?? formatDisplayDate(datePublished),
    datePublished,
    dateModified: row.date_modified ?? row.updated_at.slice(0, 10),
    author: row.author ?? 'Dofurs Editorial',
    tags: row.tags ?? [],
    heroImageSrc: row.hero_image_src,
    heroImageAlt: row.hero_image_alt,
    sections: normalizeSections(row.sections),
  };
}

function mergeBlogPosts(databasePosts: BlogPost[]) {
  const databaseSlugs = new Set(databasePosts.map((post) => post.slug));
  return [
    ...databasePosts,
    ...staticBlogPosts.filter((post) => !databaseSlugs.has(post.slug)),
  ];
}

async function loadPublishedDatabaseBlogPosts() {
  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select(BLOG_POST_SELECT)
    .eq('status', 'published')
    .order('display_order', { ascending: true })
    .order('date_published', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .returns<BlogPostRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(rowToBlogPost).filter((post) => post.sections.length > 0);
}

export async function getPublishedBlogPosts() {
  try {
    const databasePosts = await loadPublishedDatabaseBlogPosts();
    return mergeBlogPosts(databasePosts);
  } catch (error) {
    console.error('[blog] Failed to load database-backed posts:', error);
    return staticBlogPosts;
  }
}

export async function getPublishedBlogPostBySlug(slug: string) {
  try {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase
      .from('blog_posts')
      .select(BLOG_POST_SELECT)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle<BlogPostRow>();

    if (error) {
      throw error;
    }

    if (data) {
      const post = rowToBlogPost(data);
      if (post.sections.length > 0) {
        return post;
      }
    }
  } catch (error) {
    console.error(`[blog] Failed to load database-backed post "${slug}":`, error);
  }

  return staticBlogPosts.find((post) => post.slug === slug) ?? null;
}

export async function getRelatedPublishedBlogPosts(slug: string, limit = 3) {
  const posts = await getPublishedBlogPosts();
  return getRelatedPostsFromCollection(posts, slug, limit);
}