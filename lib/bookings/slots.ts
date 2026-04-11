import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getAvailableSlots as getAvailableSlotsFromService } from './service';

export async function getAvailableSlots(providerId: number, date: string, serviceDurationMinutes?: number) {
  const supabase = await getSupabaseServerClient();
  return getAvailableSlotsFromService(supabase, {
    providerId,
    bookingDate: date,
    serviceDurationMinutes,
  });
}
