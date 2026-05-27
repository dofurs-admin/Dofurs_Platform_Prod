import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { isStaticBlogSlug } from '@/lib/blog-posts';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

const blogPostPatchSchema = z.object({
  slug: slugSchema.optional(),
  title: z.string().trim().min(3).max(180).optional(),
  excerpt: z.string().trim().min(20).max(320).optional(),
  category: z.string().trim().min(2).max(80).optional(),
  read_time: optionalTextSchema,
  published_on: optionalTextSchema,
  date_published: optionalDateSchema,
  date_modified: optionalDateSchema,
  author: optionalTextSchema,
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  hero_image_src: z.string().trim().min(1).max(600).optional(),
  hero_image_alt: z.string().trim().min(5).max(180).optional(),
  sections: z.array(blogSectionSchema).min(1, 'Add at least one section.').optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  display_order: z.coerce.number().int().min(0).max(9999).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.');

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

function buildUpdatePayload(parsed: z.infer<typeof blogPostPatchSchema>) {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined) {
      if (key === 'tags' && Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
        payload[key] = compactTags(value);
      } else if (key === 'author' && value === null) {
        payload[key] = 'Dofurs Editorial';
      } else {
        payload[key] = value;
      }
    }
  }

  if (parsed.status === 'published' && !parsed.date_published) {
    const datePublished = todayIsoDate();
    payload.date_published = datePublished;
    if (!parsed.published_on) {
      payload.published_on = formatDisplayDate(datePublished);
    }
  }

  return payload;
}

function revalidatePublicBlogPaths(slug: string, previousSlug?: string | null) {
  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/blog/${previousSlug}`);
  }
  revalidatePath('/search');
  revalidatePath('/sitemap.xml');
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();

  try {
    const { id } = await context.params;
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!post) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load blog post');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = blogPostPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid blog post payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.slug) {
      if (isStaticBlogSlug(parsed.data.slug)) {
        return NextResponse.json({ error: 'This slug is already used by an existing static blog post.' }, { status: 409 });
      }

      const { data: existingPost, error: existingError } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('slug', parsed.data.slug)
        .neq('id', id)
        .maybeSingle<{ id: string }>();

      if (existingError) {
        throw existingError;
      }

      if (existingPost) {
        return NextResponse.json({ error: 'A blog post with this slug already exists.' }, { status: 409 });
      }
    }

    const { data: existingTarget, error: existingTargetError } = await supabase
      .from('blog_posts')
      .select('slug, status')
      .eq('id', id)
      .maybeSingle<{ slug: string; status: 'draft' | 'published' | 'archived' }>();

    if (existingTargetError) {
      throw existingTargetError;
    }

    if (!existingTarget) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    const { data: post, error } = await supabase
      .from('blog_posts')
      .update(buildUpdatePayload(parsed.data))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!post) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    if (existingTarget.status === 'published' || post.status === 'published') {
      revalidatePublicBlogPaths(post.slug, existingTarget.slug);
    }

    return NextResponse.json({ post });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to update blog post');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();

  try {
    const { id } = await context.params;
    const { data: post, error } = await supabase
      .from('blog_posts')
      .update({ status: 'archived' })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!post) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    revalidatePublicBlogPaths(post.slug);

    return NextResponse.json({ post });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to archive blog post');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}