export const KYC_STATUSES = ['not_submitted', 'pending', 'verified', 'rejected'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const ACCOUNT_STATUSES = ['active', 'flagged', 'banned'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ADDRESS_LABELS = ['Home', 'Office', 'Other'] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export const COMMUNICATION_PREFERENCES = ['call', 'whatsapp', 'app'] as const;
export type CommunicationPreference = (typeof COMMUNICATION_PREFERENCES)[number];

export type OwnerProfile = {
  id: string;
  full_name: string;
  phone_number: string;
  profile_photo_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  total_pets: number;
  first_pet_owner: boolean;
  years_of_pet_experience: number | null;
  cancellation_rate: number;
  late_cancellation_count: number;
  no_show_count: number;
  average_rating: number;
  total_bookings: number;
  flagged_count: number;
  is_suspended: boolean;
  is_phone_verified: boolean;
  is_email_verified: boolean;
  kyc_status: KycStatus;
  government_id_type: string | null;
  id_document_url: string | null;
  lives_in: string | null;
  has_other_pets: boolean;
  number_of_people_in_house: number | null;
  has_children: boolean;
  account_status: AccountStatus;
  risk_score: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserAddress = {
  id: string;
  user_id: string;
  label: AddressLabel | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type UserEmergencyContact = {
  id: string;
  user_id: string;
  contact_name: string;
  relationship: string | null;
  phone_number: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type UserPreferences = {
  id: string;
  user_id: string;
  preferred_service_time: string | null;
  preferred_groomer_gender: string | null;
  communication_preference: CommunicationPreference | null;
  special_instructions: string | null;
  preferred_payment_method?: 'razorpay' | 'upi' | 'card' | 'netbanking' | 'wallet' | 'cash' | null;
  preferred_upi_vpa?: string | null;
  billing_email?: string | null;
  created_at: string;
  updated_at: string;
};

export type UpdateProfileInput = Partial<
  Pick<
    OwnerProfile,
    | 'full_name'
    | 'phone_number'
    | 'profile_photo_url'
    | 'date_of_birth'
    | 'gender'
    | 'total_pets'
    | 'first_pet_owner'
    | 'years_of_pet_experience'
    | 'lives_in'
    | 'has_other_pets'
    | 'number_of_people_in_house'
    | 'has_children'
    | 'last_login_at'
  >
>;

export type UpdateVerificationStatusInput = Partial<
  Pick<OwnerProfile, 'is_phone_verified' | 'is_email_verified' | 'kyc_status' | 'government_id_type' | 'id_document_url'>
>;

export type UpdateReputationMetricsInput = Partial<
  Pick<
    OwnerProfile,
    | 'cancellation_rate'
    | 'late_cancellation_count'
    | 'no_show_count'
    | 'average_rating'
    | 'total_bookings'
    | 'flagged_count'
    | 'is_suspended'
    | 'account_status'
    | 'risk_score'
  >
>;

export type AddAddressInput = {
  label?: AddressLabel | null;
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

export type UpdateAddressInput = Partial<AddAddressInput>;

export type AddEmergencyContactInput = {
  contact_name: string;
  relationship?: string | null;
  phone_number: string;
  is_primary?: boolean;
};

export type UpdateEmergencyContactInput = Partial<AddEmergencyContactInput>;

export type UpsertPreferencesInput = {
  preferred_service_time?: string | null;
  preferred_groomer_gender?: string | null;
  communication_preference?: CommunicationPreference | null;
  special_instructions?: string | null;
  preferred_payment_method?: 'razorpay' | 'upi' | 'card' | 'netbanking' | 'wallet' | 'cash' | null;
  preferred_upi_vpa?: string | null;
  billing_email?: string | null;
};

export type OwnerProfileAggregate = {
  profile: OwnerProfile;
  addresses: UserAddress[];
  emergencyContacts: UserEmergencyContact[];
  preferences: UserPreferences | null;
};
