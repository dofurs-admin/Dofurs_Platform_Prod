import type { SupabaseClient } from '@supabase/supabase-js';
import { getISTTimestamp } from '@/lib/utils/date';
import type {
  AdminProviderLocationModeration,
  AdminServiceGlobalRolloutInput,
  AdminServiceGlobalToggleInput,
  AdminServiceModerationSummaryItem,
  AdminUpsertDiscountInput,
  AdminProviderModerationItem,
  CreateProviderDocumentInput,
  CreateProviderInput,
  DocumentVerificationStatus,
  PlatformDiscount,
  PlatformDiscountAnalyticsSummary,
  ProviderDetailsUpdateInput,
  Provider,
  AdminProviderServiceRolloutInput,
  ProviderDashboard,
  ProviderReviewsPage,
  ProviderReviewsQuery,
  ProviderReview,
  SetAvailabilityInput,
  UpdateProviderDocumentInput,
  UpdateProviderProfessionalDetailsInput,
  UpdateAdminProviderLocationInput,
  UpdateAdminProviderProfileInput,
  UpdateProviderClinicDetailsInput,
  UpdateProviderPricingInput,
  UpdateProviderProfileInput,
} from './types';

function ensureProviderFound<T>(value: T | null, message = 'Provider not found'): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

async function getProviderByUserId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('providers')
    .select('id, user_id, provider_type, is_individual, business_name, profile_photo_url, bio, years_of_experience, phone_number, email, service_radius_km, is_verified, verification_status, background_verified, admin_approval_status, account_status, average_rating, total_bookings, performance_score, cancellation_rate, no_show_count, ranking_score, accepts_platform_payment, payout_method_type, payout_details, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<Provider>();

  if (error) {
    throw error;
  }

  return data;
}

export async function createProvider(supabase: SupabaseClient, userId: string, input: CreateProviderInput) {
  const { professional_details, clinic_details, ...providerInput } = input;

  const providerDisplayName =
    providerInput.business_name?.trim() || providerInput.email?.trim() || providerInput.phone_number?.trim() || 'Provider';
  const legacyProviderType =
    providerInput.provider_type === 'clinic'
      ? 'clinic'
      : providerInput.provider_type === 'groomer'
      ? 'grooming'
      : 'home';
  const legacyAddress = providerInput.address?.trim() || clinic_details?.address?.trim() || 'Address pending';

  const { data: provider, error: providerError } = await supabase
    .from('providers')
    .insert({
      user_id: userId,
      name: providerDisplayName,
      type: legacyProviderType,
      address: legacyAddress,
      start_time: '09:00',
      end_time: '18:00',
      ...providerInput,
    })
    .select('id, user_id, provider_type, is_individual, business_name, profile_photo_url, bio, years_of_experience, phone_number, email, service_radius_km, is_verified, verification_status, background_verified, admin_approval_status, account_status, average_rating, total_bookings, performance_score, cancellation_rate, no_show_count, ranking_score, accepts_platform_payment, payout_method_type, payout_details, created_at, updated_at')
    .single<Provider>();

  if (providerError) {
    throw providerError;
  }

  if (professional_details) {
    const { error } = await supabase.from('provider_professional_details').upsert(
      {
        provider_id: provider.id,
        ...professional_details,
      },
      { onConflict: 'provider_id' },
    );

    if (error) {
      throw error;
    }
  }

  if (clinic_details) {
    const { error } = await supabase.from('provider_clinic_details').upsert(
      {
        provider_id: provider.id,
        ...clinic_details,
      },
      { onConflict: 'provider_id' },
    );

    if (error) {
      throw error;
    }
  }

  return provider;
}

export async function getProviderDashboard(supabase: SupabaseClient, userId: string): Promise<ProviderDashboard | null> {
  const provider = await getProviderByUserId(supabase, userId);

  if (!provider) {
    return null;
  }

  const [professionalDetails, clinicDetails, availability, documents, reviews, services] = await Promise.all([
    supabase
      .from('provider_professional_details')
      .select('id, provider_id, license_number, specialization, teleconsult_enabled, emergency_service_enabled, equipment_details, insurance_document_url, license_verified, created_at')
      .eq('provider_id', provider.id)
      .maybeSingle(),
    supabase
      .from('provider_clinic_details')
      .select('id, provider_id, registration_number, gst_number, address, city, state, pincode, latitude, longitude, operating_hours, number_of_doctors, hospitalization_available, emergency_services_available, registration_verified, created_at')
      .eq('provider_id', provider.id)
      .maybeSingle(),
    supabase
      .from('provider_availability')
      .select('id, provider_id, day_of_week, start_time, end_time, is_available, slot_duration_minutes, buffer_time_minutes, set_by, admin_locked, created_at')
      .eq('provider_id', provider.id)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true }),
    supabase
      .from('provider_documents')
      .select('id, provider_id, document_type, document_url, verification_status, verified_at, created_at')
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('provider_reviews')
      .select('id, provider_id, booking_id, user_id, rating, review_text, provider_response, created_at')
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('provider_services')
      .select('id, provider_id, service_type, base_price, surge_price, commission_percentage, service_duration_minutes, is_active, created_at')
      .eq('provider_id', provider.id)
      .order('service_type', { ascending: true }),
  ]);

  if (professionalDetails.error) {
    throw professionalDetails.error;
  }

  if (clinicDetails.error) {
    throw clinicDetails.error;
  }

  if (availability.error) {
    throw availability.error;
  }

  if (documents.error) {
    throw documents.error;
  }

  if (reviews.error) {
    throw reviews.error;
  }

  if (services.error) {
    throw services.error;
  }

  return {
    provider,
    professionalDetails: professionalDetails.data,
    clinicDetails: clinicDetails.data,
    availability: availability.data ?? [],
    documents: documents.data ?? [],
    reviews: reviews.data ?? [],
    services: services.data ?? [],
  };
}

