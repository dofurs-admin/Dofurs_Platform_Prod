import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { evaluateDiscountForBooking } from '@/lib/bookings/discounts';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 10,
};

const previewSchema = z.object({
  providerServiceId: z.string().uuid(),
  discountCode: z.string().trim().min(1).max(40),
  bookingUserId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const { supabase, user, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const rate = await isRateLimited(supabase, getRateLimitKey('bookings:discount-preview', user.id), RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = previewSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid discount preview payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const bookingUserId = parsed.data.bookingUserId ?? user.id;

  if (bookingUserId !== user.id && role !== 'admin' && role !== 'staff' && role !== 'provider') {
    return forbidden();
  }

  let service: { id: string; service_type: string; base_price: number; is_active: boolean } | null;

  try {
    const { data, error } = await supabase
      .from('provider_services')
      .select('id, service_type, base_price, is_active')
      .eq('id', parsed.data.providerServiceId)
      .eq('is_active', true)
      .maybeSingle<{ id: string; service_type: string; base_price: number; is_active: boolean }>();

    if (error) {
      const mapped = toFriendlyApiError(error, 'Failed to load service details');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    service = data;
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load service details');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  if (!service) {
    return NextResponse.json({ error: 'Selected service is unavailable for discount preview.' }, { status: 404 });
  }

  try {
    const evaluation = await evaluateDiscountForBooking(supabase, {
      discountCode: parsed.data.discountCode,
      userId: bookingUserId,
      serviceType: service.service_type,
      baseAmount: service.base_price,
    });

    if (!evaluation.preview) {
      return NextResponse.json({ error: evaluation.reason ?? 'Discount is not applicable.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      preview: evaluation.preview,
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to preview discount');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
