import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export type BookingDiscountPreview = {
  discountId: string;
  code: string;
  title: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  discountAmount: number;
  baseAmount: number;
  finalAmount: number;
  appliesToServiceType: string | null;
  validUntil: string | null;
};

export type BookingDiscountEvaluation = {
  preview: BookingDiscountPreview | null;
  reason?: string;
};

function normalizeServiceType(value: string) {
  return value.trim().toLowerCase();
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export async function evaluateDiscountForBooking(
  supabase: SupabaseClient,
  input: {
    discountCode: string;
    userId: string;
    serviceType: string;
    baseAmount: number;
  },
): Promise<BookingDiscountEvaluation> {
  const normalizedCode = input.discountCode.trim().toUpperCase();

  if (!normalizedCode) {
    return { preview: null, reason: 'Discount code is required.' };
  }

  if (!Number.isFinite(input.baseAmount) || input.baseAmount <= 0) {
    return { preview: null, reason: 'Booking amount is invalid for discount application.' };
  }

  const { data: discount, error } = await supabase
    .from('platform_discounts')
    .select(
      'id, code, title, discount_type, discount_value, max_discount_amount, min_booking_amount, applies_to_service_type, valid_from, valid_until, usage_limit_total, usage_limit_per_user, first_booking_only, is_active',
    )
    .eq('code', normalizedCode)
    .maybeSingle<{
      id: string;
      code: string;
      title: string;
      discount_type: 'percentage' | 'flat';
      discount_value: number;
      max_discount_amount: number | null;
      min_booking_amount: number | null;
      applies_to_service_type: string | null;
      valid_from: string;
      valid_until: string | null;
      usage_limit_total: number | null;
      usage_limit_per_user: number | null;
      first_booking_only: boolean;
      is_active: boolean;
    }>();

  if (error) {
    if (error.code === '42P01') {
      return { preview: null, reason: 'Discount system is not available yet.' };
    }
    throw error;
  }

  if (!discount) {
    return { preview: null, reason: 'Discount code is not valid or not applicable.' };
  }

  if (!discount.is_active) {
    return { preview: null, reason: 'Discount code is not valid or not applicable.' };
  }

  const now = Date.now();
  const validFrom = new Date(discount.valid_from).getTime();
  const validUntil = discount.valid_until ? new Date(discount.valid_until).getTime() : null;

  if (!Number.isFinite(validFrom) || validFrom > now) {
    return { preview: null, reason: 'Discount code is not valid or not applicable.' };
  }

  if (validUntil !== null && (!Number.isFinite(validUntil) || validUntil <= now)) {
    return { preview: null, reason: 'Discount code is not valid or not applicable.' };
  }

  if (discount.min_booking_amount !== null && input.baseAmount < discount.min_booking_amount) {
    return {
      preview: null,
      reason: `Minimum booking amount for this discount is ₹${discount.min_booking_amount}.`,
    };
  }

  if (
    discount.applies_to_service_type &&
    normalizeServiceType(discount.applies_to_service_type) !== normalizeServiceType(input.serviceType)
  ) {
    return { preview: null, reason: 'Discount is not applicable to the selected service.' };
  }

  if (discount.first_booking_only) {
    const { count: userBookingsCount, error: userBookingsError } = await supabase
      .from('bookings')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', input.userId)
      .in('booking_status', ['confirmed', 'completed']);

    if (userBookingsError) {
      throw userBookingsError;
    }

    if ((userBookingsCount ?? 0) > 0) {
      return { preview: null, reason: 'This discount is only valid for first-time bookings.' };
    }
  }

  const [{ count: totalActiveUsageCount, error: totalActiveUsageError }, { count: userActiveUsageCount, error: userActiveUsageError }] =
    await Promise.all([
      supabase
        .from('discount_redemptions')
        .select('id', { head: true, count: 'exact' })
        .eq('discount_id', discount.id)
        .is('reversed_at', null),
      supabase
        .from('discount_redemptions')
        .select('id', { head: true, count: 'exact' })
        .eq('discount_id', discount.id)
        .eq('user_id', input.userId)
        .is('reversed_at', null),
    ]);

  if (totalActiveUsageError || userActiveUsageError) {
    const code = totalActiveUsageError?.code ?? userActiveUsageError?.code;
    if (code === '42P01') {
      return { preview: null, reason: 'Discount redemptions are not available yet.' };
    }
    throw totalActiveUsageError ?? userActiveUsageError;
  }

  if (discount.usage_limit_total !== null && (totalActiveUsageCount ?? 0) >= discount.usage_limit_total) {
    return { preview: null, reason: 'Discount code is not valid or not applicable.' };
  }

  if (discount.usage_limit_per_user !== null && (userActiveUsageCount ?? 0) >= discount.usage_limit_per_user) {
    return { preview: null, reason: 'You have already used this discount code.' };
  }

  const rawDiscountAmount =
    discount.discount_type === 'percentage'
      ? (input.baseAmount * discount.discount_value) / 100
      : discount.discount_value;

  const cappedDiscountAmount =
    discount.max_discount_amount !== null
      ? Math.min(rawDiscountAmount, discount.max_discount_amount)
      : rawDiscountAmount;

  const discountAmount = Math.min(roundCurrency(cappedDiscountAmount), roundCurrency(input.baseAmount));

  if (discountAmount <= 0) {
    return { preview: null, reason: 'Discount is not applicable for this booking.' };
  }

  const baseAmount = roundCurrency(input.baseAmount);
  const finalAmount = roundCurrency(Math.max(baseAmount - discountAmount, 0));

  return {
    preview: {
      discountId: discount.id,
      code: discount.code,
      title: discount.title,
      discountType: discount.discount_type,
      discountValue: discount.discount_value,
      discountAmount,
      baseAmount,
      finalAmount,
      appliesToServiceType: discount.applies_to_service_type,
      validUntil: discount.valid_until,
    },
  };
}

export async function createDiscountRedemption(
  supabase: SupabaseClient,
  input: { discountId: string; bookingId: number; userId: string; discountAmount: number },
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('discount_redemptions')
    .upsert(
      {
        discount_id: input.discountId,
        booking_id: input.bookingId,
        user_id: input.userId,
        discount_amount: input.discountAmount,
      },
      { onConflict: 'booking_id' },
    )
    .select('id')
    .single<{ id: string }>();

  if (error) {
    if (error.code === '42P01') {
      return { id: '' }; // table not yet migrated — non-fatal degradation
    }
    throw error;
  }

  return { id: data?.id ?? '' };
}

export async function reverseDiscountRedemptionForBooking(
  bookingId: number,
  reason = 'booking_cancelled_or_refunded',
): Promise<{ reversed: boolean; redemptionId?: string }> {
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return { reversed: false };
  }

  const adminClient = getSupabaseAdminClient();

  const { data: redemption, error: redemptionError } = await adminClient
    .from('discount_redemptions')
    .select('id, reversed_at')
    .eq('booking_id', bookingId)
    .maybeSingle<{ id: string; reversed_at: string | null }>();

  if (redemptionError) {
    if (redemptionError.code === '42P01') {
      return { reversed: false };
    }
    throw redemptionError;
  }

  if (!redemption || redemption.reversed_at !== null) {
    return { reversed: false, redemptionId: redemption?.id };
  }

  const { error: updateError } = await adminClient
    .from('discount_redemptions')
    .update({
      reversed_at: new Date().toISOString(),
      reversal_reason: reason,
    })
    .eq('id', redemption.id)
    .is('reversed_at', null);

  if (updateError) {
    throw updateError;
  }

  return { reversed: true, redemptionId: redemption.id };
}
