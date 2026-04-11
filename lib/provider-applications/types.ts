export type ServiceProviderApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export type ServiceProviderApplication = {
  id: string;
  submitted_by_user_id: string | null;
  partner_category: 'individual' | 'business';
  business_name: string | null;
  team_size: number | null;
  full_name: string;
  email: string;
  phone_number: string;
  city: string;
  state: string;
  provider_type: string;
  years_of_experience: number;
  service_modes: string[];
  service_areas: string;
  portfolio_url: string | null;
  motivation: string | null;
  status: ServiceProviderApplicationStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateServiceProviderApplicationInput = {
  submitted_by_user_id?: string | null;
  partner_category: 'individual' | 'business';
  business_name?: string | null;
  team_size?: number | null;
  full_name: string;
  email: string;
  phone_number: string;
  city: string;
  state: string;
  provider_type: string;
  years_of_experience: number;
  service_modes: string[];
  service_areas: string;
  portfolio_url?: string | null;
  motivation?: string | null;
};

export type UpdateServiceProviderApplicationStatusInput = {
  status: ServiceProviderApplicationStatus;
  admin_notes?: string | null;
  reviewed_by?: string | null;
};
