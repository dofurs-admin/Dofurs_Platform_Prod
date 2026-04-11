/**
 * Admin Service Management Endpoints
 *
 * POST /api/admin/services/categories - Create category
 */

import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import type { ServiceCategory, ServiceCategoryInput } from '@/lib/service-catalog/types';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();

  try {
    const body: ServiceCategoryInput = await request.json();

    const { data, error } = await supabase.from('service_categories').insert(body).select().single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data as ServiceCategory }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

