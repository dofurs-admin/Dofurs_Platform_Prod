import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logAdminAction } from '@/lib/admin/audit';
import { getISTTimestamp } from '@/lib/utils/date';

type AdminSopRow = {
  id: string;
  slug: string;
  title: string;
  instructions: string | null;
  requires_photo: boolean;
  min_photo_count: number;
  max_photo_count: number;
  mandatory: boolean;
  service_type: string | null;
  sort_order: number;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
    .max(120)
    .optional(),
  instructions: z.string().trim().max(2000).optional(),
  requiresPhoto: z.boolean(),
  minPhotoCount: z.number().int().min(0).max(10),
  maxPhotoCount: z.number().int().min(1).max(20),
  mandatory: z.boolean(),
  serviceType: z.string().trim().max(60).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999),
});

function slugifyTitle(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return slug.length > 0 ? slug : `sop-${Date.now()}`;
}

export async function GET() {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const adminSupabase = getSupabaseAdminClient();

    const { data: sops, error } = await adminSupabase
      .from('provider_sops')
      .select(
        'id, slug, title, instructions, requires_photo, min_photo_count, max_photo_count, mandatory, service_type, sort_order, status, version, created_at, updated_at',
      )
      .order('status', { ascending: true })
      .order('sort_order', { ascending: true })
      .returns<AdminSopRow[]>();

    if (error) {
      throw error;
    }

    // Last-30-day usage counts for compliance visibility.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: usage, error: usageError } = await adminSupabase
      .from('booking_sop_submissions')
      .select('sop_id, status')
      .gte('created_at', since)
      .returns<Array<{ sop_id: string; status: string }>>();

    const usageBySopId = new Map<string, Record<string, number>>();
    if (!usageError && usage) {
      for (const row of usage) {
        const counts = usageBySopId.get(row.sop_id) ?? {};
        counts[row.status] = (counts[row.status] ?? 0) + 1;
        usageBySopId.set(row.sop_id, counts);
      }
    }

    return NextResponse.json({
      sops: (sops ?? []).map((sop) => ({
        ...sop,
        usage: {
          pending: usageBySopId.get(sop.id)?.pending ?? 0,
          submitted: usageBySopId.get(sop.id)?.submitted ?? 0,
          approved: usageBySopId.get(sop.id)?.approved ?? 0,
          rejected: usageBySopId.get(sop.id)?.rejected ?? 0,
          waived: usageBySopId.get(sop.id)?.waived ?? 0,
        },
      })),
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load SOPs');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { user } = auth.context;
  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.minPhotoCount > parsed.data.maxPhotoCount) {
    return NextResponse.json({ error: 'Minimum photo count cannot exceed the maximum.' }, { status: 400 });
  }

  try {
    const adminSupabase = getSupabaseAdminClient();
    const slug = parsed.data.slug ?? slugifyTitle(parsed.data.title);

    const { data: existing, error: existingError } = await adminSupabase
      .from('provider_sops')
      .select('id')
      .eq('slug', slug)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return NextResponse.json({ error: 'An SOP with this slug already exists.' }, { status: 400 });
    }

    const { data: sop, error } = await adminSupabase
      .from('provider_sops')
      .insert({
        slug,
        title: parsed.data.title,
        instructions: parsed.data.instructions?.trim() || null,
        requires_photo: parsed.data.requiresPhoto,
        min_photo_count: parsed.data.minPhotoCount,
        max_photo_count: parsed.data.maxPhotoCount,
        mandatory: parsed.data.mandatory,
        service_type: parsed.data.serviceType?.trim() || null,
        sort_order: parsed.data.sortOrder,
        status: 'active',
        version: 1,
        created_by: user.id,
      })
      .select(
        'id, slug, title, instructions, requires_photo, min_photo_count, max_photo_count, mandatory, service_type, sort_order, status, version, created_at, updated_at',
      )
      .single<AdminSopRow>();

    if (error) {
      throw error;
    }

    void logAdminAction({
      adminUserId: user.id,
      action: 'sop.create',
      entityType: 'provider_sop',
      entityId: sop.id,
      newValue: { title: sop.title, slug: sop.slug, mandatory: sop.mandatory, requires_photo: sop.requires_photo },
      metadata: { source: 'api/admin/sops', at: getISTTimestamp() },
      request,
    });

    return NextResponse.json({ sop });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to create SOP');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
