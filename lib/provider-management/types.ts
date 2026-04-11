export const PROVIDER_TYPES = [
  'groomer',
  'veterinarian',
  'clinic',
  'trainer',
  'walker',
  'sitter',
  'boarding_center',
  'ambulance',
  'retailer',
] as const;

export type PresetProviderType = (typeof PROVIDER_TYPES)[number];
export type ProviderType = PresetProviderType | (string & {});

export type ProviderVerificationStatus = 'pending' | 'approved' | 'rejected';
export type ProviderAccountStatus = 'active' | 'suspended' | 'banned';
export type DocumentVerificationStatus = 'pending' | 'approved' | 'rejected';

export type Provider = {
  id: number;
  user_id: string | null;
  provider_type: ProviderType;
  is_individual: boolean;
  business_name: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  years_of_experience: number | null;
  phone_number: string | null;
  email: string | null;
  service_radius_km: number | null;
  is_verified: boolean;
  verification_status: ProviderVerificationStatus;
  background_verified: boolean;
  admin_approval_status: ProviderVerificationStatus;
  account_status: ProviderAccountStatus;
  average_rating: number;
  total_bookings: number;
  performance_score: number;
  cancellation_rate: number;
  no_show_count: number;
  ranking_score: number;
  accepts_platform_payment: boolean;
  payout_method_type: string | null;
  payout_details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ProviderProfessionalDetails = {
  id: string;
  provider_id: number;
  license_number: string | null;
  specialization: string | null;
  teleconsult_enabled: boolean;
  emergency_service_enabled: boolean;
  equipment_details: string | null;
  insurance_document_url: string | null;
  license_verified: boolean;
  created_at: string;
};

export type ProviderClinicDetails = {
  id: string;
  provider_id: number;
  registration_number: string | null;
  gst_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  operating_hours: Record<string, unknown> | null;
  number_of_doctors: number | null;
  hospitalization_available: boolean;
  emergency_services_available: boolean;
  registration_verified: boolean;
  created_at: string;
};

export type ProviderService = {
  id: string;
  provider_id: number;
  service_type: string;
  base_price: number;
  surge_price: number | null;
  commission_percentage: number | null;
  service_duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  service_pincodes?: string[];
};

export type ProviderAvailability = {
  id: string;
  provider_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  slot_duration_minutes?: number;
  buffer_time_minutes?: number;
  set_by: 'provider' | 'admin';
  admin_locked: boolean;
  created_at: string;
};

export type ProviderDocument = {
  id: string;
  provider_id: number;
  document_type: string | null;
  document_url: string | null;
  verification_status: DocumentVerificationStatus;
  verified_at: string | null;
  created_at: string;
};

export type ProviderReview = {
  id: string;
  provider_id: number;
  booking_id: number | null;
  user_id: string | null;
  rating: number;
  review_text: string | null;
  provider_response: string | null;
  created_at: string;
};

export type CreateProviderInput = {
  provider_type: ProviderType;
  is_individual: boolean;
  address?: string | null;
  business_name?: string | null;
  profile_photo_url?: string | null;
  bio?: string | null;
  years_of_experience?: number | null;
  phone_number?: string | null;
  email?: string | null;
  service_radius_km?: number | null;
  professional_details?: {
    license_number?: string | null;
    specialization?: string | null;
    teleconsult_enabled?: boolean;
    emergency_service_enabled?: boolean;
    equipment_details?: string | null;
    insurance_document_url?: string | null;
    license_verified?: boolean;
  } | null;
  clinic_details?: {
    registration_number?: string | null;
    gst_number?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    operating_hours?: Record<string, unknown> | null;
    number_of_doctors?: number | null;
    hospitalization_available?: boolean;
    emergency_services_available?: boolean;
    registration_verified?: boolean;
  } | null;
};

export type UpdateProviderProfileInput = Partial<
  Pick<Provider, 'bio' | 'profile_photo_url' | 'years_of_experience' | 'phone_number' | 'email' | 'service_radius_km'>
>;

export type ProviderDashboard = {
  provider: Provider;
  professionalDetails: ProviderProfessionalDetails | null;
  clinicDetails: ProviderClinicDetails | null;
  availability: ProviderAvailability[];
  documents: ProviderDocument[];
  reviews: ProviderReview[];
  services: ProviderService[];
};

export type UpdateProviderPricingInput = Array<
  Pick<
    ProviderService,
    'service_type' | 'base_price' | 'surge_price' | 'commission_percentage' | 'service_duration_minutes' | 'is_active'
  > & {
    id?: string;
  }
>;

export type AdminProviderServiceRolloutInput = Array<
  Pick<ProviderService, 'service_type' | 'is_active'> & {
    id?: string;
    base_price?: number;
    surge_price?: number | null;
    commission_percentage?: number | null;
    service_duration_minutes?: number | null;
    service_pincodes?: string[];
  }
>;

export type AdminServiceModerationSummaryItem = {
  service_type: string;
  provider_count: number;
  active_count: number;
  inactive_count: number;
  average_base_price: number;
};

export type AdminServiceGlobalRolloutInput = {
  service_type: string;
  base_price: number;
  surge_price?: number | null;
  commission_percentage?: number | null;
  service_duration_minutes?: number | null;
  is_active?: boolean;
  service_pincodes?: string[];
  provider_types?: ProviderType[];
  provider_ids?: number[];
  overwrite_existing?: boolean;
};

export type AdminServiceGlobalToggleInput = {
  service_type: string;
  is_active: boolean;
};

export type DiscountType = 'percentage' | 'flat';

export type PlatformDiscount = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: DiscountType;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformDiscountAnalyticsItem = {
  discount_id: string;
  code: string;
  title: string;
  redemption_count: number;
  total_discount_amount: number;
};

export type PlatformDiscountAnalyticsSummary = {
  total_discounts: number;
  total_active_discounts: number;
  total_redemptions: number;
  total_discount_amount: number;
  total_bookings: number;
  booking_redemption_rate: number;
  top_discounts: PlatformDiscountAnalyticsItem[];
};

export type DiscountRedemption = {
  id: string;
  discount_id: string;
  booking_id: number | null;
  user_id: string | null;
  discount_amount: number;
  reversed_at: string | null;
  reversal_reason: string | null;
  created_at: string;
};

export type AdminUpsertDiscountInput = {
  id?: string;
  code: string;
  title: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_booking_amount?: number | null;
  applies_to_service_type?: string | null;
  valid_from: string;
  valid_until?: string | null;
  usage_limit_total?: number | null;
  usage_limit_per_user?: number | null;
  first_booking_only?: boolean;
  is_active?: boolean;
};

export type SetAvailabilityInput = Array<
  Pick<ProviderAvailability, 'day_of_week' | 'start_time' | 'end_time'> & {
    id?: string;
    is_available?: boolean;
    slot_duration_minutes?: number;
    buffer_time_minutes?: number;
    admin_locked?: boolean;
  }
>;

export type CreateProviderDocumentInput = Pick<ProviderDocument, 'document_type' | 'document_url'>;

export type UpdateProviderDocumentInput = Partial<Pick<ProviderDocument, 'document_type' | 'document_url'>>;

export type UpdateProviderProfessionalDetailsInput = Partial<
  Pick<
    ProviderProfessionalDetails,
    | 'license_number'
    | 'specialization'
    | 'teleconsult_enabled'
    | 'emergency_service_enabled'
    | 'equipment_details'
    | 'insurance_document_url'
  >
>;

export type UpdateProviderClinicDetailsInput = Partial<
  Pick<
    ProviderClinicDetails,
    | 'registration_number'
    | 'gst_number'
    | 'address'
    | 'city'
    | 'state'
    | 'pincode'
    | 'latitude'
    | 'longitude'
    | 'operating_hours'
    | 'number_of_doctors'
    | 'hospitalization_available'
    | 'emergency_services_available'
  >
>;

export type ProviderDetailsUpdateInput = {
  professionalDetails?: UpdateProviderProfessionalDetailsInput;
  clinicDetails?: UpdateProviderClinicDetailsInput;
};

export type AdminProviderLocationModeration = {
  provider_id: number;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  service_radius_km: number | null;
};

export type UpdateAdminProviderLocationInput = Partial<
  Pick<AdminProviderLocationModeration, 'address' | 'city' | 'state' | 'pincode' | 'latitude' | 'longitude' | 'service_radius_km'>
>;

export type UpdateAdminProviderProfileInput = {
  name?: string;
  email?: string | null;
  provider_type?: ProviderType;
  business_name?: string | null;
  profile_photo_url?: string | null;
  service_radius_km?: number | null;
  professional_details?: UpdateProviderProfessionalDetailsInput;
  clinic_details?: Pick<
    UpdateProviderClinicDetailsInput,
    | 'registration_number'
    | 'gst_number'
    | 'number_of_doctors'
    | 'hospitalization_available'
    | 'emergency_services_available'
  >;
};

export type ProviderReviewsQuery = {
  page?: number;
  pageSize?: number;
  rating?: number | null;
};

export type ProviderReviewsPage = {
  reviews: ProviderReview[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type AdminProviderModerationItem = {
  id: number;
  name: string;
  email: string | null;
  profile_photo_url: string | null;
  provider_type: ProviderType;
  business_name: string | null;
  admin_approval_status: ProviderVerificationStatus;
  verification_status: ProviderVerificationStatus;
  account_status: ProviderAccountStatus;
  average_rating: number;
  total_bookings: number;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  service_radius_km: number | null;
  created_at: string;
  updated_at: string;
  documentCounts: {
    pending: number;
    approved: number;
    rejected: number;
  };
  professional_details: Pick<
    ProviderProfessionalDetails,
    | 'license_number'
    | 'specialization'
    | 'teleconsult_enabled'
    | 'emergency_service_enabled'
    | 'equipment_details'
    | 'insurance_document_url'
  > | null;
  clinic_details: Pick<
    ProviderClinicDetails,
    | 'registration_number'
    | 'gst_number'
    | 'number_of_doctors'
    | 'hospitalization_available'
    | 'emergency_services_available'
  > | null;
};