export async function updateProviderProfile(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateProviderProfileInput,
) {
  const provider = ensureProviderFound(await getProviderByUserId(supabase, userId));

  const { data, error } = await supabase
    .from('providers')
    .update(input)
    .eq('id', provider.id)
    .select('id, user_id, provider_type, is_individual, business_name, profile_photo_url, bio, years_of_experience, phone_number, email, service_radius_km, is_verified, verification_status, background_verified, admin_approval_status, account_status, average_rating, total_bookings, performance_score, cancellation_rate, no_show_count, ranking_score, accepts_platform_payment, payout_method_type, payout_details, created_at, updated_at')
    .single<Provider>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProviderProfessionalDetails(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateProviderProfessionalDetailsInput,
) {
  const provider = ensureProviderFound(await getProviderByUserId(supabase, userId));

  const { data, error } = await supabase
    .from('provider_professional_details')
    .upsert(
      {
        provider_id: provider.id,
        ...input,
      },
      { onConflict: 'provider_id' },
    )
    .select('id, provider_id, license_number, specialization, teleconsult_enabled, emergency_service_enabled, equipment_details, insurance_document_url, license_verified, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProviderClinicDetails(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateProviderClinicDetailsInput,
) {
  const provider = ensureProviderFound(await getProviderByUserId(supabase, userId));

  const { data, error } = await supabase
    .from('provider_clinic_details')
    .upsert(
      {
        provider_id: provider.id,
        ...input,
      },
      { onConflict: 'provider_id' },
    )
    .select('id, provider_id, registration_number, gst_number, address, city, state, pincode, latitude, longitude, operating_hours, number_of_doctors, hospitalization_available, emergency_services_available, registration_verified, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProviderDetails(
  supabase: SupabaseClient,
  userId: string,
  input: ProviderDetailsUpdateInput,
) {
  const updates: {
    professionalDetails?: Awaited<ReturnType<typeof updateProviderProfessionalDetails>>;
    clinicDetails?: Awaited<ReturnType<typeof updateProviderClinicDetails>>;
  } = {};

  if (input.professionalDetails && Object.keys(input.professionalDetails).length > 0) {
    updates.professionalDetails = await updateProviderProfessionalDetails(supabase, userId, input.professionalDetails);
  }

  if (input.clinicDetails && Object.keys(input.clinicDetails).length > 0) {
    updates.clinicDetails = await updateProviderClinicDetails(supabase, userId, input.clinicDetails);
  }

  return updates;
}

export async function getProviderPublicProfile(supabase: SupabaseClient, providerId: number) {
  const { data: provider, error: providerError } = await supabase
    .from('providers')
    .select(
      `
      id,
      provider_type,
      is_individual,
      business_name,
      profile_photo_url,
      bio,
      years_of_experience,
      service_radius_km,
      average_rating,
      total_bookings,
      ranking_score,
      verification_status,
      admin_approval_status,
      account_status
    `,
    )
    .eq('id', providerId)
    .eq('admin_approval_status', 'approved')
    .eq('account_status', 'active')
    .single();

  if (providerError) {
    throw providerError;
  }

  const [services, reviews] = await Promise.all([
    supabase
      .from('provider_services')
      .select('service_type, base_price, surge_price, service_duration_minutes, is_active')
      .eq('provider_id', providerId)
      .eq('is_active', true)
      .order('service_type', { ascending: true }),
    supabase
      .from('provider_reviews')
      .select('rating, review_text, provider_response, created_at')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (services.error) {
    throw services.error;
  }

  if (reviews.error) {
    throw reviews.error;
  }

  return {
    provider,
    services: services.data ?? [],
    reviews: reviews.data ?? [],
  };
}

export async function approveProvider(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('providers')
    .update({
      is_verified: true,
      verification_status: 'approved',
      admin_approval_status: 'approved',
      account_status: 'active',
      background_verified: true,
    })
    .eq('id', providerId)
    .select('id, user_id, provider_type, is_individual, business_name, profile_photo_url, bio, years_of_experience, phone_number, email, service_radius_km, is_verified, verification_status, background_verified, admin_approval_status, account_status, average_rating, total_bookings, performance_score, cancellation_rate, no_show_count, ranking_score, accepts_platform_payment, payout_method_type, payout_details, created_at, updated_at')
    .single<Provider>();

  if (error) {
    throw error;
  }

  return data;
}

export async function rejectProvider(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('providers')
    .update({
      is_verified: false,
      verification_status: 'rejected',
      admin_approval_status: 'rejected',
      account_status: 'suspended',
    })
    .eq('id', providerId)
    .select('id, user_id, provider_type, is_individual, business_name, profile_photo_url, bio, years_of_experience, phone_number, email, service_radius_km, is_verified, verification_status, background_verified, admin_approval_status, account_status, average_rating, total_bookings, performance_score, cancellation_rate, no_show_count, ranking_score, accepts_platform_payment, payout_method_type, payout_details, created_at, updated_at')
    .single<Provider>();

  if (error) {
    throw error;
  }

  return data;
}

export async function suspendProvider(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('providers')
    .update({ account_status: 'suspended' })
    .eq('id', providerId)
    .select('id, user_id, provider_type, is_individual, business_name, profile_photo_url, bio, years_of_experience, phone_number, email, service_radius_km, is_verified, verification_status, background_verified, admin_approval_status, account_status, average_rating, total_bookings, performance_score, cancellation_rate, no_show_count, ranking_score, accepts_platform_payment, payout_method_type, payout_details, created_at, updated_at')
    .single<Provider>();

  if (error) {
    throw error;
  }

  // Cancel all pending/confirmed bookings for the suspended provider
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('provider_id', providerId)
    .in('booking_status', ['pending', 'confirmed', 'in_progress']);

  if (activeBookings && activeBookings.length > 0) {
    const activeBookingIds = activeBookings.map((b) => b.id);
    await supabase
      .from('bookings')
      .update({
        booking_status: 'cancelled',
        cancellation_reason: 'Provider account suspended',
      })
      .in('id', activeBookingIds);
  }

  return data;
}

export async function enableProvider(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('providers')
    .update({ account_status: 'active' })
    .eq('id', providerId)
    .select('id, user_id, provider_type, is_individual, business_name, profile_photo_url, bio, years_of_experience, phone_number, email, service_radius_km, is_verified, verification_status, background_verified, admin_approval_status, account_status, average_rating, total_bookings, performance_score, cancellation_rate, no_show_count, ranking_score, accepts_platform_payment, payout_method_type, payout_details, created_at, updated_at')
    .single<Provider>();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteProvider(supabase: SupabaseClient, providerId: number) {
  const { data: providerServices, error: providerServicesError } = await supabase
    .from('provider_services')
    .select('id')
    .eq('provider_id', providerId);

  if (providerServicesError) {
    throw providerServicesError;
  }

  const providerServiceIds = (providerServices ?? []).map((service) => service.id);

  if (providerServiceIds.length > 0) {
    const { error: pincodeDeleteError } = await supabase
      .from('provider_service_pincodes')
      .delete()
      .in('provider_service_id', providerServiceIds);

    if (pincodeDeleteError && pincodeDeleteError.code !== '42P01') {
      throw pincodeDeleteError;
    }
  }

  const { data: providerBookings, error: providerBookingsError } = await supabase
    .from('bookings')
    .select('id')
    .eq('provider_id', providerId);

  if (providerBookingsError && providerBookingsError.code !== '42P01') {
    throw providerBookingsError;
  }

  const bookingIds = (providerBookings ?? []).map((booking) => booking.id);

  if (bookingIds.length > 0) {
    // Soft-delete: cancel bookings instead of hard-deleting them
    const { error: bookingsCancelError } = await supabase
      .from('bookings')
      .update({
        booking_status: 'cancelled',
        cancellation_reason: 'Provider account deleted',
      })
      .eq('provider_id', providerId)
      .in('booking_status', ['pending', 'confirmed', 'in_progress']);

    if (bookingsCancelError && bookingsCancelError.code !== '42P01') {
      throw bookingsCancelError;
    }
  }

  const dependentProviderTables = [
    'provider_booking_completion_tasks',
    'provider_blocks',
    'provider_blocked_dates',
    'provider_admin_audit_events',
    'provider_review_response_history',
    'provider_reviews',
    'provider_documents',
    'provider_availability',
    'provider_professional_details',
    'provider_clinic_details',
  ];

  for (const tableName of dependentProviderTables) {
    const { error } = await supabase.from(tableName).delete().eq('provider_id', providerId);

    if (error && error.code !== '42P01') {
      throw error;
    }
  }

  const { data, error } = await supabase
    .from('providers')
    .delete()
    .eq('id', providerId)
    .select('id, user_id, provider_type, is_individual, business_name, profile_photo_url, bio, years_of_experience, phone_number, email, service_radius_km, is_verified, verification_status, background_verified, admin_approval_status, account_status, average_rating, total_bookings, performance_score, cancellation_rate, no_show_count, ranking_score, accepts_platform_payment, payout_method_type, payout_details, created_at, updated_at')
    .maybeSingle<Provider>();

  if (error?.code === '23503' && (error.details?.includes('bookings_provider_id_fkey') || error.details?.includes('bookings'))) {
    // Keep historical bookings intact when provider rows are still referenced.
    const { data: softDeletedProvider, error: softDeleteError } = await supabase
      .from('providers')
      .update({
        account_status: 'banned',
        admin_approval_status: 'rejected',
        verification_status: 'rejected',
        is_verified: false,
        accepts_platform_payment: false,
      })
      .eq('id', providerId)
      .select('id, user_id, provider_type, is_individual, business_name, profile_photo_url, bio, years_of_experience, phone_number, email, service_radius_km, is_verified, verification_status, background_verified, admin_approval_status, account_status, average_rating, total_bookings, performance_score, cancellation_rate, no_show_count, ranking_score, accepts_platform_payment, payout_method_type, payout_details, created_at, updated_at')
      .maybeSingle<Provider>();

    if (softDeleteError) {
      throw softDeleteError;
    }

    if (!softDeletedProvider) {
      throw new Error('Provider not found or already deleted');
    }

    return softDeletedProvider;
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Provider not found or already deleted');
  }

  return data;
}

export async function updateProviderPricing(
  supabase: SupabaseClient,
  providerId: number,
  pricingRows: UpdateProviderPricingInput,
) {
  const { error } = await supabase
    .from('provider_services')
    .upsert(
      pricingRows.map((row) => ({
        ...row,
        provider_id: providerId,
      })),
      { onConflict: 'id' },
    );

  if (error) {
    throw error;
  }

  const { data, error: selectError } = await supabase
    .from('provider_services')
    .select('id, provider_id, service_type, base_price, surge_price, commission_percentage, service_duration_minutes, is_active, created_at')
    .eq('provider_id', providerId)
    .order('service_type', { ascending: true });

  if (selectError) {
    throw selectError;
  }

  return data ?? [];
}

function sanitizePincodeValues(values: string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  return Array.from(new Set(values.map((item) => item.trim()).filter((item) => /^[1-9]\d{5}$/.test(item))));
}

export async function getProviderServicesWithPincodes(supabase: SupabaseClient, providerId: number) {
  const servicesResult = await supabase
    .from('provider_services')
    .select('id, provider_id, service_type, base_price, surge_price, commission_percentage, service_duration_minutes, is_active, created_at')
    .eq('provider_id', providerId)
    .order('service_type', { ascending: true });

  if (servicesResult.error) {
    throw servicesResult.error;
  }

  const serviceRows = servicesResult.data ?? [];
  const serviceIds = serviceRows.map((item) => item.id);

  if (serviceIds.length === 0) {
    return [];
  }

  const pincodesResult = await supabase
    .from('provider_service_pincodes')
    .select('provider_service_id, pincode, is_enabled')
    .in('provider_service_id', serviceIds)
    .limit(10000);

  if (pincodesResult.error && pincodesResult.error.code !== '42P01') {
    throw pincodesResult.error;
  }

  const pincodeMap = new Map<string, string[]>();

  for (const row of pincodesResult.data ?? []) {
    if (row.is_enabled === false) {
      continue;
    }

    const list = pincodeMap.get(row.provider_service_id) ?? [];
    list.push(row.pincode);
    pincodeMap.set(row.provider_service_id, list);
  }

  return serviceRows.map((service) => ({
    ...service,
    service_pincodes: Array.from(new Set(pincodeMap.get(service.id) ?? [])),
  }));
}

export async function deleteProviderServiceRolloutEntry(
  supabase: SupabaseClient,
  providerId: number,
  providerServiceId: string,
) {
  const { data: serviceRow, error: serviceLookupError } = await supabase
    .from('provider_services')
    .select('id')
    .eq('id', providerServiceId)
    .eq('provider_id', providerId)
    .maybeSingle();

  if (serviceLookupError) {
    throw serviceLookupError;
  }

  if (!serviceRow) {
    throw new Error('Service rollout not found for this provider.');
  }

  const { error: deletePincodeError } = await supabase
    .from('provider_service_pincodes')
    .delete()
    .eq('provider_service_id', providerServiceId);

  if (deletePincodeError && deletePincodeError.code !== '42P01') {
    throw deletePincodeError;
  }

  const { error: deleteServiceError } = await supabase
    .from('provider_services')
    .delete()
    .eq('id', providerServiceId)
    .eq('provider_id', providerId);

  if (deleteServiceError) {
    throw deleteServiceError;
  }

  return getProviderServicesWithPincodes(supabase, providerId);
}

export async function updateProviderServiceRollout(
  supabase: SupabaseClient,
  providerId: number,
  rolloutRows: AdminProviderServiceRolloutInput,
) {
  const normalizedServiceTypes = Array.from(
    new Set(rolloutRows.map((row) => row.service_type.trim()).filter((value) => value.length > 0)),
  );

  const { data: existingProviderServices, error: existingServicesError } = await supabase
    .from('provider_services')
    .select('id, service_type, base_price, surge_price, commission_percentage, service_duration_minutes')
    .eq('provider_id', providerId)
    .in('service_type', normalizedServiceTypes);

  if (existingServicesError) {
    throw existingServicesError;
  }

  const { data: templateServices, error: templateServicesError } = await supabase
    .from('provider_services')
    .select('service_type, base_price, surge_price, commission_percentage, service_duration_minutes')
    .is('provider_id', null)
    .in('service_type', normalizedServiceTypes);

  if (templateServicesError) {
    throw templateServicesError;
  }

  const existingById = new Map<string, (typeof existingProviderServices)[number]>();
  const existingByType = new Map<string, (typeof existingProviderServices)[number]>();

  for (const service of existingProviderServices ?? []) {
    existingById.set(service.id, service);
    existingByType.set(service.service_type.trim().toLowerCase(), service);
  }

  const templateByType = new Map<string, (typeof templateServices)[number]>();

  for (const template of templateServices ?? []) {
    templateByType.set(template.service_type.trim().toLowerCase(), template);
  }

  const existingRows: Array<{
    id: string;
    provider_id: number;
    service_type: string;
    base_price: number;
    surge_price: number | null;
    commission_percentage: number | null;
    service_duration_minutes: number | null;
    is_active: boolean;
  }> = [];
  const newRows: Array<{
    provider_id: number;
    service_type: string;
    base_price: number;
    surge_price: number | null;
    commission_percentage: number | null;
    service_duration_minutes: number | null;
    is_active: boolean;
  }> = [];

  for (const row of rolloutRows) {
    const normalizedType = row.service_type.trim().toLowerCase();
    const existingService = row.id ? existingById.get(row.id) : existingByType.get(normalizedType);
    const templateService = templateByType.get(normalizedType);

    const resolvedBasePrice = row.base_price ?? existingService?.base_price ?? templateService?.base_price ?? 0;
    const resolvedSurgePrice =
      row.surge_price ?? existingService?.surge_price ?? templateService?.surge_price ?? null;
    const resolvedCommission =
      row.commission_percentage ?? existingService?.commission_percentage ?? templateService?.commission_percentage ?? null;
    const resolvedDuration =
      row.service_duration_minutes ??
      existingService?.service_duration_minutes ??
      templateService?.service_duration_minutes ??
      null;

    const payload = {
      provider_id: providerId,
      service_type: row.service_type,
      base_price: resolvedBasePrice,
      surge_price: resolvedSurgePrice,
      commission_percentage: resolvedCommission,
      service_duration_minutes: resolvedDuration,
      is_active: row.is_active ?? true,
    };

    const resolvedId = existingService?.id ?? row.id;

    if (resolvedId) {
      existingRows.push({
        id: resolvedId,
        ...payload,
      });
    } else {
      newRows.push(payload);
    }
  }

  if (existingRows.length > 0) {
    const { error: upsertError } = await supabase.from('provider_services').upsert(existingRows, { onConflict: 'id' });

    if (upsertError) {
      throw upsertError;
    }
  }

  if (newRows.length > 0) {
    const { error: insertError } = await supabase.from('provider_services').insert(newRows);

    if (insertError) {
      throw insertError;
    }
  }

  const { data: services, error: servicesError } = await supabase
    .from('provider_services')
    .select('id, provider_id, service_type, base_price, surge_price, commission_percentage, service_duration_minutes, is_active, created_at')
    .eq('provider_id', providerId)
    .order('service_type', { ascending: true });

  if (servicesError) {
    throw servicesError;
  }

  const serviceByType = new Map<string, (typeof services)[number]>();

  for (const service of services ?? []) {
    serviceByType.set(service.service_type.trim().toLowerCase(), service);
  }

  const coverageRows: { provider_service_id: string; pincode: string; is_enabled: boolean }[] = [];
  const touchedServiceIds = new Set<string>();

  for (const row of rolloutRows) {
    const service = row.id
      ? (services ?? []).find((item) => item.id === row.id)
      : serviceByType.get(row.service_type.trim().toLowerCase());

    if (!service) {
      continue;
    }

    touchedServiceIds.add(service.id);

    for (const pincode of sanitizePincodeValues(row.service_pincodes)) {
      coverageRows.push({
        provider_service_id: service.id,
        pincode,
        is_enabled: true,
      });
    }
  }

  if (touchedServiceIds.size > 0) {
    const { error: deleteCoverageError } = await supabase
      .from('provider_service_pincodes')
      .delete()
      .in('provider_service_id', Array.from(touchedServiceIds));

    if (deleteCoverageError && deleteCoverageError.code !== '42P01') {
      throw deleteCoverageError;
    }

    if (coverageRows.length > 0) {
      const { error: insertCoverageError } = await supabase.from('provider_service_pincodes').upsert(coverageRows, {
        onConflict: 'provider_service_id,pincode',
      });

      if (insertCoverageError && insertCoverageError.code !== '42P01') {
        throw insertCoverageError;
      }
    }
  }

  return getProviderServicesWithPincodes(supabase, providerId);
}

export async function getAdminServiceModerationSummary(
  supabase: SupabaseClient,
): Promise<AdminServiceModerationSummaryItem[]> {
  const { data, error } = await supabase
    .from('provider_services')
    .select('service_type, provider_id, is_active, base_price')
    .order('service_type', { ascending: true })
    .limit(10000);

  if (error) {
    throw error;
  }

  const summaryByType = new Map<
    string,
    {
      service_type: string;
      providers: Set<number>;
      active_count: number;
      inactive_count: number;
      base_price_sum: number;
      base_price_count: number;
    }
  >();

  for (const row of data ?? []) {
    const key = row.service_type.trim().toLowerCase();
    const current =
      summaryByType.get(key) ??
      {
        service_type: row.service_type,
        providers: new Set<number>(),
        active_count: 0,
        inactive_count: 0,
        base_price_sum: 0,
        base_price_count: 0,
      };

    if (typeof row.provider_id === 'number') {
      current.providers.add(row.provider_id);
    }

    if (row.is_active) {
      current.active_count += 1;
    } else {
      current.inactive_count += 1;
    }

    if (typeof row.base_price === 'number') {
      current.base_price_sum += row.base_price;
      current.base_price_count += 1;
    }

    summaryByType.set(key, current);
  }

  return Array.from(summaryByType.values())
    .map((item) => ({
      service_type: item.service_type,
      provider_count: item.providers.size,
      active_count: item.active_count,
      inactive_count: item.inactive_count,
      average_base_price:
        item.base_price_count > 0 ? Number((item.base_price_sum / item.base_price_count).toFixed(2)) : 0,
    }))
    .sort((a, b) => a.service_type.localeCompare(b.service_type));
}

export async function setAdminServiceActivation(
  supabase: SupabaseClient,
  input: AdminServiceGlobalToggleInput,
): Promise<AdminServiceModerationSummaryItem[]> {
  const serviceType = input.service_type.trim();

  const { error } = await supabase
    .from('provider_services')
    .update({ is_active: input.is_active })
    .ilike('service_type', serviceType);

  if (error) {
    throw error;
  }

  return getAdminServiceModerationSummary(supabase);
}

export async function rolloutAdminServiceGlobally(
  supabase: SupabaseClient,
  input: AdminServiceGlobalRolloutInput,
): Promise<AdminServiceModerationSummaryItem[]> {
  const normalizedServiceType = input.service_type.trim();
  const overwriteExisting = input.overwrite_existing ?? false;

  const providerIdsQuery = supabase
    .from('providers')
    .select('id, provider_type, admin_approval_status, account_status')
    .order('id', { ascending: true })
    .limit(5000);

  const { data: providers, error: providersError } = await providerIdsQuery;

  if (providersError) {
    throw providersError;
  }

  const targetProviderIds = new Set(
    (providers ?? [])
      .filter((provider) => provider.admin_approval_status === 'approved' && provider.account_status === 'active')
      .map((provider) => provider.id),
  );

  const normalizedProviderTypes = new Set(
    (input.provider_types ?? [])
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  );

  if (normalizedProviderTypes.size > 0) {
    for (const provider of providers ?? []) {
      if (!targetProviderIds.has(provider.id)) {
        continue;
      }

      const providerType = String(provider.provider_type ?? '').trim().toLowerCase();
      if (!normalizedProviderTypes.has(providerType)) {
        targetProviderIds.delete(provider.id);
      }
    }
  }

  if (input.provider_ids && input.provider_ids.length > 0) {
    const requested = new Set(input.provider_ids);
    for (const providerId of Array.from(targetProviderIds)) {
      if (!requested.has(providerId)) {
        targetProviderIds.delete(providerId);
      }
    }
  }

  if (targetProviderIds.size === 0) {
    return getAdminServiceModerationSummary(supabase);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('provider_services')
    .select('id, provider_id, service_type')
    .ilike('service_type', normalizedServiceType)
    .in('provider_id', Array.from(targetProviderIds));

  if (existingError) {
    throw existingError;
  }

  const existingByProvider = new Map<number, { id: string; provider_id: number; service_type: string }>();

  for (const row of existingRows ?? []) {
    existingByProvider.set(row.provider_id, row);
  }

  const upsertRows: Array<{
    id?: string;
    provider_id: number;
    service_type: string;
    base_price: number;
    surge_price: number | null;
    commission_percentage: number | null;
    service_duration_minutes: number | null;
    is_active: boolean;
  }> = [];
  const touchedServiceIds: string[] = [];

  for (const providerId of targetProviderIds) {
    const existing = existingByProvider.get(providerId);

    if (existing && !overwriteExisting) {
      touchedServiceIds.push(existing.id);
      continue;
    }

    upsertRows.push({
      id: existing?.id,
      provider_id: providerId,
      service_type: normalizedServiceType,
      base_price: input.base_price,
      surge_price: input.surge_price ?? null,
      commission_percentage: input.commission_percentage ?? null,
      service_duration_minutes: input.service_duration_minutes ?? null,
      is_active: input.is_active ?? true,
    });
  }

  if (upsertRows.length > 0) {
    const { error: upsertError, data: upsertedRows } = await supabase
      .from('provider_services')
      .upsert(upsertRows, { onConflict: 'id' })
      .select('id');

    if (upsertError) {
      throw upsertError;
    }

    for (const row of upsertedRows ?? []) {
      touchedServiceIds.push(row.id);
    }
  }

  const pincodeValues = sanitizePincodeValues(input.service_pincodes);

  if (touchedServiceIds.length > 0) {
    const { error: deleteCoverageError } = await supabase
      .from('provider_service_pincodes')
      .delete()
      .in('provider_service_id', touchedServiceIds);

    if (deleteCoverageError && deleteCoverageError.code !== '42P01') {
      throw deleteCoverageError;
    }

    if (pincodeValues.length > 0) {
      const rows = touchedServiceIds.flatMap((serviceId) =>
        pincodeValues.map((pincode) => ({
          provider_service_id: serviceId,
          pincode,
          is_enabled: true,
        })),
      );

      const { error: insertCoverageError } = await supabase.from('provider_service_pincodes').upsert(rows, {
        onConflict: 'provider_service_id,pincode',
      });

      if (insertCoverageError && insertCoverageError.code !== '42P01') {
        throw insertCoverageError;
      }
    }
  }

  return getAdminServiceModerationSummary(supabase);
}

export async function listPlatformDiscounts(supabase: SupabaseClient): Promise<PlatformDiscount[]> {
  const { data, error } = await supabase.from('platform_discounts').select('id, code, title, description, discount_type, discount_value, max_discount_amount, min_booking_amount, applies_to_service_type, valid_from, valid_until, usage_limit_total, usage_limit_per_user, first_booking_only, is_active, created_by, created_at, updated_at').order('created_at', { ascending: false }).limit(500);

  if (error) {
    if (error.code === '42P01') {
      return [];
    }
    throw error;
  }

  return (data ?? []) as PlatformDiscount[];
}

export async function getPlatformDiscountAnalytics(supabase: SupabaseClient): Promise<PlatformDiscountAnalyticsSummary> {
  const [discounts, redemptionsResult, bookingsCountResult] = await Promise.all([
    listPlatformDiscounts(supabase),
    supabase.from('discount_redemptions').select('discount_id, discount_amount, reversed_at').limit(20000),
    supabase.from('bookings').select('id', { count: 'exact', head: true }),
  ]);

  if (redemptionsResult.error) {
    if (redemptionsResult.error.code === '42P01') {
      return {
        total_discounts: discounts.length,
        total_active_discounts: discounts.filter((item) => item.is_active).length,
        total_redemptions: 0,
        total_discount_amount: 0,
        total_bookings: bookingsCountResult.count ?? 0,
        booking_redemption_rate: 0,
        top_discounts: [],
      };
    }
    throw redemptionsResult.error;
  }

  if (bookingsCountResult.error) {
    throw bookingsCountResult.error;
  }

  const discountsById = new Map(discounts.map((item) => [item.id, item]));
  const aggregation = new Map<string, { redemption_count: number; total_discount_amount: number }>();

  for (const row of redemptionsResult.data ?? []) {
    if (row.reversed_at) {
      continue;
    }

    const current = aggregation.get(row.discount_id) ?? { redemption_count: 0, total_discount_amount: 0 };
    current.redemption_count += 1;
    current.total_discount_amount += Number(row.discount_amount ?? 0);
    aggregation.set(row.discount_id, current);
  }

  const topDiscounts = Array.from(aggregation.entries())
    .map(([discountId, value]) => {
      const discount = discountsById.get(discountId);

      if (!discount) {
        return null;
      }

      return {
        discount_id: discount.id,
        code: discount.code,
        title: discount.title,
        redemption_count: value.redemption_count,
        total_discount_amount: Number(value.total_discount_amount.toFixed(2)),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      if (right.redemption_count !== left.redemption_count) {
        return right.redemption_count - left.redemption_count;
      }

      return right.total_discount_amount - left.total_discount_amount;
    })
    .slice(0, 5);

  const activeRedemptions = (redemptionsResult.data ?? []).filter((row) => !row.reversed_at);
  const totalRedemptions = activeRedemptions.length;
  const totalDiscountAmount = Number(
    activeRedemptions.reduce((sum, row) => sum + Number(row.discount_amount ?? 0), 0).toFixed(2),
  );
  const totalBookings = bookingsCountResult.count ?? 0;
  const redemptionRate = totalBookings > 0 ? Number(((totalRedemptions / totalBookings) * 100).toFixed(2)) : 0;

  return {
    total_discounts: discounts.length,
    total_active_discounts: discounts.filter((item) => item.is_active).length,
    total_redemptions: totalRedemptions,
    total_discount_amount: totalDiscountAmount,
    total_bookings: totalBookings,
    booking_redemption_rate: redemptionRate,
    top_discounts: topDiscounts,
  };
}

export async function upsertPlatformDiscount(
  supabase: SupabaseClient,
  actorId: string,
  input: AdminUpsertDiscountInput,
): Promise<PlatformDiscount> {
  const payload = {
    id: input.id,
    code: input.code.trim().toUpperCase(),
    title: input.title.trim(),
    description: input.description ?? null,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    max_discount_amount: input.max_discount_amount ?? null,
    min_booking_amount: input.min_booking_amount ?? null,
    applies_to_service_type: input.applies_to_service_type?.trim() || null,
    valid_from: input.valid_from,
    valid_until: input.valid_until ?? null,
    usage_limit_total: input.usage_limit_total ?? null,
    usage_limit_per_user: input.usage_limit_per_user ?? null,
    first_booking_only: input.first_booking_only ?? false,
    is_active: input.is_active ?? true,
    created_by: actorId,
  };

  const { data, error } = await supabase.from('platform_discounts').upsert(payload, { onConflict: 'id' }).select('id, code, title, description, discount_type, discount_value, max_discount_amount, min_booking_amount, applies_to_service_type, valid_from, valid_until, usage_limit_total, usage_limit_per_user, first_booking_only, is_active, created_by, created_at, updated_at').single();

  if (error) {
    throw error;
  }

  return data as PlatformDiscount;
}

export async function patchPlatformDiscount(
  supabase: SupabaseClient,
  discountId: string,
  patch: Partial<AdminUpsertDiscountInput>,
): Promise<PlatformDiscount> {
  const payload = {
    ...(patch.title !== undefined ? { title: patch.title?.trim() ?? null } : {}),
    ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
    ...(patch.discount_type !== undefined ? { discount_type: patch.discount_type } : {}),
    ...(patch.discount_value !== undefined ? { discount_value: patch.discount_value } : {}),
    ...(patch.max_discount_amount !== undefined ? { max_discount_amount: patch.max_discount_amount ?? null } : {}),
    ...(patch.min_booking_amount !== undefined ? { min_booking_amount: patch.min_booking_amount ?? null } : {}),
    ...(patch.applies_to_service_type !== undefined
      ? { applies_to_service_type: patch.applies_to_service_type?.trim() || null }
      : {}),
    ...(patch.valid_from !== undefined ? { valid_from: patch.valid_from } : {}),
    ...(patch.valid_until !== undefined ? { valid_until: patch.valid_until ?? null } : {}),
    ...(patch.usage_limit_total !== undefined ? { usage_limit_total: patch.usage_limit_total ?? null } : {}),
    ...(patch.usage_limit_per_user !== undefined ? { usage_limit_per_user: patch.usage_limit_per_user ?? null } : {}),
    ...(patch.first_booking_only !== undefined ? { first_booking_only: patch.first_booking_only } : {}),
    ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
  };

  const { data, error } = await supabase.from('platform_discounts').update(payload).eq('id', discountId).select('id, code, title, description, discount_type, discount_value, max_discount_amount, min_booking_amount, applies_to_service_type, valid_from, valid_until, usage_limit_total, usage_limit_per_user, first_booking_only, is_active, created_by, created_at, updated_at').single();

  if (error) {
    throw error;
  }

  return data as PlatformDiscount;
}

export async function deletePlatformDiscount(supabase: SupabaseClient, discountId: string): Promise<void> {
  const { error } = await supabase.from('platform_discounts').delete().eq('id', discountId);

  if (error) {
    throw error;
  }
}

export async function verifyDocument(
  supabase: SupabaseClient,
  documentId: string,
  verificationStatus: DocumentVerificationStatus,
) {
  const verifiedAt = verificationStatus === 'approved' ? getISTTimestamp() : null;

  const { data, error } = await supabase
    .from('provider_documents')
    .update({
      verification_status: verificationStatus,
      verified_at: verifiedAt,
    })
    .eq('id', documentId)
    .select('id, provider_id, document_type, document_url, verification_status, verified_at, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function setAvailability(
  supabase: SupabaseClient,
  providerId: number,
  availabilityRows: SetAvailabilityInput,
  setBy: 'provider' | 'admin' = 'provider',
) {
  const normalizeTimeKey = (value: string) => {
    const [hours = '00', minutes = '00'] = value.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  };

  const toAvailabilityKey = (dayOfWeek: number, startTime: string, endTime: string) =>
    `${dayOfWeek}|${normalizeTimeKey(startTime)}|${normalizeTimeKey(endTime)}`;

  const deduplicatedRows = new Map<string, SetAvailabilityInput[number]>();

  for (const row of availabilityRows) {
    const key = toAvailabilityKey(row.day_of_week, row.start_time, row.end_time);
    const existing = deduplicatedRows.get(key);

    if (!existing || (!existing.id && row.id)) {
      deduplicatedRows.set(key, row);
    }
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('provider_availability')
    .select('id, day_of_week, start_time, end_time, admin_locked')
    .eq('provider_id', providerId);

  if (existingError) {
    throw existingError;
  }

  const existingIdByKey = new Map<string, string>();
  const adminLockedIds = new Set<string>();

  for (const row of existingRows ?? []) {
    const key = toAvailabilityKey(row.day_of_week, row.start_time, row.end_time);

    if (!existingIdByKey.has(key)) {
      existingIdByKey.set(key, row.id);
    }

    if (row.admin_locked) {
      adminLockedIds.add(row.id);
    }
  }

  const rowsToUpsert = Array.from(deduplicatedRows.values())
    .map((row) => {
      const key = toAvailabilityKey(row.day_of_week, row.start_time, row.end_time);
      const existingId = existingIdByKey.get(key);

      return {
        ...row,
        id: row.id ?? existingId ?? crypto.randomUUID(),
        provider_id: providerId,
        is_available: row.is_available ?? true,
        set_by: setBy,
        // Providers cannot change the admin_locked flag; admins can set it explicitly.
        admin_locked: setBy === 'admin' ? (row.admin_locked ?? false) : false,
      };
    })
    // Providers cannot overwrite slots that have been locked by an admin.
    .filter((row) => setBy === 'admin' || !adminLockedIds.has(row.id));

  const { data: upsertedRows, error } = await supabase
    .from('provider_availability')
    .upsert(rowsToUpsert, { onConflict: 'id' })
    .select('id');

  if (error) {
    throw error;
  }

  const retainedIds = new Set((upsertedRows ?? []).map((row) => row.id));

  // Providers cannot delete admin-locked slots — exclude them from stale detection.
  const staleIds = (existingRows ?? [])
    .map((row) => row.id)
    .filter((id) => !retainedIds.has(id) && (setBy === 'admin' || !adminLockedIds.has(id)));

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('provider_availability')
      .delete()
      .eq('provider_id', providerId)
      .in('id', staleIds);

    if (deleteError) {
      throw deleteError;
    }
  }

  return getAvailability(supabase, providerId);
}

export async function getAvailability(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('provider_availability')
    .select('id, provider_id, day_of_week, start_time, end_time, is_available, slot_duration_minutes, buffer_time_minutes, set_by, admin_locked, created_at')
    .eq('provider_id', providerId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function updateAvailabilitySlot(
  supabase: SupabaseClient,
  providerId: number,
  availabilityId: string,
  input: SetAvailabilityInput[number],
) {
  const { data, error } = await supabase
    .from('provider_availability')
    .update({
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      is_available: input.is_available,
    })
    .eq('id', availabilityId)
    .eq('provider_id', providerId)
    .select('id, provider_id, day_of_week, start_time, end_time, is_available, slot_duration_minutes, buffer_time_minutes, set_by, admin_locked, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteAvailabilitySlot(supabase: SupabaseClient, providerId: number, availabilityId: string) {
  const { error } = await supabase
    .from('provider_availability')
    .delete()
    .eq('id', availabilityId)
    .eq('provider_id', providerId);

  if (error) {
    throw error;
  }
}

export async function getProviderReviews(supabase: SupabaseClient, providerId: number) {
  const page = await getProviderReviewsPage(supabase, providerId, { page: 1, pageSize: 200 });
  return page.reviews;
}

export async function getProviderReviewsPage(
  supabase: SupabaseClient,
  providerId: number,
  query: ProviderReviewsQuery,
): Promise<ProviderReviewsPage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 10));
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let countQuery = supabase
    .from('provider_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('provider_id', providerId);

  let dataQuery = supabase
    .from('provider_reviews')
    .select('id, provider_id, booking_id, user_id, rating, review_text, provider_response, created_at')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .range(start, end);

  if (query.rating) {
    countQuery = countQuery.eq('rating', query.rating);
    dataQuery = dataQuery.eq('rating', query.rating);
  }

  const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([countQuery, dataQuery]);

  if (countError) {
    throw countError;
  }

  if (dataError) {
    throw dataError;
  }

  const total = count ?? 0;

  return {
    reviews: (data ?? []) as ProviderReview[],
    page,
    pageSize,
    total,
    hasMore: start + pageSize < total,
  };
}

export async function getProviderDocuments(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('provider_documents')
    .select('id, provider_id, document_type, document_url, verification_status, verified_at, created_at')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createProviderDocument(
  supabase: SupabaseClient,
  providerId: number,
  input: CreateProviderDocumentInput,
) {
  const { data, error } = await supabase
    .from('provider_documents')
    .insert({
      provider_id: providerId,
      document_type: input.document_type,
      document_url: input.document_url,
      verification_status: 'pending',
    })
    .select('id, provider_id, document_type, document_url, verification_status, verified_at, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProviderDocument(
  supabase: SupabaseClient,
  providerId: number,
  documentId: string,
  input: UpdateProviderDocumentInput,
) {
  const { data, error } = await supabase
    .from('provider_documents')
    .update(input)
    .eq('id', documentId)
    .eq('provider_id', providerId)
    .select('id, provider_id, document_type, document_url, verification_status, verified_at, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteProviderDocument(supabase: SupabaseClient, providerId: number, documentId: string) {
  const { error } = await supabase
    .from('provider_documents')
    .delete()
    .eq('id', documentId)
    .eq('provider_id', providerId);

  if (error) {
    throw error;
  }
}

export async function respondToReview(
  supabase: SupabaseClient,
  providerId: number,
  reviewId: string,
  responseText: string,
) {
  const currentReview = await supabase
    .from('provider_reviews')
    .select('provider_response')
    .eq('id', reviewId)
    .eq('provider_id', providerId)
    .maybeSingle<{ provider_response: string | null }>();

  if (currentReview.error) {
    throw currentReview.error;
  }

  const { data, error } = await supabase
    .from('provider_reviews')
    .update({ provider_response: responseText })
    .eq('id', reviewId)
    .eq('provider_id', providerId)
    .select('id, provider_id, booking_id, user_id, rating, review_text, provider_response, created_at')
    .single<ProviderReview>();

  if (error) {
    throw error;
  }

  const historyInsert = await supabase.from('provider_review_response_history').insert({
    review_id: reviewId,
    provider_id: providerId,
    previous_response: currentReview.data?.provider_response ?? null,
    new_response: responseText,
  });

  if (historyInsert.error && historyInsert.error.code !== '42P01') {
    throw historyInsert.error;
  }

  return data;
}

export async function getProviderReviewResponseHistory(supabase: SupabaseClient, providerId: number, reviewId: string) {
  const { data, error } = await supabase
    .from('provider_review_response_history')
    .select('id, review_id, provider_id, previous_response, new_response, created_at')
    .eq('provider_id', providerId)
    .eq('review_id', reviewId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    if (error.code === '42P01') {
      return [];
    }
    throw error;
  }

  return data ?? [];
}

export async function listAdminProviderModerationItems(supabase: SupabaseClient): Promise<AdminProviderModerationItem[]> {
  const [providersResult, documentsResult, clinicDetailsResult, professionalDetailsResult] = await Promise.all([
    supabase
      .from('providers')
      .select(
        'id, user_id, name, email, profile_photo_url, provider_type, business_name, admin_approval_status, verification_status, account_status, average_rating, total_bookings, address, lat, lng, service_radius_km, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('provider_documents').select('provider_id, verification_status').limit(5000),
    supabase
      .from('provider_clinic_details')
      .select(
        'provider_id, address, city, state, pincode, latitude, longitude, registration_number, gst_number, number_of_doctors, hospitalization_available, emergency_services_available',
      )
      .limit(5000),
    supabase
      .from('provider_professional_details')
      .select(
        'provider_id, license_number, specialization, teleconsult_enabled, emergency_service_enabled, equipment_details, insurance_document_url',
      )
      .limit(5000),
  ]);

  if (providersResult.error) {
    throw providersResult.error;
  }

  if (documentsResult.error) {
    throw documentsResult.error;
  }

  if (clinicDetailsResult.error) {
    throw clinicDetailsResult.error;
  }

  if (professionalDetailsResult.error) {
    throw professionalDetailsResult.error;
  }

  const providerUserIds = (providersResult.data ?? [])
    .map((provider) => provider.user_id)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const userAddressById = new Map<string, string | null>();

  if (providerUserIds.length > 0) {
    const { data: userRows, error: usersError } = await supabase
      .from('users')
      .select('id, address')
      .in('id', providerUserIds);

    if (usersError) {
      throw usersError;
    }

    for (const row of userRows ?? []) {
      userAddressById.set(row.id, row.address ?? null);
    }
  }

  const docsByProvider = new Map<number, { pending: number; approved: number; rejected: number }>();

  for (const row of documentsResult.data ?? []) {
    const current = docsByProvider.get(row.provider_id) ?? { pending: 0, approved: 0, rejected: 0 };

    if (row.verification_status === 'approved') {
      current.approved += 1;
    } else if (row.verification_status === 'rejected') {
      current.rejected += 1;
    } else {
      current.pending += 1;
    }

    docsByProvider.set(row.provider_id, current);
  }

  const clinicByProvider = new Map<number, Omit<AdminProviderLocationModeration, 'provider_id' | 'service_radius_km'>>();
  const clinicMetaByProvider = new Map<
    number,
    {
      registration_number: string | null;
      gst_number: string | null;
      number_of_doctors: number | null;
      hospitalization_available: boolean;
      emergency_services_available: boolean;
    }
  >();

  for (const row of clinicDetailsResult.data ?? []) {
    clinicByProvider.set(row.provider_id, {
      address: row.address,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      latitude: row.latitude,
      longitude: row.longitude,
    });

    clinicMetaByProvider.set(row.provider_id, {
      registration_number: row.registration_number,
      gst_number: row.gst_number,
      number_of_doctors: row.number_of_doctors,
      hospitalization_available: row.hospitalization_available,
      emergency_services_available: row.emergency_services_available,
    });
  }

  const professionalByProvider = new Map<
    number,
    {
      license_number: string | null;
      specialization: string | null;
      teleconsult_enabled: boolean;
      emergency_service_enabled: boolean;
      equipment_details: string | null;
      insurance_document_url: string | null;
    }
  >();

  for (const row of professionalDetailsResult.data ?? []) {
    professionalByProvider.set(row.provider_id, {
      license_number: row.license_number,
      specialization: row.specialization,
      teleconsult_enabled: row.teleconsult_enabled,
      emergency_service_enabled: row.emergency_service_enabled,
      equipment_details: row.equipment_details,
      insurance_document_url: row.insurance_document_url,
    });
  }

  return (providersResult.data ?? []).map((item) => {
    const providerAddress = typeof item.address === 'string' ? item.address.trim() : '';
    const userAddress = item.user_id ? userAddressById.get(item.user_id) ?? null : null;
    const normalizedProviderAddress = providerAddress && providerAddress.toLowerCase() !== 'address pending' ? providerAddress : null;

    return {
      ...item,
      provider_type: item.provider_type,
      address: clinicByProvider.get(item.id)?.address ?? normalizedProviderAddress ?? userAddress,
      city: clinicByProvider.get(item.id)?.city ?? null,
      state: clinicByProvider.get(item.id)?.state ?? null,
      pincode: clinicByProvider.get(item.id)?.pincode ?? null,
      latitude: clinicByProvider.get(item.id)?.latitude ?? item.lat ?? null,
      longitude: clinicByProvider.get(item.id)?.longitude ?? item.lng ?? null,
      service_radius_km: item.service_radius_km ?? null,
      documentCounts: docsByProvider.get(item.id) ?? { pending: 0, approved: 0, rejected: 0 },
      professional_details: professionalByProvider.get(item.id) ?? null,
      clinic_details: clinicMetaByProvider.get(item.id) ?? null,
    };
  }) as AdminProviderModerationItem[];
}

export async function getAdminProviderLocation(
  supabase: SupabaseClient,
  providerId: number,
): Promise<AdminProviderLocationModeration> {
  const [providerResult, clinicDetailsResult] = await Promise.all([
    supabase.from('providers').select('id, user_id, address, lat, lng, service_radius_km').eq('id', providerId).maybeSingle(),
    supabase
      .from('provider_clinic_details')
      .select('provider_id, address, city, state, pincode, latitude, longitude')
      .eq('provider_id', providerId)
      .maybeSingle(),
  ]);

  if (providerResult.error) {
    throw providerResult.error;
  }

  if (clinicDetailsResult.error) {
    throw clinicDetailsResult.error;
  }

  if (!providerResult.data) {
    throw new Error('Provider not found');
  }

  let userAddress: string | null = null;

  if (providerResult.data.user_id) {
    const { data: linkedUser, error: linkedUserError } = await supabase
      .from('users')
      .select('address')
      .eq('id', providerResult.data.user_id)
      .maybeSingle();

    if (linkedUserError) {
      throw linkedUserError;
    }

    userAddress = linkedUser?.address ?? null;
  }

  const providerAddress = typeof providerResult.data.address === 'string' ? providerResult.data.address.trim() : '';
  const normalizedProviderAddress =
    providerAddress && providerAddress.toLowerCase() !== 'address pending' ? providerAddress : null;

  return {
    provider_id: providerResult.data.id,
    address: clinicDetailsResult.data?.address ?? normalizedProviderAddress ?? userAddress,
    city: clinicDetailsResult.data?.city ?? null,
    state: clinicDetailsResult.data?.state ?? null,
    pincode: clinicDetailsResult.data?.pincode ?? null,
    latitude: clinicDetailsResult.data?.latitude ?? providerResult.data.lat ?? null,
    longitude: clinicDetailsResult.data?.longitude ?? providerResult.data.lng ?? null,
    service_radius_km: providerResult.data.service_radius_km ?? null,
  };
}

function hasTextValue(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateAdminProviderLocationConsistency(location: AdminProviderLocationModeration): string[] {
  const issues: string[] = [];
  const hasLatitude = location.latitude !== null;
  const hasLongitude = location.longitude !== null;

  if (hasLatitude !== hasLongitude) {
    issues.push('Latitude and longitude must be provided together.');
  }

  if (hasLatitude && hasLongitude) {
    const hasAddress = hasTextValue(location.address);
    const hasCity = hasTextValue(location.city);
    const hasState = hasTextValue(location.state);
    const hasPincode = hasTextValue(location.pincode);

    if (!hasAddress || !hasCity || !hasState || !hasPincode) {
      issues.push('Address, city, state, and pincode are required when coordinates are set.');
    }
  }

  if (location.pincode && !/^[1-9]\d{5}$/.test(location.pincode.trim())) {
    issues.push('Pincode must be a valid 6-digit Indian pincode.');
  }

  return issues;
}

export async function getAdminProviderCoverageWarnings(
  supabase: SupabaseClient,
  providerId: number,
  location: AdminProviderLocationModeration,
): Promise<string[]> {
  const { data: providerServices, error: providerServicesError } = await supabase
    .from('provider_services')
    .select('id')
    .eq('provider_id', providerId)
    .limit(5000);

  if (providerServicesError) {
    throw providerServicesError;
  }

  const serviceIds = (providerServices ?? []).map((item) => item.id);

  if (serviceIds.length === 0) {
    return [];
  }

  const { data: pincodeRows, error: pincodeRowsError } = await supabase
    .from('provider_service_pincodes')
    .select('provider_service_id, pincode, is_enabled')
    .in('provider_service_id', serviceIds)
    .limit(10000);

  if (pincodeRowsError) {
    if (pincodeRowsError.code === '42P01') {
      return [];
    }

    throw pincodeRowsError;
  }

  const enabledPincodes = new Set(
    (pincodeRows ?? [])
      .filter((row) => row.is_enabled !== false)
      .map((row) => row.pincode)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
  );

  if (enabledPincodes.size === 0) {
    return [];
  }

  const clinicPincode = location.pincode?.trim() ?? null;
  const serviceRadius = location.service_radius_km;
  const coveragePincodeList = Array.from(enabledPincodes);
  const nonClinicCoverageCount = clinicPincode
    ? coveragePincodeList.filter((item) => item !== clinicPincode).length
    : coveragePincodeList.length;

  const warnings: string[] = [];

  if (!clinicPincode && serviceRadius === null) {
    warnings.push('Service pincodes are configured, but clinic pincode and service radius are both missing.');
  }

  if (clinicPincode && serviceRadius !== null && serviceRadius <= 0 && nonClinicCoverageCount > 0) {
    warnings.push('Service radius is 0 km, but enabled service pincodes extend beyond the clinic pincode.');
  }

  if (serviceRadius !== null && serviceRadius <= 2 && nonClinicCoverageCount >= 3) {
    warnings.push('Service radius is very small for the current pincode rollout footprint.');
  }

  if (serviceRadius === null && enabledPincodes.size >= 10) {
    warnings.push('Large pincode rollout is configured without a service radius baseline.');
  }

  return warnings;
}

export async function updateAdminProviderLocation(
  supabase: SupabaseClient,
  providerId: number,
  input: UpdateAdminProviderLocationInput,
): Promise<AdminProviderLocationModeration> {
  const { data: provider, error: providerLookupError } = await supabase
    .from('providers')
    .select('id')
    .eq('id', providerId)
    .maybeSingle();

  if (providerLookupError) {
    throw providerLookupError;
  }

  if (!provider) {
    throw new Error('Provider not found');
  }

  const existingLocation = await getAdminProviderLocation(supabase, providerId);
  const mergedLocation: AdminProviderLocationModeration = {
    ...existingLocation,
    ...(Object.prototype.hasOwnProperty.call(input, 'address') ? { address: input.address ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, 'city') ? { city: input.city ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, 'state') ? { state: input.state ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, 'pincode') ? { pincode: input.pincode ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, 'latitude') ? { latitude: input.latitude ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, 'longitude') ? { longitude: input.longitude ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, 'service_radius_km')
      ? { service_radius_km: input.service_radius_km ?? null }
      : {}),
  };

  const consistencyIssues = validateAdminProviderLocationConsistency(mergedLocation);

  if (consistencyIssues.length > 0) {
    throw new Error(consistencyIssues.join(' '));
  }

  if (Object.prototype.hasOwnProperty.call(input, 'service_radius_km')) {
    const { error: providerUpdateError } = await supabase
      .from('providers')
      .update({ service_radius_km: input.service_radius_km ?? null })
      .eq('id', providerId);

    if (providerUpdateError) {
      throw providerUpdateError;
    }
  }

  const clinicPayload: Record<string, string | number | null> = {};

  if (Object.prototype.hasOwnProperty.call(input, 'address')) {
    clinicPayload.address = input.address ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'city')) {
    clinicPayload.city = input.city ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'state')) {
    clinicPayload.state = input.state ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'pincode')) {
    clinicPayload.pincode = input.pincode ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'latitude')) {
    clinicPayload.latitude = input.latitude ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'longitude')) {
    clinicPayload.longitude = input.longitude ?? null;
  }

  if (Object.keys(clinicPayload).length > 0) {
    const { error: clinicUpsertError } = await supabase.from('provider_clinic_details').upsert(
      {
        provider_id: providerId,
        ...clinicPayload,
      },
      { onConflict: 'provider_id' },
    );

    if (clinicUpsertError) {
      throw clinicUpsertError;
    }
  }

  return getAdminProviderLocation(supabase, providerId);
}

export async function updateAdminProviderProfile(
  supabase: SupabaseClient,
  providerId: number,
  input: UpdateAdminProviderProfileInput,
) {
  const professionalPayload: Record<string, unknown> = {};
  const clinicPayload: Record<string, unknown> = {};

  const payload: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    payload.name = input.name?.trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, 'email')) {
    const normalizedEmail = input.email?.trim().toLowerCase() ?? null;
    payload.email = normalizedEmail || null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'provider_type')) {
    payload.provider_type = input.provider_type?.trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'business_name')) {
    payload.business_name = input.business_name?.trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'profile_photo_url')) {
    payload.profile_photo_url = input.profile_photo_url?.trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'service_radius_km')) {
    payload.service_radius_km = input.service_radius_km ?? null;
  }

  if (input.professional_details) {
    if (Object.prototype.hasOwnProperty.call(input.professional_details, 'license_number')) {
      professionalPayload.license_number = input.professional_details.license_number?.trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(input.professional_details, 'specialization')) {
      professionalPayload.specialization = input.professional_details.specialization?.trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(input.professional_details, 'teleconsult_enabled')) {
      professionalPayload.teleconsult_enabled = input.professional_details.teleconsult_enabled;
    }
    if (Object.prototype.hasOwnProperty.call(input.professional_details, 'emergency_service_enabled')) {
      professionalPayload.emergency_service_enabled = input.professional_details.emergency_service_enabled;
    }
    if (Object.prototype.hasOwnProperty.call(input.professional_details, 'equipment_details')) {
      professionalPayload.equipment_details = input.professional_details.equipment_details?.trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(input.professional_details, 'insurance_document_url')) {
      professionalPayload.insurance_document_url = input.professional_details.insurance_document_url?.trim() || null;
    }
  }

  if (input.clinic_details) {
    if (Object.prototype.hasOwnProperty.call(input.clinic_details, 'registration_number')) {
      clinicPayload.registration_number = input.clinic_details.registration_number?.trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(input.clinic_details, 'gst_number')) {
      clinicPayload.gst_number = input.clinic_details.gst_number?.trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(input.clinic_details, 'number_of_doctors')) {
      clinicPayload.number_of_doctors = input.clinic_details.number_of_doctors ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(input.clinic_details, 'hospitalization_available')) {
      clinicPayload.hospitalization_available = input.clinic_details.hospitalization_available;
    }
    if (Object.prototype.hasOwnProperty.call(input.clinic_details, 'emergency_services_available')) {
      clinicPayload.emergency_services_available = input.clinic_details.emergency_services_available;
    }
  }

  if (Object.keys(professionalPayload).length > 0) {
    const { error: professionalUpsertError } = await supabase.from('provider_professional_details').upsert(
      {
        provider_id: providerId,
        ...professionalPayload,
      },
      { onConflict: 'provider_id' },
    );

    if (professionalUpsertError) {
      throw professionalUpsertError;
    }
  }

  if (Object.keys(clinicPayload).length > 0) {
    const { error: clinicUpsertError } = await supabase.from('provider_clinic_details').upsert(
      {
        provider_id: providerId,
        ...clinicPayload,
      },
      { onConflict: 'provider_id' },
    );

    if (clinicUpsertError) {
      throw clinicUpsertError;
    }
  }

  let data:
    | {
        id: number;
        name: string;
        email: string | null;
        profile_photo_url: string | null;
        provider_type: string;
        business_name: string | null;
        service_radius_km: number | null;
        updated_at: string;
      }
    | null = null;

  if (Object.keys(payload).length > 0) {
    const { data: updatedProvider, error } = await supabase
      .from('providers')
      .update(payload)
      .eq('id', providerId)
      .select('id, name, email, profile_photo_url, provider_type, business_name, service_radius_km, updated_at')
      .single();

    if (error) {
      throw error;
    }

    data = updatedProvider;
  } else {
    const { data: existingProvider, error } = await supabase
      .from('providers')
      .select('id, name, email, profile_photo_url, provider_type, business_name, service_radius_km, updated_at')
      .eq('id', providerId)
      .single();

    if (error) {
      throw error;
    }

    data = existingProvider;
  }

  const [professionalDetailsResult, clinicDetailsResult] = await Promise.all([
    supabase
      .from('provider_professional_details')
      .select(
        'license_number, specialization, teleconsult_enabled, emergency_service_enabled, equipment_details, insurance_document_url',
      )
      .eq('provider_id', providerId)
      .maybeSingle(),
    supabase
      .from('provider_clinic_details')
      .select(
        'registration_number, gst_number, number_of_doctors, hospitalization_available, emergency_services_available',
      )
      .eq('provider_id', providerId)
      .maybeSingle(),
  ]);

  if (professionalDetailsResult.error) {
    throw professionalDetailsResult.error;
  }

  if (clinicDetailsResult.error) {
    throw clinicDetailsResult.error;
  }

  return {
    ...data,
    professional_details: professionalDetailsResult.data,
    clinic_details: clinicDetailsResult.data,
  };
}

export async function logProviderAdminAuditEvent(
  supabase: SupabaseClient,
  adminUserId: string,
  providerId: number,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase.from('provider_admin_audit_events').insert({
    provider_id: providerId,
    actor_id: adminUserId,
    action,
    metadata,
  });

  if (error && error.code !== '42P01') {
    throw error;
  }
}
