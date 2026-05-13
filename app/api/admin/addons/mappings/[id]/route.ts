import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getAddonAdminClient } from '@/lib/addons/service';

const updateSchema = z.object({
  price_override: z.number().min(0).nullable().optional(),
  min_quantity: z.number().int().min(0).optional(),
  max_quantity: z.number().int().min(1).optional(),
  default_quantity: z.number().int().min(0).optional(),
  is_required: z.boolean().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().optional(),
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

    const { data: existing, error: existingError } = await supabase
      .from('provider_service_addon_mappings')
      .select('id, min_quantity, max_quantity, default_quantity')
      .eq('id', id)
      .single<{ id: string; min_quantity: number; max_quantity: number; default_quantity: number }>();

    if (existingError || !existing) {
      return NextResponse.json({ success: false, error: existingError?.message ?? 'Mapping not found.' }, { status: 404 });
    }

    const nextMin = parsed.data.min_quantity ?? existing.min_quantity;
    const nextMax = parsed.data.max_quantity ?? existing.max_quantity;
    const nextDefault = parsed.data.default_quantity ?? existing.default_quantity;

    if (nextDefault > nextMax || nextDefault < nextMin) {
      return NextResponse.json({ success: false, error: 'default_quantity must be between min_quantity and max_quantity.' }, { status: 400 });
    }

    const payload: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.moderation_status === 'approved') {
      payload.approved_by = auth.context.user.id;
      payload.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('provider_service_addon_mappings')
      .update(payload)
      .eq('id', id)
      .select('*, addon_templates(*)')
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
      const { error: deleteError } = await supabase
        .from('provider_service_addon_mappings')
        .delete()
        .eq('id', id);

      if (deleteError) {
        return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, hardDeleted: true });
    }

    const { error } = await supabase
      .from('provider_service_addon_mappings')
      .update({ is_active: false, moderation_status: 'retired' })
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
