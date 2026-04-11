/**
 * POST /api/services/calculate-price
 * Calculate booking price for service bookings and add-ons
 *
 * Body:
 * {
 *   serviceId: string
 *   providerId: string
 *   addOns?: Array<{ id: string, quantity: number }>
 * }
 *
 * Response:
 * - success: boolean
 * - data: {
 *     base_total: number
 *     addon_total: number
 *     discount_amount: number
 *     final_total: number
 *     breakdown: string[]
 *   }
 * - error: string (on failure)
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateBookingPrice } from '@/lib/service-catalog';
import { calculatePriceSchema } from '@/lib/service-catalog/validation';
import { toFriendlyApiError } from '@/lib/api/errors';
import { isRateLimited } from '@/lib/api/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit by IP — public endpoint, no auth required
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rate = isRateLimited(`calc-price:${clientIp}`, { windowMs: 60_000, maxRequests: 30 });
  if (rate.limited) {
    return NextResponse.json({ success: false, error: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = calculatePriceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const pricing = await calculateBookingPrice({
      serviceId: parsed.data.serviceId,
      providerId: parsed.data.providerId,
      addOns: parsed.data.addOns,
    });

    return NextResponse.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to calculate price');
    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
    );
  }
}
