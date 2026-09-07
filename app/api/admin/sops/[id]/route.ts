import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logAdminAction } from '@/lib/admin/audit';
import { getISTTimestamp } from '@/lib/utils/date';

type RouteContext = { params: Promise<{ id: string }> };

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

const SOP_SELECT =
  'id, slug, title, instructions, requires_photo, min_photo_count, max_photo_count, mandatory, service_type, sort_order, status, version, created_at, updated_at';

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  instructions: z.string().trim().max(2000).nullable().optional(),
  requiresPhoto: z.boolean().optional(),
  minPhotoCount: z.number().int().min(0).max(10).optional(),
  maxPhotoCount: z.number().int().min(1).max(20).optional(),
  mandatory: z.boolean().optional(),
  serviceType: z.string().trim().max(60).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/** Fields whose edits change provider-facing requirements → version bump. */
const VERSIONED_FIELDS = [
  'title',
  'instructions',
  'requires_photo',
  'min_photo_count',
  'max_photo_count',
  'mandatory',
  'service_type',
] as const;

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { user } = auth.context;
  const { id } = await context.params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid SOP id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { title, instructions, requiresPhoto, minPhotoCount, maxPhotoCount, mandatory, serviceType, sortOrder, status } =
    parsed.data;

  const minPhotos = minPhotoCount ?? 0;
  const maxPhotos = maxPhotoCount ?? 1;
  if ((minPhotoCount !== undefined || maxPhotoCount !== undefined) && minPhotos > maxPhotos) {
    return NextResponse.json({ error: 'Minimum photo count cannot exceed the maximum.' }, { status: 400 });
  }

  try {
    const adminSupabase = getSupabaseAdminClient();

    const { data: existing, error: existingError } = await adminSupabase
      .from('provider_sops')
      .select(SOP_SELECT)
      .eq('id', id)
      .maybeSingle<AdminSopRow>();

    if (existingError) {
      throw existingError;
    }

    if (!existing) {
      return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (title !== undefined) updatePayload.title = title;
    if (instructions !== undefined) updatePayload.instructions = instructions?.trim() || null;
    if (requiresPhoto !== undefined) updatePayload.requires_photo = requiresPhoto;
    if (minPhotoCount !== undefined) updatePayload.min_photo_count = minPhotoCount;
    if (maxPhotoCount !== undefined) updatePayload.max_photo_count = maxPhotoCount;
    if (mandatory !== undefined) updatePayload.mandatory = mandatory;
    if (serviceType !== undefined) updatePayload.service_type = serviceType?.trim() || null;
    if (sortOrder !== undefined) updatePayload.sort_order = sortOrder;
    if (status !== undefined) updatePayload.status = status;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ sop: existing });
    }

    const requirementChanged = VERSIONED_FIELDS.some((field) => field in updatePayload);
    if (requirementChanged) {
      updatePayload.version = existing.version + 1;
    }

    const { data: sop, error } = await adminSupabase
      .from('provider_sops')
      .update(updatePayload)
      .eq('id', id)
      .select(SOP_SELECT)
      .single<AdminSopRow>();

    if (error) {
      throw error;
    }

    void logAdminAction({
      adminUserId: user.id,
      action: 'sop.update',
      entityType: 'provider_sop',
      entityId: id,
      oldValue: {
        title: existing.title,
        requires_photo: existing.requires_photo,
        mandatory: existing.mandatory,
        status: existing.status,
        version: existing.version,
      },
      newValue: {
        title: sop.title,
        requires_photo: sop.requires_photo,
        mandatory: sop.mandatory,
        status: sop.status,
        version: sop.version,
      },
      metadata: { source: 'api/admin/sops/[id]', at: getISTTimestamp() },
      request,
    });

    return NextResponse.json({ sop });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to update SOP');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

/** SOPs are archived (never hard-deleted) — submissions reference them for audit. */
export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { user } = auth.context;
  const { id } = await context.params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid SOP id' }, { status: 400 });
  }

  try {
    const adminSupabase = getSupabaseAdminClient();

    const { data: sop, error } = await adminSupabase
      .from('provider_sops')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select(SOP_SELECT)
      .single<AdminSopRow>();

    if (error) {
      throw error;
    }

    void logAdminAction({
      adminUserId: user.id,
      action: 'sop.archive',
      entityType: 'provider_sop',
      entityId: id,
      oldValue: { status: 'active' },
      newValue: { status: 'inactive' },
      metadata: { source: 'api/admin/sops/[id]', at: getISTTimestamp() },
      request,
    });

    return NextResponse.json({ sop });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to archive SOP');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
