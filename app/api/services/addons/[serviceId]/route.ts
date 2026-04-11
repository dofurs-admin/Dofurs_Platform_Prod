/**
 * GET /api/services/addons/[serviceId]
 * Get all add-ons for a service
 *
 * Response:
 * - success: boolean
 * - data: ServiceAddon[]
 * - error: string (on failure)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import type { ServiceAddon } from "@/lib/service-catalog/types";
import { toFriendlyApiError } from '@/lib/api/errors';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { isRateLimited } from '@/lib/api/rate-limit';

const addOnsParamsSchema = z.object({
  serviceId: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string }> }
) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rate = isRateLimited(`svc-addons:${clientIp}`, { windowMs: 60_000, maxRequests: 60 });
  if (rate.limited) {
    return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 });
  }

  try {
    const { serviceId } = await context.params;
    const parsed = addOnsParamsSchema.safeParse({ serviceId });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase
      .from("service_addons")
      .select("*")
      .eq("provider_service_id", parsed.data.serviceId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      const mapped = toFriendlyApiError(error, 'Failed to load service add-ons');
      return NextResponse.json(
        { success: false, error: mapped.message },
        { status: mapped.status }
      );
    }

    return NextResponse.json(
      { success: true, data: data as ServiceAddon[] },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } }
    );
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load service add-ons');
    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
    );
  }
}
