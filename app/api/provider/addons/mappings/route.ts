import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getAddonAdminClient } from '@/lib/addons/service';

const providerMappingSchema = z.object({
  provider_service_id: z.string().uuid(),
  addon_template_id: z.string().uuid(),
  price_override: z.number().min(0).nullable().optional(),
  min_quantity: z.number().int().min(0).default(0),
  max_quantity: z.number().int().min(1).default(10),
  default_quantity: z.number().int().min(0).default(0),
  is_required: z.boolean().default(false),
  is_active: z.boolean().default(true),
  display_order: z.number().int().default(0),
});

export async function GET(request: Request) {
  const auth = await requireApiRole(['provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  try {
    const supabase = getAddonAdminClient();
    const { searchParams } = new URL(request.url);
    const providerServiceId = searchParams.get('providerServiceId');

    let query = supabase
      .from('provider_service_addon_mappings')
      .select('*, addon_templates(*)')
      .order('display_order', { ascending: true });

    if (providerServiceId) {
      query = query.eq('provider_service_id', providerServiceId);
    }

    if (auth.context.role === 'provider') {
      query = query.eq('source_role', 'provider');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(['provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = providerMappingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getAddonAdminClient();
    const actor = auth.context.user;
    const role = auth.context.role;

    const moderationStatus = role === 'provider' ? 'pending_review' : 'approved';

    const payload = {
      ...parsed.data,
      source_role: role === 'provider' ? 'provider' : 'admin',
      moderation_status: moderationStatus,
      created_by: actor.id,
      approved_by: moderationStatus === 'approved' ? actor.id : null,
      approved_at: moderationStatus === 'approved' ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('provider_service_addon_mappings')
      .upsert(payload, { onConflict: 'provider_service_id,addon_template_id' })
      .select('*, addon_templates(*)')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
