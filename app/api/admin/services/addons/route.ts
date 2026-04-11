/**
 * Admin Service Add-on Management Endpoints
 * 
 * POST   /api/admin/services/addons - Create add-on (attach to service)
 * PUT    /api/admin/services/addons/:id - Update add-on
 * DELETE /api/admin/services/addons/:id - Delete add-on
 */

import { NextResponse } from 'next/server';
import type { ServiceAddon, ServiceAddonInput } from "@/lib/service-catalog/types";
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

// CREATE ADD-ON
export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const body: ServiceAddonInput = await request.json();

    const { data, error } = await supabase
      .from("service_addons")
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: data as ServiceAddon },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

