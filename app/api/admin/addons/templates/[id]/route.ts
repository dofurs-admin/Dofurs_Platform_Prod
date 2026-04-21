import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getAddonAdminClient, normalizeSlug } from '@/lib/addons/service';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  icon_url: z.string().trim().max(1000).nullable().optional(),
  default_duration_minutes: z.number().int().positive().nullable().optional(),
  default_price: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
  moderation_status: z.enum(['draft', 'pending_review', 'approved', 'paused', 'retired']).optional(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getAddonAdminClient();
    const payload: Record<string, unknown> = {
      ...parsed.data,
      description: parsed.data.description ?? null,
      icon_url: parsed.data.icon_url ?? null,
      default_duration_minutes: parsed.data.default_duration_minutes ?? null,
    };

    if (parsed.data.name || parsed.data.slug) {
      const baseSlug = normalizeSlug(parsed.data.slug ?? parsed.data.name ?? 'addon');
      payload.slug = baseSlug;
    }

    if (parsed.data.moderation_status === 'approved') {
      payload.approved_by = auth.context.user.id;
      payload.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('addon_templates')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const supabase = getAddonAdminClient();

    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    if (hardDelete) {
      const { data: bookingUsage, error: bookingUsageError } = await supabase
        .from('booking_addon_items')
        .select('id')
        .eq('addon_template_id', id)
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (bookingUsageError) {
        return NextResponse.json({ success: false, error: bookingUsageError.message }, { status: 500 });
      }

      if (bookingUsage) {
        return NextResponse.json(
          {
            success: false,
            error: 'This add-on template is used in booking history and cannot be permanently deleted. Retire it instead.',
          },
          { status: 409 },
        );
      }

      const { error: mappingsError } = await supabase
        .from('provider_service_addon_mappings')
        .delete()
        .eq('addon_template_id', id);

      if (mappingsError) {
        return NextResponse.json({ success: false, error: mappingsError.message }, { status: 500 });
      }

      const { error: deleteError } = await supabase
        .from('addon_templates')
        .delete()
        .eq('id', id);

      if (deleteError) {
        return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, hardDeleted: true });
    }

    const { error } = await supabase
      .from('addon_templates')
      .update({ moderation_status: 'retired', is_active: false })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, retired: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
