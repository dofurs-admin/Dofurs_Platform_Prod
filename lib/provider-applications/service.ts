import type { SupabaseClient } from '@supabase/supabase-js';
import { getISTTimestamp } from '@/lib/utils/date';
import type {
  CreateServiceProviderApplicationInput,
  ServiceProviderApplication,
  UpdateServiceProviderApplicationStatusInput,
} from './types';

const SERVICE_PROVIDER_APPLICATION_COLUMNS =
  'id, submitted_by_user_id, partner_category, business_name, team_size, full_name, email, phone_number, city, state, provider_type, years_of_experience, service_modes, service_areas, portfolio_url, motivation, status, admin_notes, reviewed_by, reviewed_at, created_at, updated_at';

export async function createServiceProviderApplication(
  supabase: SupabaseClient,
  input: CreateServiceProviderApplicationInput,
): Promise<void> {
  const payload = {
    ...input,
    service_modes: input.service_modes,
    portfolio_url: input.portfolio_url ?? null,
    motivation: input.motivation ?? null,
  };

  const { error } = await supabase.from('service_provider_applications').insert(payload);

  if (error) {
    throw error;
  }
}

export async function listServiceProviderApplications(
  supabase: SupabaseClient,
): Promise<ServiceProviderApplication[]> {
  const { data, error } = await supabase
    .from('service_provider_applications')
    .select(SERVICE_PROVIDER_APPLICATION_COLUMNS)
    .order('created_at', { ascending: false })
    .returns<ServiceProviderApplication[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function updateServiceProviderApplicationStatus(
  supabase: SupabaseClient,
  id: string,
  input: UpdateServiceProviderApplicationStatusInput,
): Promise<ServiceProviderApplication> {
  const { data, error } = await supabase
    .from('service_provider_applications')
    .update({
      status: input.status,
      admin_notes: input.admin_notes ?? null,
      reviewed_by: input.reviewed_by ?? null,
      reviewed_at: getISTTimestamp(),
    })
    .eq('id', id)
    .select(SERVICE_PROVIDER_APPLICATION_COLUMNS)
    .single<ServiceProviderApplication>();

  if (error) {
    throw error;
  }

  return data;
}
