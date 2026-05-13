import type { SupabaseClient } from '@supabase/supabase-js';
import { logAdminAction } from '@/lib/admin/audit';
import { toIndianE164 } from '@/lib/utils/india-phone';

type ExistingUserRole = 'user' | 'provider' | 'admin' | 'staff' | null;

type CustomerIntakeUserRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  roles?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type CustomerOwnerProfileSourceRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  gender?: string | null;
};

type CustomerOwnerProfileSeed = Omit<CustomerOwnerProfileSourceRow, 'id'>;

export type CustomerIntakeUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type CustomerIntakeResult = {
  user: CustomerIntakeUser;
  isNewUser: boolean;
  inviteSent: boolean;
};

export type CustomerDuplicateMode = 'error' | 'return-existing';

export class CustomerIntakeError extends Error {
  status: number;
  existingUser?: CustomerIntakeUser;

  constructor(message: string, status = 500, existingUser?: CustomerIntakeUser) {
    super(message);
    this.name = 'CustomerIntakeError';
    this.status = status;
    this.existingUser = existingUser;
  }
}

type CreateCustomerInput = {
  actorUserId: string;
  name: string;
  phone: string;
  email?: string;
  noEmailInvite?: boolean;
  duplicateMode?: CustomerDuplicateMode;
  auditSource?: string;
  request?: Request;
};

function normalizeRoleName(value: unknown): ExistingUserRole {
  return value === 'user' || value === 'provider' || value === 'admin' || value === 'staff' ? value : null;
}

function normalizeExistingUser(row: CustomerIntakeUserRow | null | undefined) {
  if (!row?.id) {
    return null;
  }

  const roleRow = Array.isArray(row.roles) ? row.roles[0] : row.roles;
  const role = normalizeRoleName(roleRow?.name);

  return {
    user: {
      id: row.id,
      name: row.name ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
    },
    role,
  };
}

function isPrivilegedRole(role: ExistingUserRole) {
  return role === 'admin' || role === 'staff' || role === 'provider';
}

function firstTrimmedString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return '';
}

function normalizeOwnerProfileGender(value: string | null | undefined) {
  return value === 'male' || value === 'female' || value === 'other' ? value : null;
}

function resolveOwnerProfileName(seed: CustomerOwnerProfileSeed, userRow: CustomerOwnerProfileSourceRow | null) {
  const explicitName = firstTrimmedString(seed.name, userRow?.name);
  if (explicitName) {
    return explicitName;
  }

  const email = firstTrimmedString(seed.email, userRow?.email);
  const emailName = email.split('@')[0]?.trim();

  return emailName || 'Pet Owner';
}

export async function ensureOwnerProfileForBookingCustomer(
  adminClient: SupabaseClient,
  userId: string,
  seed: CustomerOwnerProfileSeed = {},
) {
  const { data: existingOwnerProfile, error: existingOwnerProfileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle<{ id: string }>();

  if (existingOwnerProfileError) {
    throw new CustomerIntakeError('Unable to verify customer profile right now.', 500);
  }

  if (existingOwnerProfile) {
    return;
  }

  let userRow: CustomerOwnerProfileSourceRow | null = null;

  if (!firstTrimmedString(seed.name) || !firstTrimmedString(seed.phone)) {
    const { data, error } = await adminClient
      .from('users')
      .select('id, name, email, phone, photo_url, gender')
      .eq('id', userId)
      .maybeSingle<CustomerOwnerProfileSourceRow>();

    if (error) {
      throw new CustomerIntakeError('Unable to load customer profile details right now.', 500);
    }

    userRow = data ?? null;
  }

  const rawPhone = firstTrimmedString(seed.phone, userRow?.phone);
  const normalizedPhone = rawPhone ? toIndianE164(rawPhone) : '';

  if (!normalizedPhone) {
    throw new CustomerIntakeError('Customer profile is missing a valid phone number. Add the phone number before saving an address.', 409);
  }

  const { error: ownerProfileUpsertError } = await adminClient.from('profiles').upsert(
    {
      id: userId,
      full_name: resolveOwnerProfileName(seed, userRow),
      phone_number: normalizedPhone,
      profile_photo_url: firstTrimmedString(seed.photo_url, userRow?.photo_url) || null,
      gender: normalizeOwnerProfileGender(seed.gender ?? userRow?.gender),
    },
    { onConflict: 'id' },
  );

  if (ownerProfileUpsertError) {
    throw new CustomerIntakeError('Unable to prepare customer profile for address save.', 500);
  }
}

export function toFriendlyCreateUserError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('already') || normalized.includes('exists')) {
    return { status: 409, error: 'A user with this email or phone already exists.' };
  }

  if (normalized.includes('email')) {
    return { status: 409, error: 'This email is already registered.' };
  }

  if (normalized.includes('phone')) {
    return { status: 409, error: 'This phone number is already in use.' };
  }

  return { status: 500, error: 'Unable to create user right now.' };
}

