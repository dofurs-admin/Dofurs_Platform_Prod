import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getAddonAdminClient } from '@/lib/addons/service';

const providerUpdateSchema = z.object({
  price_override: z.number().min(0).nullable().optional(),
  min_quantity: z.number().int().min(0).optional(),
  max_quantity: z.number().int().min(1).optional(),
  default_quantity: z.number().int().min(0).optional(),
  is_required: z.boolean().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = providerUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getAddonAdminClient();
    const moderationStatus = auth.context.role === 'provider' ? 'pending_review' : 'approved';
    const payload: Record<string, unknown> = {
      ...parsed.data,
      moderation_status: moderationStatus,
      approved_by: moderationStatus === 'approved' ? auth.context.user.id : null,
      approved_at: moderationStatus === 'approved' ? new Date().toISOString() : null,
    };

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
