// Shared types and constants for the provider dashboard subcomponents

export const WEEK_DAYS = [
  { label: 'Sunday', day: 0 },
  { label: 'Monday', day: 1 },
  { label: 'Tuesday', day: 2 },
  { label: 'Wednesday', day: 3 },
  { label: 'Thursday', day: 4 },
  { label: 'Friday', day: 5 },
  { label: 'Saturday', day: 6 },
] as const;

export const EMPTY_VALUE = 'Not provided';
export const PREMIUM_MODAL_FOOTER_CLASS =
  'sticky bottom-0 z-10 border-t border-neutral-200/80 bg-white/95 pt-4 backdrop-blur';

export type ReviewsPageResponse = {
  reviews: import('@/lib/provider-management/types').ProviderReview[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type ProviderBooking = {
  id: number;
  user_id: string;
  pet_id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_mode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  service_type: string | null;
  location_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  owner_full_name?: string | null;
  owner_photo_url?: string | null;
  owner_phone?: string | null;
  pet_name?: string | null;
  pet_photo_url?: string | null;
  provider_notes: string | null;
  payment_mode?: 'direct_to_provider' | 'platform' | 'mixed' | null;
  price_at_booking?: number | null;
  wallet_credits_applied_inr?: number | null;
  cash_collected?: boolean;
  completion_task_status?: 'pending' | 'completed' | null;
  completion_due_at?: string | null;
  completion_completed_at?: string | null;
  completion_feedback_text?: string | null;
  requires_completion_feedback?: boolean;
  has_customer_feedback?: boolean;
  provider_customer_rating?: number | null;
  provider_customer_notes?: string | null;
};

export type ProviderBlockedDate = {
  id: string;
  provider_id: number;
  blocked_date: string;
  block_start_time: string | null;
  block_end_time: string | null;
  reason: string | null;
  created_at: string;
};

export type ProviderDashboardView = 'overview' | 'operations' | 'profile';

export type ProfileFormState = {
  bio: string;
  profile_photo_url: string;
  years_of_experience: string;
  phone_number: string;
  email: string;
  service_radius_km: string;
};

export type DetailsFormState = {
  license_number: string;
  specialization: string;
  teleconsult_enabled: boolean;
  emergency_service_enabled: boolean;
  equipment_details: string;
  insurance_document_url: string;
  registration_number: string;
  gst_number: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  number_of_doctors: string;
  hospitalization_available: boolean;
  emergency_services_available: boolean;
};

export type NewBlockedDateState = {
  blockedDate: string;
  blockStartTime: string;
  blockEndTime: string;
  reason: string;
};

export type NewAvailabilityState = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

export type AvailabilityDraftState = Record<
  string,
  { day_of_week: number; start_time: string; end_time: string; is_available: boolean }
>;

export type DocumentDraftState = Record<string, { document_type: string; document_url: string }>;

export type ResponseHistoryEntry = {
  id: string;
  created_at: string;
  previous_response: string | null;
  new_response: string;
};

export type PerformanceSummary = {
  avgRating: number;
  totalBookings: number;
  cancellationRate: number;
  noShowCount: number;
  performanceScore: number;
  rankingScore: number;
  accountStatus: import('@/lib/provider-management/types').ProviderAccountStatus;
};

export type BookingInsights = {
  active: number;
  pending: number;
  confirmed: number;
  completed: number;
  noShow: number;
  hourBuckets: Record<string, number>;
};

export type ProviderAlert = {
  level: 'info' | 'warning' | 'critical';
  message: string;
};
