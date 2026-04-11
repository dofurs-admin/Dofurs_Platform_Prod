/**
 * PUT    /api/admin/services/addons/:id - Update add-on
 * DELETE /api/admin/services/addons/:id - Delete add-on
 */

import { NextResponse } from 'next/server';
import type { ServiceAddon, ServiceAddonInput } from "@/lib/service-catalog/types";
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

// UPDATE ADD-ON
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();
    const body: Partial<ServiceAddonInput> = await request.json();

    const { data, error } = await supabase
      .from("service_addons")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ServiceAddon,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "Admin access required" ? 403 : 500 }
    );
  }
}

// DELETE ADD-ON
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from("service_addons")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

