import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole, requireAuthenticatedUser } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTDateString } from '@/lib/utils/date';
import ProviderTodayScheduleClient from '@/components/dashboard/ProviderTodayScheduleClient';
import type { TodayBooking } from '@/components/dashboard/ProviderTodayScheduleClient';
import {
  extractBundledPetIdsFromNotes,
  extractProviderServiceIdsFromNotes,
  resolveIncludedServicesForBooking,
} from '@/lib/bookings/included-services';

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

  const today = getISTDateString();

  const bookingsResult = await supabase
    .from('bookings')
    .select(
      'id, user_id, pet_id, booking_date, start_time, end_time, service_type, provider_service_id, booking_mode, location_address, latitude, longitude, booking_status, price_at_booking, final_price, amount, admin_price_reference, provider_notes, internal_notes, pets(name, breed, photo_url)',
    )
    .eq('provider_id', providerRow.id)
    .eq('booking_date', today)
    .order('start_time', { ascending: true });

  const rawBookings = bookingsResult.data ?? [];
  const userIds = Array.from(new Set(rawBookings.map((row) => row.user_id).filter(Boolean)));
  const petIdsByBookingId = new Map<number, number[]>();
  const petIds = new Set<number>();
  const providerServiceIds = new Set<string>();

  for (const row of rawBookings) {
    const bookingPetIds = new Set<number>();

    if (row.pet_id) {
      bookingPetIds.add(row.pet_id);
      petIds.add(row.pet_id);
    }

    for (const bundledPetId of [
      ...extractBundledPetIdsFromNotes(row.provider_notes),
      ...extractBundledPetIdsFromNotes(row.internal_notes),
    ]) {
      bookingPetIds.add(bundledPetId);
      petIds.add(bundledPetId);
    }

    if (row.provider_service_id) {
      providerServiceIds.add(row.provider_service_id);
    }

    for (const providerServiceId of [
      ...extractProviderServiceIdsFromNotes(row.provider_notes),
      ...extractProviderServiceIdsFromNotes(row.internal_notes),
    ]) {
      providerServiceIds.add(providerServiceId);
    }

    petIdsByBookingId.set(row.id, Array.from(bookingPetIds));
  }

  const [profilesResult, usersResult, petsResult, providerServicesResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from('profiles').select('id, full_name, profile_photo_url').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? supabase.from('users').select('id, name, phone').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    petIds.size > 0
      ? supabase.from('pets').select('id, name, breed, photo_url').in('id', Array.from(petIds))
      : Promise.resolve({ data: [], error: null }),
    providerServiceIds.size > 0
      ? supabase.from('provider_services').select('id, service_type, base_price').in('id', Array.from(providerServiceIds))
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profileNameMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]));
  const profilePhotoMap = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile.profile_photo_url ?? null]),
  );
  const userMap = new Map((usersResult.data ?? []).map((u) => [u.id, u]));
  const petMap = new Map((petsResult.data ?? []).map((pet) => [pet.id, pet]));
  const serviceNameByProviderServiceId = new Map(
    (providerServicesResult.data ?? []).map((service) => [service.id, service.service_type]),
  );
  const serviceBasePriceByProviderServiceId = new Map(
    (providerServicesResult.data ?? [])
      .map((service) => [service.id, Number(service.base_price ?? NaN)] as const)
      .filter((entry): entry is readonly [string, number] => Number.isFinite(entry[1]) && entry[1] > 0),
  );

  const petPhotoPathSet = new Set<string>();
  const ownerPhotoPathSet = new Set<string>();

  for (const row of rawBookings) {
    const bookingPetIds = petIdsByBookingId.get(row.id) ?? [];
    for (const bookingPetId of bookingPetIds) {
      const pet = petMap.get(bookingPetId);
      const petPhoto = pet?.photo_url ?? null;
      const petPath = normalizeStoragePathCandidate(petPhoto, 'pet-photos');
      if (petPath) {
        petPhotoPathSet.add(petPath);
      }
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
    const relationPet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
    const bookingPetIds = petIdsByBookingId.get(row.id) ?? [];
    const bookingPets = bookingPetIds
      .map((petId) => petMap.get(petId))
      .filter((pet): pet is { id: number; name: string; breed: string | null; photo_url: string | null } => Boolean(pet));
    const petNames = Array.from(new Set(bookingPets.map((pet) => pet.name).filter(Boolean)));
    const primaryPet = bookingPets[0] ?? relationPet;
    const owner = userMap.get(row.user_id);
    const ownerNameFromProfile = profileNameMap.get(row.user_id) ?? null;
    const ownerPhotoRaw = profilePhotoMap.get(row.user_id) ?? null;
    const ownerPhotoPath = normalizeStoragePathCandidate(ownerPhotoRaw, 'user-photos');
    const petPhotoRaw = (primaryPet as { photo_url?: string | null } | null)?.photo_url ?? null;
    const petPhotoPath = normalizeStoragePathCandidate(petPhotoRaw, 'pet-photos');
    const includedServices = resolveIncludedServicesForBooking(row, {
      serviceNameByProviderServiceId,
      serviceBasePriceByProviderServiceId,
    });
    const effectiveAmount = [row.final_price, row.amount, row.admin_price_reference, row.price_at_booking]
      .map((value) => Number(value ?? NaN))
      .find((value) => Number.isFinite(value) && value > 0) ?? 0;

    return {
      id: row.id,
      booking_date: row.booking_date,
      start_time: row.start_time,
      end_time: row.end_time,
      service_type: row.service_type ?? null,
      provider_service_id: row.provider_service_id ?? null,
      included_services: includedServices.length > 0 ? includedServices : null,
      booking_mode: row.booking_mode,
      location_address: row.location_address ?? null,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      booking_status: row.booking_status as TodayBooking['booking_status'],
      price_at_booking: effectiveAmount,
      admin_price_reference: row.admin_price_reference ?? null,
      provider_notes: row.provider_notes ?? null,
      internal_notes: row.internal_notes ?? null,
      pet_name: petNames.length > 0 ? petNames.join(', ') : (primaryPet as { name?: string } | null)?.name ?? 'Unknown Pet',
      pet_breed: petNames.length <= 1 ? (primaryPet as { breed?: string | null } | null)?.breed ?? null : null,
      pet_count: Math.max(bookingPetIds.length, petNames.length, 1),
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
              {new Date().toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
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
