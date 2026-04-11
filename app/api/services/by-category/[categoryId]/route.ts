/**
 * GET /api/services/by-category/[categoryId]
 * Get all active services in a category for a specific provider
 *
 * Query Params:
 * - providerId: string (required) - provider UUID or ID
 *
 * Response:
 * - success: boolean
 * - data: Service[]
 * - error: string (on failure)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import type { Service } from "@/lib/service-catalog/types";
import { toFriendlyApiError } from '@/lib/api/errors';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { isRateLimited } from '@/lib/api/rate-limit';

const byCategoryQuerySchema = z.object({
  categoryId: z.string().uuid(),
  providerId: z.union([z.string().min(1), z.number().int().positive()]),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ categoryId: string }> }
) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rate = isRateLimited(`svc-bycat:${clientIp}`, { windowMs: 60_000, maxRequests: 60 });
  if (rate.limited) {
    return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 });
  }

  try {
    const { categoryId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get("providerId");

    const parsed = byCategoryQuerySchema.safeParse({
      categoryId,
      providerId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase
      .from("provider_services")
      .select("*")
      .eq("category_id", parsed.data.categoryId)
      .eq("provider_id", parsed.data.providerId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      const mapped = toFriendlyApiError(error, 'Failed to load services by category');
      return NextResponse.json(
        { success: false, error: mapped.message },
        { status: mapped.status }
      );
    }

    return NextResponse.json(
      { success: true, data: data as Service[] },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } }
    );
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load services by category');
    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
    );
  }
}
