/**
 * GET /api/services/categories
 * Get all active service categories
 *
 * Query Params:
 * - featured: boolean (optional) - filter to featured only
 *
 * Response:
 * - success: boolean
 * - data: ServiceCategory[]
 * - error: string (on failure)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import type { ServiceCategory } from "@/lib/service-catalog/types";
import { toFriendlyApiError } from '@/lib/api/errors';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { isRateLimited } from '@/lib/api/rate-limit';

const categoriesQuerySchema = z.object({
  featured: z.enum(['true', 'false']).optional(),
});

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rate = isRateLimited(`svc-cat:${clientIp}`, { windowMs: 60_000, maxRequests: 60 });
  if (rate.limited) {
    return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = categoriesQuerySchema.safeParse({
      featured: searchParams.get('featured') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const featured = parsed.data.featured === 'true';

    const supabase = await getSupabaseServerClient();

    let query = supabase
      .from("service_categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (featured) {
      query = query.eq("is_featured", true);
    }

    const { data, error } = await query;

    if (error) {
      const mapped = toFriendlyApiError(error, 'Failed to load service categories');
      return NextResponse.json(
        { success: false, error: mapped.message },
        { status: mapped.status }
      );
    }

    return NextResponse.json(
      { success: true, data: data as ServiceCategory[] },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } }
    );
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load service categories');
    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
    );
  }
}
