import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { evaluateDiscountForBooking } from '@/lib/bookings/discounts';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 10,
};

const previewSchema = z.object({
  providerServiceId: z.string().uuid().optional(),
  bundleProviderServiceIds: z.array(z.string().uuid()).min(1).max(20).optional(),
  bundleEstimatedTotalInr: z.number().finite().positive().max(500_000).optional(),
  discountCode: z.string().trim().min(1).max(40),
  bookingUserId: z.string().uuid().optional(),
}).refine(
  (value) => Boolean(value.providerServiceId) || Boolean(value.bundleProviderServiceIds?.length),
  {
    message: 'Either providerServiceId or bundleProviderServiceIds is required',
    path: ['providerServiceId'],
  },
);

export async function POST(request: Request) {
  const { supabase, user, role } = await getApiAuthContext();
  const admin = getSupabaseAdminClient();

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

  const providerServiceIds = Array.from(
    new Set([
      ...(parsed.data.providerServiceId ? [parsed.data.providerServiceId] : []),
      ...(parsed.data.bundleProviderServiceIds ?? []),
    ]),
  );

  let services: Array<{ id: string; service_type: string; base_price: number; is_active: boolean }> = [];

  try {
    const { data, error } = await admin
      .from('provider_services')
      .select('id, service_type, base_price, is_active')
      .in('id', providerServiceIds)
      .eq('is_active', true)
      .returns<Array<{ id: string; service_type: string; base_price: number; is_active: boolean }>>();

    if (error) {
      const mapped = toFriendlyApiError(error, 'Failed to load service details');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    services = data ?? [];
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load service details');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  if (services.length === 0 || services.length !== providerServiceIds.length) {
    return NextResponse.json({ error: 'Selected service is unavailable for discount preview.' }, { status: 404 });
  }

  const serviceTypes = Array.from(new Set(services.map((service) => service.service_type)));
  const defaultBaseAmount = services.reduce((sum, service) => sum + Number(service.base_price ?? 0), 0);
  const baseAmount = Math.max(
    defaultBaseAmount,
    Number.isFinite(parsed.data.bundleEstimatedTotalInr)
      ? Number(parsed.data.bundleEstimatedTotalInr)
      : 0,
  );

  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return NextResponse.json({ error: 'Booking amount is invalid for discount preview.' }, { status: 400 });
  }

  try {
    const evaluation = await evaluateDiscountForBooking(admin, {
      discountCode: parsed.data.discountCode,
      userId: bookingUserId,
      serviceTypes,
      baseAmount,
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
