import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getAddonAdminClient } from '@/lib/addons/service';

const mappingSchema = z.object({
  provider_service_id: z.string().uuid(),
  addon_template_id: z.string().uuid(),
  price_override: z.number().min(0).nullable().optional(),
  min_quantity: z.number().int().min(0).default(0),
  max_quantity: z.number().int().min(1).default(10),
  default_quantity: z.number().int().min(0).default(0),
  is_required: z.boolean().default(false),
  is_active: z.boolean().default(true),
  display_order: z.number().int().default(0),
  moderation_status: z.enum(['draft', 'pending_review', 'approved', 'paused', 'retired']).default('approved'),
});

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

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
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = mappingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.default_quantity > parsed.data.max_quantity || parsed.data.default_quantity < parsed.data.min_quantity) {
      return NextResponse.json({ success: false, error: 'default_quantity must be between min_quantity and max_quantity.' }, { status: 400 });
    }

    const supabase = getAddonAdminClient();
    const actor = auth.context.user;

    const payload = {
      ...parsed.data,
      source_role: 'admin',
      created_by: actor.id,
      approved_by: parsed.data.moderation_status === 'approved' ? actor.id : null,
      approved_at: parsed.data.moderation_status === 'approved' ? new Date().toISOString() : null,
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
