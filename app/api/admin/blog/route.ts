import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { isStaticBlogSlug } from '@/lib/blog-posts';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const slugSchema = z
  .string()
  .trim()
  .min(3, 'Slug must be at least 3 characters.')
  .max(120, 'Slug must be 120 characters or fewer.')
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), 'Use lowercase letters, numbers, and single hyphens only.');

const optionalTextSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().trim().min(1).nullable().optional(),
);

const optionalDateSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
);

const blogSectionSchema = z.object({
  heading: z.string().trim().min(1, 'Section heading is required.'),
  paragraphs: z.array(z.string().trim().min(1)).min(1, 'Add at least one paragraph.'),
  bullets: z.array(z.string().trim().min(1)).optional(),
});

const blogPostCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(3).max(180),
  excerpt: z.string().trim().min(20).max(320),
  category: z.string().trim().min(2).max(80),
  read_time: optionalTextSchema,
  published_on: optionalTextSchema,
  date_published: optionalDateSchema,
  date_modified: optionalDateSchema,
  author: optionalTextSchema,
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional().default([]),
  hero_image_src: z.string().trim().min(1).max(600),
  hero_image_alt: z.string().trim().min(5).max(180),
  sections: z.array(blogSectionSchema).min(1, 'Add at least one section.'),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  display_order: z.coerce.number().int().min(0).max(9999).optional().default(0),
});

function formatDisplayDate(isoDate: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(`${isoDate}T00:00:00+05:30`));
}

function todayIsoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function compactTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function buildCreatePayload(parsed: z.infer<typeof blogPostCreateSchema>, userId: string) {
  const datePublished = parsed.date_published ?? (parsed.status === 'published' ? todayIsoDate() : null);

  return {
    slug: parsed.slug,
    title: parsed.title,
    excerpt: parsed.excerpt,
    category: parsed.category,
    read_time: parsed.read_time ?? '5 min read',
    published_on: parsed.published_on ?? (datePublished ? formatDisplayDate(datePublished) : null),
    date_published: datePublished,
    date_modified: parsed.date_modified ?? null,
    author: parsed.author ?? 'Dofurs Editorial',
    tags: compactTags(parsed.tags),
    hero_image_src: parsed.hero_image_src,
    hero_image_alt: parsed.hero_image_alt,
    sections: parsed.sections,
    status: parsed.status,
    display_order: parsed.display_order,
    created_by: userId,
  };
}

function revalidatePublicBlogPaths(slug: string) {
  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
  revalidatePath('/search');
  revalidatePath('/sitemap.xml');
}

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'all';
  const page = Math.max(Number(searchParams.get('page') ?? 1), 1);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 50), 1), 100);
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('blog_posts')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === 'draft' || status === 'published' || status === 'archived') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      posts: data ?? [],
      total: count ?? 0,
      page,
      pageSize: limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load blog posts');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();

  try {
    const body = await request.json();
    const parsed = blogPostCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid blog post payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (isStaticBlogSlug(parsed.data.slug)) {
      return NextResponse.json({ error: 'This slug is already used by an existing static blog post.' }, { status: 409 });
    }

    const { data: existingPost, error: existingError } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', parsed.data.slug)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      throw existingError;
    }

    if (existingPost) {
      return NextResponse.json({ error: 'A blog post with this slug already exists.' }, { status: 409 });
    }

    const payload = buildCreatePayload(parsed.data, auth.context.user.id);
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    if (post.status === 'published') {
      revalidatePublicBlogPaths(post.slug);
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to create blog post');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}