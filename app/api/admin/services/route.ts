/**
 * Admin Service Management API
 * POST   /api/admin/services - Create service
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const serviceSchema = z.object({
  provider_id: z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null),
  category_id: z.string().optional().nullable(),
  service_type: z.string().min(1),
  slug: z.string().optional().nullable(),
  short_description: z.string().optional().nullable(),
  full_description: z.string().optional().nullable(),
  service_mode: z.enum(['home_visit', 'clinic_visit', 'teleconsult']),
  icon_url: z.string().optional().nullable(),
  banner_image_url: z.string().optional().nullable(),
  base_price: z.number().min(0),
  surge_price: z.number().optional().nullable(),
  commission_percentage: z.number().min(0).max(100).optional().nullable(),
  service_duration_minutes: z.number().int().positive().optional().nullable(),
  display_order: z.number().default(0),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
  requires_pet_details: z.boolean().default(true),
  requires_location: z.boolean().default(true),
});

export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();

  try {
    const body = await request.json();
    const parsed = serviceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { data: service, error } = await supabase
      .from('provider_services')
      .insert([parsed.data])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();

  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');
    const isActive = searchParams.get('is_active');

    let query = supabase
      .from('provider_services')
      .select(`
        *,
        service_categories(id, name, slug),
        providers(id, name)
      `)
      .order('display_order', { ascending: true });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data: services, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ services });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
