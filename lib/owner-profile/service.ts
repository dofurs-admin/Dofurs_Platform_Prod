import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AddAddressInput,
  AddEmergencyContactInput,
  OwnerProfile,
  OwnerProfileAggregate,
  UpdateAddressInput,
  UpdateEmergencyContactInput,
  UpdateProfileInput,
  UpdateReputationMetricsInput,
  UpdateVerificationStatusInput,
  UpsertPreferencesInput,
  UserAddress,
  UserEmergencyContact,
  UserPreferences,
} from './types';

type OwnerProfileSupabaseClient = SupabaseClient;

const PROFILE_SELECT = '*';
const ADDRESS_SELECT = 'id, user_id, label, address_line_1, address_line_2, city, state, pincode, country, latitude, longitude, phone, is_default, created_at, updated_at';
const EMERGENCY_CONTACT_SELECT = '*';
const PREFERENCES_SELECT = '*';

export async function getProfile(supabase: OwnerProfileSupabaseClient, userId: string) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).maybeSingle<OwnerProfile>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProfile(supabase: OwnerProfileSupabaseClient, userId: string, input: UpdateProfileInput) {
  const { data, error } = await supabase
    .from('profiles')
    .update(input)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single<OwnerProfile>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateVerificationStatus(
  supabase: OwnerProfileSupabaseClient,
  userId: string,
  input: UpdateVerificationStatusInput,
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(input)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single<OwnerProfile>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateReputationMetrics(
  supabase: OwnerProfileSupabaseClient,
  userId: string,
  input: UpdateReputationMetricsInput,
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(input)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single<OwnerProfile>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getUserAddresses(supabase: OwnerProfileSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('user_addresses')
    .select(ADDRESS_SELECT)
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as UserAddress[];
}

async function ensureSingleDefaultAddress(supabase: OwnerProfileSupabaseClient, userId: string, activeAddressId: string) {
  const { error } = await supabase
    .from('user_addresses')
    .update({ is_default: false })
    .eq('user_id', userId)
    .neq('id', activeAddressId)
    .eq('is_default', true);

  if (error) {
    throw error;
  }
}

export async function addAddress(supabase: OwnerProfileSupabaseClient, userId: string, input: AddAddressInput) {
  const { data: existingAddresses, error: existingAddressesError } = await supabase
    .from('user_addresses')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (existingAddressesError) {
    throw existingAddressesError;
  }

  const shouldBeDefault = input.is_default || (existingAddresses?.length ?? 0) === 0;

  const { data, error } = await supabase
    .from('user_addresses')
    .insert({
      ...input,
      user_id: userId,
      is_default: shouldBeDefault,
    })
    .select(ADDRESS_SELECT)
    .single<UserAddress>();

  if (error) {
    throw error;
  }

  if (data.is_default) {
    await ensureSingleDefaultAddress(supabase, userId, data.id);
  }

  return data;
}

export async function updateAddress(
  supabase: OwnerProfileSupabaseClient,
  userId: string,
  addressId: string,
  input: UpdateAddressInput,
) {
  const { data, error } = await supabase
    .from('user_addresses')
    .update(input)
    .eq('id', addressId)
    .eq('user_id', userId)
    .select(ADDRESS_SELECT)
    .single<UserAddress>();

  if (error) {
    throw error;
  }

  if (data.is_default) {
    await ensureSingleDefaultAddress(supabase, userId, data.id);
  }

  return data;
}

export async function deleteAddress(supabase: OwnerProfileSupabaseClient, userId: string, addressId: string) {
  const { data: address, error: addressError } = await supabase
    .from('user_addresses')
    .select('id, is_default')
    .eq('id', addressId)
    .eq('user_id', userId)
    .maybeSingle<{ id: string; is_default: boolean }>();

  if (addressError) {
    throw addressError;
  }

  if (!address) {
    return;
  }

  const { error } = await supabase.from('user_addresses').delete().eq('id', addressId).eq('user_id', userId);

  if (error) {
    throw error;
  }

  if (address.is_default) {
    const { data: nextAddress, error: nextAddressError } = await supabase
      .from('user_addresses')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (nextAddressError) {
      throw nextAddressError;
    }

    if (nextAddress) {
      await updateAddress(supabase, userId, nextAddress.id, { is_default: true });
    }
  }
}

async function ensureSinglePrimaryContact(
  supabase: OwnerProfileSupabaseClient,
  userId: string,
  activeContactId: string,
) {
  const { error } = await supabase
    .from('user_emergency_contacts')
    .update({ is_primary: false })
    .eq('user_id', userId)
    .neq('id', activeContactId)
    .eq('is_primary', true);

  if (error) {
    throw error;
  }
}

export async function addEmergencyContact(
  supabase: OwnerProfileSupabaseClient,
  userId: string,
  input: AddEmergencyContactInput,
) {
  const { data: existingContacts, error: existingContactsError } = await supabase
    .from('user_emergency_contacts')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (existingContactsError) {
    throw existingContactsError;
  }

  const shouldBePrimary = input.is_primary || (existingContacts?.length ?? 0) === 0;

  const { data, error } = await supabase
    .from('user_emergency_contacts')
    .insert({
      ...input,
      user_id: userId,
      is_primary: shouldBePrimary,
    })
    .select(EMERGENCY_CONTACT_SELECT)
    .single<UserEmergencyContact>();

  if (error) {
    throw error;
  }

  if (data.is_primary) {
    await ensureSinglePrimaryContact(supabase, userId, data.id);
  }

  return data;
}

export async function updateEmergencyContact(
  supabase: OwnerProfileSupabaseClient,
  userId: string,
  contactId: string,
  input: UpdateEmergencyContactInput,
) {
  const { data, error } = await supabase
    .from('user_emergency_contacts')
    .update(input)
    .eq('id', contactId)
    .eq('user_id', userId)
    .select(EMERGENCY_CONTACT_SELECT)
    .single<UserEmergencyContact>();

  if (error) {
    throw error;
  }

  if (data.is_primary) {
    await ensureSinglePrimaryContact(supabase, userId, data.id);
  }

  return data;
}

export async function deleteEmergencyContact(supabase: OwnerProfileSupabaseClient, userId: string, contactId: string) {
  const { data: contact, error: contactError } = await supabase
    .from('user_emergency_contacts')
    .select('id, is_primary')
    .eq('id', contactId)
    .eq('user_id', userId)
    .maybeSingle<{ id: string; is_primary: boolean }>();

  if (contactError) {
    throw contactError;
  }

  if (!contact) {
    return;
  }

  const { error } = await supabase.from('user_emergency_contacts').delete().eq('id', contactId).eq('user_id', userId);

  if (error) {
    throw error;
  }

  if (contact.is_primary) {
    const { data: nextContact, error: nextContactError } = await supabase
      .from('user_emergency_contacts')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (nextContactError) {
      throw nextContactError;
    }

    if (nextContact) {
      await updateEmergencyContact(supabase, userId, nextContact.id, { is_primary: true });
    }
  }
}

export async function getPreferences(supabase: OwnerProfileSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select(PREFERENCES_SELECT)
    .eq('user_id', userId)
    .maybeSingle<UserPreferences>();

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertPreferences(
  supabase: OwnerProfileSupabaseClient,
  userId: string,
  input: UpsertPreferencesInput,
) {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        ...input,
        user_id: userId,
      },
      { onConflict: 'user_id' },
    )
    .select(PREFERENCES_SELECT)
    .single<UserPreferences>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getOwnerProfileAggregate(
  supabase: OwnerProfileSupabaseClient,
  userId: string,
): Promise<OwnerProfileAggregate | null> {
  const [profile, addresses, preferences, contacts] = await Promise.all([
    getProfile(supabase, userId),
    getUserAddresses(supabase, userId),
    getPreferences(supabase, userId),
    getEmergencyContacts(supabase, userId),
  ]);

  if (!profile) {
    return null;
  }

  return {
    profile,
    addresses,
    preferences,
    emergencyContacts: contacts,
  };
}

export async function getEmergencyContacts(supabase: OwnerProfileSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('user_emergency_contacts')
    .select(EMERGENCY_CONTACT_SELECT)
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as UserEmergencyContact[];
}
