import { getMobileApiClient } from './mobile-client';

type QueryValue = string | number | boolean | null | undefined;

export type RoleName = 'user' | 'provider' | 'admin' | 'staff';

export type AuthProfilePayload = {
  name: string;
  email: string;
  phone: string;
  referralCode?: string | null;
};

export type CreateAddressPayload = {
  label?: 'Home' | 'Office' | 'Other' | null;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  is_default?: boolean;
};

export type CreatePetPayload = {
  name: string;
  breed?: string | null;
  age?: number | null;
  weight?: number | null;
  gender?: 'male' | 'female' | 'other' | null;
  allergies?: string | null;
};

export type BookingPayload = {
  petId: number;
  providerId: number;
  providerServiceId: string;
  bookingDate: string;
  startTime: string;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  locationAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  providerNotes?: string | null;
  discountCode?: string;
  addOns?: Array<{ id: string; quantity: number }>;
  walletCreditsAppliedInr?: number;
  paymentMode?: 'direct_to_provider' | 'platform' | 'mixed';
  pincode?: string;
};

type ProviderStatusUpdate = {
  status: 'confirmed' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';
  providerNotes?: string;
  completionFeedback?: string;
  cancellationReason?: string;
};

type ProviderAvailabilitySlot = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available?: boolean;
  slot_duration_minutes?: number;
  buffer_time_minutes?: number;
};

type ProviderApplicationPayload = {
  partner_category: 'individual' | 'business';
  business_name?: string;
  team_size?: number | '' | null;
  full_name: string;
  email: string;
  phone_number: string;
  city: string;
  state: string;
  provider_type: string;
  years_of_experience: number;
  service_modes: string[];
  service_areas: string;
  portfolio_url?: string;
  motivation?: string;
  website?: string;
};

