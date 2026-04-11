import UserDashboardClient from '@/components/dashboard/UserDashboardClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { claimPendingPetShares, listAccessiblePetsForUser } from '@/lib/pets/share-access';

type UserDashboardView = 'home' | 'bookings' | 'pets' | 'account';

type UserDashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveBookingId(value: string | string[] | undefined) {
  const resolvedValue = Array.isArray(value) ? value[0] : value;
  if (!resolvedValue) {
    return null;
  }

  const parsed = Number.parseInt(resolvedValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function resolveUserDashboardView(value: string | string[] | undefined): UserDashboardView {
  const resolvedValue = Array.isArray(value) ? value[0] : value;

  switch (resolvedValue) {
    case 'home':
      return 'home';
    case 'bookings':
    case 'operations': // legacy alias
      return 'bookings';
    case 'pets':
    case 'profile': // legacy alias
      return 'pets';
    case 'account':
      return 'account';
    default:
      return 'home';
  }
}

export default async function UserDashboardPage({ searchParams }: UserDashboardPageProps) {
  const { supabase, user } = await requireAuthenticatedUser();
  const admin = getSupabaseAdminClient();
  await claimPendingPetShares(admin, user.id, user.email);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const view = resolveUserDashboardView(resolvedSearchParams?.view);
  const highlightedBookingId = resolveBookingId(resolvedSearchParams?.booking);

  const [accessiblePets, bookingsResult] = await Promise.all([
    listAccessiblePetsForUser(admin, user.id),
    supabase
      .from('bookings')
      .select(
        'id, booking_start, booking_end, booking_date, start_time, end_time, status, booking_status, booking_mode, amount, payment_mode, wallet_credits_applied_inr, service_type, provider_id, pet_id, providers(name)',
      )
      .eq('user_id', user.id)
      .order('booking_start', { ascending: false }),
  ]);

  const userName = (user.user_metadata?.name as string) || user.email || 'User';
  const firstName = userName.split(' ')[0];

  return (
    <UserDashboardClient
      userId={user.id}
      userName={firstName}
      initialPets={accessiblePets}
      initialBookings={bookingsResult.data ?? []}
      view={view}
      highlightedBookingId={highlightedBookingId}
    />
  );
}