export async function createCustomerProfileForBooking(
  adminClient: SupabaseClient,
  input: CreateCustomerInput,
): Promise<CustomerIntakeResult> {
  const name = input.name.trim();
  const email = input.email?.trim().toLowerCase() ?? '';
  const createPhoneOnlyProfile = Boolean(input.noEmailInvite) || !email;
  const normalizedPhone = toIndianE164(input.phone);
  const duplicateMode = input.duplicateMode ?? 'error';

  if (!normalizedPhone) {
    throw new CustomerIntakeError('Enter a valid Indian phone number.', 400);
  }

  if (!createPhoneOnlyProfile && !email) {
    throw new CustomerIntakeError('Email is required unless no-email profile is selected.', 400);
  }

  const [emailProbe, phoneProbe] = await Promise.all([
    createPhoneOnlyProfile
      ? Promise.resolve({ data: null, error: null })
      : adminClient
          .from('users')
          .select('id, name, email, phone, roles(name)')
          .ilike('email', email)
          .limit(1)
          .maybeSingle<CustomerIntakeUserRow>(),
    adminClient
      .from('users')
      .select('id, name, email, phone, roles(name)')
      .eq('phone', normalizedPhone)
      .limit(1)
      .maybeSingle<CustomerIntakeUserRow>(),
  ]);

  if (emailProbe.error || phoneProbe.error) {
    throw new CustomerIntakeError('Unable to verify duplicates right now.', 500);
  }

  const existingByEmail = normalizeExistingUser(emailProbe.data);
  const existingByPhone = normalizeExistingUser(phoneProbe.data);

  if (existingByEmail && existingByPhone && existingByEmail.user.id !== existingByPhone.user.id) {
    throw new CustomerIntakeError('Email and phone belong to different existing customers.', 409);
  }

  const existing = existingByPhone ?? existingByEmail;
  if (existing) {
    if (isPrivilegedRole(existing.role)) {
      throw new CustomerIntakeError('These details are registered to a staff or provider account.', 409);
    }

    if (duplicateMode === 'return-existing') {
      await ensureOwnerProfileForBookingCustomer(adminClient, existing.user.id, {
        name: existing.user.name,
        email: existing.user.email,
        phone: existing.user.phone,
      });

      return {
        user: existing.user,
        isNewUser: false,
        inviteSent: false,
      };
    }

    const message = existingByPhone ? 'This phone number is already in use.' : 'This email is already registered.';
    throw new CustomerIntakeError(message, 409, existing.user);
  }

  const { data: userRole, error: roleError } = await adminClient.from('roles').select('id').eq('name', 'user').single();

  if (roleError || !userRole) {
    throw new CustomerIntakeError('User role is not configured.', 500);
  }

  let authUserId: string | null = null;

  if (createPhoneOnlyProfile) {
    const { data: createdAuthUser, error: createAuthError } = await adminClient.auth.admin.createUser({
      phone: normalizedPhone,
      phone_confirm: true,
      user_metadata: {
        name,
        onboarding_role: 'user',
      },
    });

    if (createAuthError || !createdAuthUser.user) {
      const mapped = toFriendlyCreateUserError(createAuthError?.message ?? 'User creation failed');
      throw new CustomerIntakeError(mapped.error, mapped.status);
    }

    authUserId = createdAuthUser.user.id;
  } else {
    const inviteRedirectTo = new URL('/auth/callback?next=/dashboard/user', input.request?.url ?? 'http://localhost').toString();

    const { data: inviteResult, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        name,
        phone: normalizedPhone,
        onboarding_role: 'user',
      },
      redirectTo: inviteRedirectTo,
    });

    if (inviteError || !inviteResult.user) {
      const mapped = toFriendlyCreateUserError(inviteError?.message ?? 'Invite failed');
      throw new CustomerIntakeError(mapped.error, mapped.status);
    }

    authUserId = inviteResult.user.id;
  }

  const { error: profileInsertError } = await adminClient.from('users').insert({
    id: authUserId,
    name,
    email: createPhoneOnlyProfile ? null : email,
    phone: normalizedPhone,
    role_id: userRole.id,
  });

  if (profileInsertError) {
    if (authUserId) {
      await adminClient.auth.admin.deleteUser(authUserId);
    }
    const mapped = toFriendlyCreateUserError(profileInsertError.message);
    throw new CustomerIntakeError(mapped.error, mapped.status);
  }

  try {
    await ensureOwnerProfileForBookingCustomer(adminClient, authUserId, {
      name,
      email: createPhoneOnlyProfile ? null : email,
      phone: normalizedPhone,
    });
  } catch (error) {
    if (authUserId) {
      await adminClient.auth.admin.deleteUser(authUserId);
    }

    throw error;
  }

  void logAdminAction({
    adminUserId: input.actorUserId,
    action: 'user.created',
    entityType: 'user',
    entityId: authUserId ?? 'unknown',
    newValue: { name, phone: normalizedPhone, email: createPhoneOnlyProfile ? null : email },
    metadata: { inviteSent: !createPhoneOnlyProfile, source: input.auditSource ?? 'admin_panel' },
    request: input.request,
  });

  return {
    user: {
      id: authUserId,
      name,
      email: createPhoneOnlyProfile ? null : email,
      phone: normalizedPhone,
    },
    isNewUser: true,
    inviteSent: !createPhoneOnlyProfile,
  };
}