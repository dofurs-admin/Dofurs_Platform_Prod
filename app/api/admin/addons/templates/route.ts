import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getAddonAdminClient, normalizeSlug } from '@/lib/addons/service';
import type { AddonTemplate } from '@/lib/addons/types';

const addonTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  icon_url: z.string().trim().max(1000).nullable().optional(),
  default_duration_minutes: z.number().int().positive().nullable().optional(),
  default_price: z.number().min(0),
  is_active: z.boolean().optional().default(true),
  moderation_status: z.enum(['draft', 'pending_review', 'approved', 'paused', 'retired']).optional().default('approved'),
});

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const supabase = getAddonAdminClient();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    let query = supabase
      .from('addon_templates')
      .select('*')
      .order('name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: (data ?? []) as AddonTemplate[] });
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
    const parsed = addonTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getAddonAdminClient();
    const actor = auth.context.user;
    const baseSlug = normalizeSlug(parsed.data.slug?.trim() || parsed.data.name);

    let nextSlug = baseSlug;
    for (let index = 2; index <= 100; index += 1) {
      const { data: existing } = await supabase
        .from('addon_templates')
        .select('id')
        .eq('slug', nextSlug)
        .maybeSingle<{ id: string }>();

      if (!existing) {
        break;
      }

      nextSlug = `${baseSlug}-${index}`;
    }

    const payload = {
      name: parsed.data.name,
      slug: nextSlug,
      description: parsed.data.description ?? null,
      icon_url: parsed.data.icon_url ?? null,
      default_duration_minutes: parsed.data.default_duration_minutes ?? null,
      default_price: parsed.data.default_price,
      is_active: parsed.data.is_active,
      moderation_status: parsed.data.moderation_status,
      created_by: actor.id,
      approved_by: parsed.data.moderation_status === 'approved' ? actor.id : null,
      approved_at: parsed.data.moderation_status === 'approved' ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('addon_templates')
      .insert(payload)
      .select('*')
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
