import UserDashboardClient from '@/components/dashboard/UserDashboardClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { claimPendingPetShares, listAccessiblePetsForUser } from '@/lib/pets/share-access';
import { getMyBookings } from '@/lib/bookings/service';

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

  const [accessiblePets, bookings] = await Promise.all([
    listAccessiblePetsForUser(admin, user.id),
    getMyBookings(supabase, user.id),
  ]);

  const bookingIds = bookings.map((booking) => booking.id);

  let pendingMap = new Map<number, { amountInr: number; status: string }>();
  if (bookingIds.length > 0) {
    const { data: collections } = await admin
      .from('booking_payment_collections')
      .select('booking_id, amount_inr, status')
      .in('booking_id', bookingIds)
      .returns<Array<{ booking_id: number; amount_inr: number | null; status: string }>>();

    pendingMap = new Map(
      (collections ?? []).map((row) => [
        row.booking_id,
        {
          amountInr: Math.max(0, Number(row.amount_inr ?? 0)),
          status: row.status,
        },
      ]),
    );
  }

  let capturedByBookingId = new Map<number, number>();
  if (bookingIds.length > 0) {
    const { data: capturedRows } = await admin
      .from('payment_transactions')
      .select('booking_id, amount_inr, status')
      .in('booking_id', bookingIds)
      .eq('status', 'captured')
      .returns<Array<{ booking_id: number | null; amount_inr: number | null; status: string | null }>>();

    capturedByBookingId = (capturedRows ?? []).reduce((map, row) => {
      if (!row.booking_id) {
        return map;
      }

      const existing = map.get(row.booking_id) ?? 0;
      map.set(row.booking_id, existing + Math.max(0, Number(row.amount_inr ?? 0)));
      return map;
    }, new Map<number, number>());
  }

  const resolvePendingForBooking = (booking: {
    id: number;
    payment_mode?: string | null;
    amount?: number | null;
    final_price?: number | null;
    price_at_booking?: number | null;
  }) => {
    const totalAmount = Math.max(
      0,
      Number(booking.amount ?? booking.final_price ?? booking.price_at_booking ?? 0),
    );
    const capturedOnline = capturedByBookingId.get(booking.id) ?? 0;
    const computedPending = Math.max(0, totalAmount - capturedOnline);

    const explicitPending = pendingMap.get(booking.id);
    if (explicitPending) {
      if (explicitPending.status === 'paid') {
        return 0;
      }

      if (explicitPending.amountInr > 0) {
        return Math.max(0, explicitPending.amountInr);
      }

      return computedPending;
    }

    const paymentMode = String(booking.payment_mode ?? '').trim().toLowerCase();
    const isCashCollectionMode =
      paymentMode === 'direct_to_provider' ||
      paymentMode === 'mixed' ||
      paymentMode === 'cash';

    if (!isCashCollectionMode) {
      return 0;
    }

    return computedPending;
  };

  const initialBookings = bookings.map((booking) => ({
    ...booking,
    pending_payable_inr: resolvePendingForBooking(booking),
  }));

  const userName = (user.user_metadata?.name as string) || user.email || 'User';
  const firstName = userName.split(' ')[0];

  return (
    <UserDashboardClient
      userId={user.id}
      userName={firstName}
      initialPets={accessiblePets}
      initialBookings={initialBookings}
      view={view}
      highlightedBookingId={highlightedBookingId}
    />
  );
}
