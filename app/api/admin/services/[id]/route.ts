/**
 * Admin Service Management API
 * PUT    /api/admin/services/[id] - Update service
 * DELETE /api/admin/services/[id] - Delete service
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const serviceUpdateSchema = z.object({
  provider_id: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  category_id: z.string().optional().nullable(),
  service_type: z.string().min(1).optional(),
  slug: z.string().optional().nullable(),
  short_description: z.string().optional().nullable(),
  full_description: z.string().optional().nullable(),
  service_mode: z.enum(['home_visit', 'clinic_visit', 'teleconsult']).optional(),
  icon_url: z.string().optional().nullable(),
  banner_image_url: z.string().optional().nullable(),
  base_price: z.number().min(0).optional(),
  surge_price: z.number().optional().nullable(),
  commission_percentage: z.number().min(0).max(100).optional().nullable(),
  service_duration_minutes: z.number().int().positive().optional().nullable(),
  display_order: z.number().optional(),
  is_featured: z.boolean().optional(),
  is_active: z.boolean().optional(),
  requires_pet_details: z.boolean().optional(),
  requires_location: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = serviceUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { data: service, error } = await supabase
      .from('provider_services')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ service });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();

  try {
    const { id } = await context.params;

    // Nullify provider_service_id on any bookings that reference this service
    // so booking history is preserved while the FK is released.
    const { error: unlinkError } = await supabase
      .from('bookings')
      .update({ provider_service_id: null })
      .eq('provider_service_id', id);

    if (unlinkError) {
      return NextResponse.json({ error: unlinkError.message }, { status: 500 });
    }

    const { error } = await supabase
      .from('provider_services')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
