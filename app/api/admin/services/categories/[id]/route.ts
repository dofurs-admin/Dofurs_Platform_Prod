/**
 * PUT    /api/admin/services/categories/[id] - Update category
 * DELETE /api/admin/services/categories/[id] - Delete category
 */

import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import type { ServiceCategory, ServiceCategoryInput } from '@/lib/service-catalog/types';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();

  try {
    const { id } = await context.params;
    const body: Partial<ServiceCategoryInput> = await request.json();

    const { data, error } = await supabase.from('service_categories').update(body).eq('id', id).select().single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data as ServiceCategory });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();

  try {
    const { id } = await context.params;

    const { error } = await supabase.from('service_categories').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