function buildPath(path: string, query?: Record<string, QueryValue>) {
  if (!query || Object.keys(query).length === 0) {
    return path;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

async function apiGet<T>(path: string, query?: Record<string, QueryValue>) {
  return getMobileApiClient().get<T>(buildPath(path, query));
}

async function apiPost<T>(path: string, body?: unknown, skipAuth = false) {
  return getMobileApiClient().post<T>(path, body, { skipAuth });
}

async function apiPatch<T>(path: string, body?: unknown) {
  return getMobileApiClient().patch<T>(path, body);
}

async function apiPut<T>(path: string, body?: unknown) {
  return getMobileApiClient().put<T>(path, body);
}

async function apiDelete<T>(path: string) {
  return getMobileApiClient().delete<T>(path);
}

export async function preSignup(payload: AuthProfilePayload) {
  return apiPost<{ success: boolean }>('/api/auth/pre-signup', payload, true);
}

export async function completeProfile(payload: AuthProfilePayload) {
  return apiPost<{ success: boolean }>('/api/auth/complete-profile', payload);
}

export async function bootstrapProfile() {
  return apiPost<{ success: boolean; requiresProfileSetup?: boolean }>('/api/auth/bootstrap-profile');
}

export async function getUserProfile() {
  return apiGet<{
    profile: {
      id: string;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      age?: number | null;
      gender?: string | null;
      photo_url?: string | null;
      roles?: { name?: RoleName } | null;
      [key: string]: unknown;
    };
  }>('/api/user/profile');
}

export async function patchUserProfile(payload: {
  name: string;
  phone: string;
  address: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  photoUrl?: string | null;
}) {
  return apiPatch<{ success: boolean; profile: Record<string, unknown> }>('/api/user/profile', payload);
}

export async function getBookingCatalog() {
  return apiGet<{
    actorRole: RoleName | null;
    providers: Array<{ id: number; name: string | null; provider_type: string | null }>;
    services: Array<{
      id: string;
      provider_id: number;
      service_type: string;
      service_mode: string;
      service_duration_minutes: number;
      base_price: number;
    }>;
    pets: Array<{ id: number; name: string; breed: string | null; photo_url: string | null }>;
    addresses: Array<{
      id: string;
      label: 'Home' | 'Office' | 'Other' | null;
      address_line_1: string;
      address_line_2: string | null;
      city: string;
      state: string;
      pincode: string;
      country: string;
      latitude: number | null;
      longitude: number | null;
      phone: string | null;
      is_default: boolean;
    }>;
    discounts: Array<{
      id: string;
      code: string;
      title: string;
      discount_type: 'percentage' | 'flat';
      discount_value: number;
      max_discount_amount: number | null;
      min_booking_amount: number | null;
      applies_to_service_type: string | null;
      first_booking_only: boolean;
      valid_until: string | null;
    }>;
  }>('/api/bookings/catalog');
}

export async function getUserBookings() {
  return apiGet<{ bookings: Array<Record<string, unknown>> }>('/api/user/bookings');
}

export async function getUserPets() {
  return apiGet<{ pets: Array<Record<string, unknown>> }>('/api/user/pets');
}

export async function createPet(payload: CreatePetPayload) {
  return apiPost<{ success: boolean; pet: Record<string, unknown> }>('/api/user/pets', payload);
}

export async function updatePet(petId: number, payload: CreatePetPayload) {
  return apiPatch<{ success: boolean; pet: Record<string, unknown> }>(`/api/user/pets/${petId}`, payload);
}

export async function deletePet(petId: number) {
  return apiDelete<{ success: boolean }>(`/api/user/pets/${petId}`);
}

export async function getOwnerProfile() {
  return apiGet<{ profile: Record<string, unknown> }>('/api/user/owner-profile');
}

export async function patchOwnerProfile(payload: {
  basic?: Record<string, unknown>;
  household?: Record<string, unknown>;
}) {
  return apiPatch<{ success: boolean; profile: Record<string, unknown> }>('/api/user/owner-profile', payload);
}

export async function getOwnerAddresses() {
  return apiGet<{ addresses: Array<Record<string, unknown>> }>('/api/user/owner-profile/addresses');
}

export async function createOwnerAddress(payload: CreateAddressPayload) {
  return apiPost<{ success: boolean; address: Record<string, unknown> }>(
    '/api/user/owner-profile/addresses',
    payload,
  );
}

export async function patchOwnerAddress(addressId: string, payload: Partial<CreateAddressPayload>) {
  return apiPatch<{ success: boolean; address: Record<string, unknown> }>(
    `/api/user/owner-profile/addresses/${addressId}`,
    payload,
  );
}

export async function deleteOwnerAddress(addressId: string) {
  return apiDelete<{ success: boolean }>(`/api/user/owner-profile/addresses/${addressId}`);
}

export async function getCreditWallet() {
  return apiGet<{ balance: Record<string, unknown>; history: Array<Record<string, unknown>> }>('/api/user/credit-wallet');
}

export async function getMessages(query?: { limit?: number; offset?: number }) {
  return apiGet<{ messages: Array<Record<string, unknown>> }>('/api/messages', query);
}

export async function getNotifications(query?: { limit?: number; offset?: number; unreadOnly?: boolean }) {
  return apiGet<{ notifications: Array<Record<string, unknown>>; unreadCount?: number }>('/api/notifications', query);
}

export async function markAllNotificationsRead() {
  return apiPost<{ success: boolean }>('/api/notifications', { action: 'mark_all_read' });
}

export async function getSubscriptions() {
  return apiGet<{ subscriptions: Array<Record<string, unknown>> }>('/api/subscriptions/me');
}

export async function getSubscriptionPlans() {
  return apiGet<{ plans: Array<Record<string, unknown>> }>('/api/subscriptions/plans');
}

export async function getBillingHistory(query?: { limit?: number }) {
  return apiGet<{ invoices: Array<Record<string, unknown>> }>('/api/billing/me', query);
}

export async function validateReferralCode(code: string) {
  return apiPost<{ valid: boolean; message?: string }>('/api/referrals/validate', { code }, true);
}

export async function getAvailableSlots(input: {
  providerId: number;
  date: string;
  providerServiceId?: string;
  serviceDurationMinutes?: number;
}) {
  return apiGet<{ slots: Array<{ start_time: string; end_time: string; is_available: boolean }> }>(
    '/api/bookings/available-slots',
    input,
  );
}

export async function calculateServicePrice(payload: {
  serviceId: string;
  providerId: number;
  addOns?: Array<{ id: string; quantity: number }>;
}) {
  return apiPost<{
    success: boolean;
    data?: {
      base_total: number;
      addon_total: number;
      discount_amount: number;
      final_total: number;
      breakdown: string[];
    };
    error?: string;
  }>('/api/services/calculate-price', payload, true);
}

export async function previewDiscount(payload: {
  providerServiceId?: string;
  bundleProviderServiceIds?: string[];
  bundleEstimatedTotalInr?: number;
  discountCode: string;
}) {
  return apiPost<{
    success?: boolean;
    preview?: {
      discountId: string;
      discountAmount: number;
      finalAmount: number;
      baseAmount: number;
      discountCode: string;
    };
    error?: string;
  }>('/api/bookings/discount-preview', payload);
}

export async function createBooking(payload: BookingPayload) {
  return apiPost<{ success: boolean; booking: Record<string, unknown> }>('/api/bookings/create', payload);
}

export async function createBookingOrder(payload: BookingPayload) {
  return apiPost<Record<string, unknown>>('/api/payments/bookings/order', payload);
}

export async function verifyBookingOrder(payload: {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}) {
  return apiPost<Record<string, unknown>>('/api/payments/bookings/verify', payload);
}

export async function patchBookingStatus(
  bookingId: number,
  payload: { status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'; cancellationReason?: string },
) {
  return apiPatch<Record<string, unknown>>(`/api/bookings/${bookingId}/status`, payload);
}

export async function getBookingReview(bookingId: number) {
  return apiGet<{ canReview: boolean; review: Record<string, unknown> | null }>(`/api/user/bookings/${bookingId}/review`);
}

export async function postBookingReview(bookingId: number, payload: { rating: number; reviewText?: string }) {
  return apiPost<{ success: boolean; review: Record<string, unknown> }>(`/api/user/bookings/${bookingId}/review`, payload);
}

export async function getProviderDashboard() {
  return apiGet<{ dashboard: Record<string, unknown> | null }>('/api/provider/dashboard');
}

export async function getProviderBookings(query?: {
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  fromDate?: string;
  toDate?: string;
  limit?: number;
}) {
  return apiGet<{ bookings: Array<Record<string, unknown>> }>('/api/provider/bookings', query);
}

export async function patchProviderBookingStatus(bookingId: number, payload: ProviderStatusUpdate) {
  return apiPatch<Record<string, unknown>>(`/api/provider/bookings/${bookingId}/status`, payload);
}

export async function collectProviderBooking(
  bookingId: number,
  payload: { collectionMode: 'cash' | 'upi' | 'other'; notes?: string },
) {
  return apiPost<Record<string, unknown>>(`/api/provider/bookings/${bookingId}/collect`, payload);
}

export async function getProviderAvailability() {
  return apiGet<{ availability: ProviderAvailabilitySlot[] }>('/api/provider/availability');
}

export async function putProviderAvailability(payload: ProviderAvailabilitySlot[]) {
  return apiPut<{ success: boolean; availability: ProviderAvailabilitySlot[]; warnings?: string[] }>(
    '/api/provider/availability',
    payload,
  );
}

export async function getProviderBlockedDates() {
  return apiGet<{ blockedDates: Array<Record<string, unknown>> }>('/api/provider/blocked-dates');
}

export async function createProviderBlockedDate(payload: {
  blockedDate: string;
  blockStartTime?: string;
  blockEndTime?: string;
  reason?: string;
}) {
  return apiPost<{ success: boolean; blockedDate: Record<string, unknown> }>('/api/provider/blocked-dates', payload);
}

export async function deleteProviderBlockedDate(id: string) {
  return apiDelete<{ success: boolean }>(`/api/provider/blocked-dates/${id}`);
}

export async function getProviderReviews(query?: { page?: number; pageSize?: number; rating?: number }) {
  return apiGet<Record<string, unknown>>('/api/provider/reviews', query);
}

export async function respondProviderReview(reviewId: string, responseText: string) {
  return apiPatch<{ success: boolean; review: Record<string, unknown> }>(
    `/api/provider/reviews/${reviewId}/respond`,
    { responseText },
  );
}

export async function patchProviderProfile(payload: {
  bio?: string | null;
  years_of_experience?: number | null;
  phone_number?: string | null;
  email?: string | null;
  service_radius_km?: number | null;
}) {
  return apiPatch<{ success: boolean; provider: Record<string, unknown> }>('/api/provider/profile', payload);
}

export async function patchProviderDetails(payload: {
  professionalDetails?: Record<string, unknown>;
  clinicDetails?: Record<string, unknown>;
}) {
  return apiPatch<{ success: boolean } & Record<string, unknown>>('/api/provider/details', payload);
}

export async function getProviderDocuments() {
  return apiGet<{ documents: Array<Record<string, unknown>> }>('/api/provider/documents');
}

export async function createProviderDocument(payload: {
  document_type: string;
  document_url: string;
}) {
  return apiPost<{ success: boolean; document: Record<string, unknown> }>('/api/provider/documents', payload);
}

export async function submitProviderApplication(payload: ProviderApplicationPayload) {
  return apiPost<{ success: boolean }>('/api/provider-applications', payload);
}
