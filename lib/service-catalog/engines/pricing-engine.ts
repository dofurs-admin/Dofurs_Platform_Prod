import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { calculateBookingPriceWithSupabase } from '@/lib/bookings/engines/pricingEngine';
import type { PricingBreakdown } from '@/lib/bookings/types';

export type BookingPriceParameters = {
  bookingType?: 'service';
  serviceId?: string;
  providerId: string | number | bigint;
  quantity?: number;
  addOns?: Array<{ id: string; quantity: number }>;
};

export async function calculateBookingPrice(params: BookingPriceParameters): Promise<PricingBreakdown> {
  const supabase = getSupabaseAdminClient();

  return calculateBookingPriceWithSupabase(supabase, {
    bookingType: 'service',
    serviceId: params.serviceId,
    providerId: params.providerId,
    addOns: params.addOns,
  });
}
