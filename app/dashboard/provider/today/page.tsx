import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole, requireAuthenticatedUser } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import ProviderTodayScheduleClient from '@/components/dashboard/ProviderTodayScheduleClient';
import type { TodayBooking } from '@/components/dashboard/ProviderTodayScheduleClient';

function normalizeStoragePathCandidate(
  value: string | null | undefined,
  bucket: 'user-photos' | 'pet-photos',
) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const stripBucketPrefix = (input: string) =>
    input.replace(/^\/+/, '').replace(new RegExp(`^${bucket}/`), '');

  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/storage/v1/object/')) {
    return stripBucketPrefix(trimmed);
  }

  try {
    const parsed = new URL(trimmed, trimmed.startsWith('http') ? undefined : 'http://localhost');
    const segments = parsed.pathname.split('/').filter(Boolean);
    const markerIndex = segments.findIndex(
      (segment, index) =>
        segment === 'storage' && segments[index + 1] === 'v1' && segments[index + 2] === 'object',
    );

    if (markerIndex === -1) {
      return null;
    }

    const objectSegments = segments.slice(markerIndex + 3);
    const first = objectSegments[0];
    if (!first) {
      return null;
    }

    const modeOffsets: Record<string, number> = {
      sign: 1,
      public: 1,
      authenticated: 1,
      render: 2,
    };

    const offset = modeOffsets[first] ?? 0;
    const bucketCandidate = objectSegments[offset];
    const pathParts = objectSegments.slice(offset + 1);

    if (bucketCandidate !== bucket || pathParts.length === 0) {
      return null;
    }

    return decodeURIComponent(pathParts.join('/'));
  } catch {
    return stripBucketPrefix(trimmed);
  }
}

export default async function ProviderTodayPage() {
  await requireRole(['provider']);
  const { user } = await requireAuthenticatedUser();

  const supabase = getSupabaseAdminClient();

  const { data: providerRow } = await supabase
    .from('providers')
    .select('id, name')
    .eq('user_id', user.id)
    .single();

  if (!providerRow) {
    notFound();
  }

  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

  const bookingsResult = await supabase
    .from('bookings')
    .select(
      'id, booking_date, start_time, end_time, service_type, booking_mode, location_address, latitude, longitude, booking_status, price_at_booking, provider_notes, user_id, pets(name, breed, photo_url)',
    )
    .eq('provider_id', providerRow.id)
    .eq('booking_date', today)
    .order('start_time', { ascending: true });

  const rawBookings = bookingsResult.data ?? [];
  const userIds = Array.from(new Set(rawBookings.map((row) => row.user_id).filter(Boolean)));

  const [profilesResult, usersResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from('profiles').select('id, full_name, profile_photo_url').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? supabase.from('users').select('id, name, phone').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profileNameMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]));
  const profilePhotoMap = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile.profile_photo_url ?? null]),
  );
  const userMap = new Map((usersResult.data ?? []).map((u) => [u.id, u]));

  const petPhotoPathSet = new Set<string>();
  const ownerPhotoPathSet = new Set<string>();

  for (const row of rawBookings) {
    const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
    const petPhoto = (pet as { photo_url?: string | null } | null)?.photo_url ?? null;
    const petPath = normalizeStoragePathCandidate(petPhoto, 'pet-photos');
    if (petPath) {
      petPhotoPathSet.add(petPath);
    }

    const ownerPhoto = profilePhotoMap.get(row.user_id) ?? null;
    const ownerPath = normalizeStoragePathCandidate(ownerPhoto, 'user-photos');
    if (ownerPath) {
      ownerPhotoPathSet.add(ownerPath);
    }
  }

  const petSignedUrlByPath = new Map<string, string>();
  const ownerSignedUrlByPath = new Map<string, string>();

  await Promise.all(
    Array.from(petPhotoPathSet).map(async (path) => {
      const { data } = await supabase.storage.from('pet-photos').createSignedUrl(path, 3600);
      if (data?.signedUrl) {
        petSignedUrlByPath.set(path, data.signedUrl);
      }
    }),
  );

  await Promise.all(
    Array.from(ownerPhotoPathSet).map(async (path) => {
      const { data } = await supabase.storage.from('user-photos').createSignedUrl(path, 3600);
      if (data?.signedUrl) {
        ownerSignedUrlByPath.set(path, data.signedUrl);
      }
    }),
  );

  const bookings: TodayBooking[] = rawBookings.map((row) => {
    const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
    const owner = userMap.get(row.user_id);
    const ownerNameFromProfile = profileNameMap.get(row.user_id) ?? null;
    const ownerPhotoRaw = profilePhotoMap.get(row.user_id) ?? null;
    const ownerPhotoPath = normalizeStoragePathCandidate(ownerPhotoRaw, 'user-photos');
    const petPhotoRaw = (pet as { photo_url?: string | null } | null)?.photo_url ?? null;
    const petPhotoPath = normalizeStoragePathCandidate(petPhotoRaw, 'pet-photos');
    return {
      id: row.id,
      booking_date: row.booking_date,
      start_time: row.start_time,
      end_time: row.end_time,
      service_type: row.service_type ?? null,
      booking_mode: row.booking_mode,
      location_address: row.location_address ?? null,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      booking_status: row.booking_status as TodayBooking['booking_status'],
      price_at_booking: row.price_at_booking,
      provider_notes: row.provider_notes ?? null,
      pet_name: (pet as { name?: string } | null)?.name ?? 'Unknown Pet',
      pet_breed: (pet as { breed?: string | null } | null)?.breed ?? null,
      pet_photo_url: petPhotoPath ? petSignedUrlByPath.get(petPhotoPath) ?? petPhotoRaw : petPhotoRaw,
      owner_name: ownerNameFromProfile || owner?.name || null,
      owner_phone: owner?.phone ?? null,
      owner_photo_url: ownerPhotoPath ? ownerSignedUrlByPath.get(ownerPhotoPath) ?? ownerPhotoRaw : ownerPhotoRaw,
    };
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffcf8_0%,#fffaf6_60%,#fffcf9_100%)]">
      <div className="mx-auto w-full max-w-[680px] px-4 py-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard/provider"
              className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
            >
              ← Dashboard
            </Link>
            <h1 className="text-xl font-bold text-neutral-950">Today&apos;s Schedule</h1>
            <p className="text-xs text-neutral-500">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e7c4a7] bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-coral">{bookings.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Bookings</p>
          </div>
        </div>

        <ProviderTodayScheduleClient bookings={bookings} providerId={providerRow.id} date={today} />
      </div>
    </div>
  );
}
