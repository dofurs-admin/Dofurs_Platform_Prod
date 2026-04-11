import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { createProvider } from '@/lib/provider-management/service';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { PROVIDER_TYPES } from '@/lib/provider-management/types';
import { isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';
import type { CreateProviderInput, ProviderType } from '@/lib/provider-management/types';
import type { Json } from '@/lib/supabase/database.types';

const EMPTY_TO_UNDEFINED = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const ONBOARDING_FIELD_LABELS: Record<string, string> = {
  name: 'Provider name',
  email: 'Email address',
  phone: 'Phone number',
  provider_type: 'Provider type',
  custom_provider_type: 'Custom provider type',
  business_name: 'Business name',
  business_registration_number: 'Business registration number',
  address: 'Address',
  city: 'City',
  state: 'State',
  pincode: 'Pincode',
  latitude: 'Latitude',
  longitude: 'Longitude',
  service_radius_km: 'Service radius',
  specialization: 'Specialization',
  years_of_experience: 'Years of experience',
  qualification: 'Qualification',
  compensation_type: 'Compensation type',
  salary_amount: 'Salary amount',
  commission_percentage: 'Commission percentage',
  service_pincodes: 'Service pincodes',
};

function toFriendlyValidationErrorMap(flattened: z.ZodFlattenedError<unknown>) {
  const fieldErrors = flattened.fieldErrors as Record<string, string[] | undefined>;
  const entries = Object.entries(fieldErrors).filter(
    ([, messages]) => Array.isArray(messages) && messages.length > 0,
  );

  const friendly = Object.fromEntries(
    entries.map(([field, messages]) => {
      const label = ONBOARDING_FIELD_LABELS[field] ?? field;
      const firstMessage = (messages?.[0] ?? 'Invalid value').toString();
      return [field, `${label}: ${firstMessage}`];
    }),
  );

  return friendly;
}

const providerOnboardingSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-zA-Z0-9\s.'&()\-/]+$/, "Name can only include letters, numbers, spaces, and common punctuation"),
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
    phone: z.string().trim().min(10).max(20),
    profile_photo_url: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(2000).optional()),
    provider_type: z.union([z.enum(PROVIDER_TYPES), z.literal('other')]),
    custom_provider_type: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(64).optional()),
    business_name: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(255).optional()),
    business_registration_number: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(120).optional()),
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().min(2).max(120),
    state: z.string().trim().min(2).max(120),
    pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Pincode must be a valid 6-digit Indian pincode'),
    latitude: z.preprocess(EMPTY_TO_UNDEFINED, z.coerce.number().min(-90).max(90).optional()),
    longitude: z.preprocess(EMPTY_TO_UNDEFINED, z.coerce.number().min(-180).max(180).optional()),
    service_radius_km: z.preprocess(EMPTY_TO_UNDEFINED, z.coerce.number().min(0).max(500).optional()),
    specialization: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(255).optional()),
    years_of_experience: z.coerce.number().min(0).max(80),
    qualification: z.string().trim().min(2).max(255),
    compensation_type: z.enum(['salary', 'commission', 'both']),
    salary_amount: z.preprocess(EMPTY_TO_UNDEFINED, z.coerce.number().positive().optional()),
    commission_percentage: z.preprocess(EMPTY_TO_UNDEFINED, z.coerce.number().min(0).max(100).optional()),
    service_pincodes: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(1000).optional()),
  })
  .superRefine((payload, context) => {
    if (!isValidIndianE164(toIndianE164(payload.phone))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Enter a valid 10-digit Indian mobile number',
      });
    }

    if (payload.provider_type === 'other' && !payload.custom_provider_type?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['custom_provider_type'],
        message: 'Please specify a custom provider type',
      });
    }

    if ((payload.provider_type === 'veterinarian' || payload.provider_type === 'groomer') && !payload.service_pincodes?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['service_pincodes'],
        message: 'Service pincodes are required for home visit providers',
      });
    }

    if (payload.service_pincodes?.trim()) {
      const invalidPincodes = payload.service_pincodes
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .filter((item) => !/^[1-9]\d{5}$/.test(item));

      if (invalidPincodes.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['service_pincodes'],
          message: 'Use comma-separated valid 6-digit Indian pincodes',
        });
      }
    }

    if ((payload.compensation_type === 'salary' || payload.compensation_type === 'both') && !payload.salary_amount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['salary_amount'],
        message: 'Salary amount is required for salary-based compensation',
      });
    }

    if (
      (payload.compensation_type === 'commission' || payload.compensation_type === 'both') &&
      payload.commission_percentage == null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['commission_percentage'],
        message: 'Commission percentage is required for commission-based compensation',
      });
    }
  });

type ProviderOnboardingPayload = z.infer<typeof providerOnboardingSchema>;

const PROVIDER_ONBOARD_IDEMPOTENCY_ENDPOINT = 'admin/providers/onboard';

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const candidates = [record.message, record.error_description, record.error, record.details, record.hint];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
  }

  return 'Failed to create provider record';
}

function getProviderCreationFriendlyMessage(rawMessage: string) {
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('provider_type_enum') ||
    normalized.includes('invalid input value for enum') ||
    normalized.includes('providers_provider_type_check')
  ) {
    return 'Selected provider type is not available in the current system setup. Please choose another type or contact support.';
  }

  if (normalized.includes('duplicate key') || normalized.includes('already exists')) {
    return 'A provider with these details already exists. Please verify email and phone and try again.';
  }

  return 'Unable to save provider profile right now. Please verify the details and try again.';
}

function getUserProfileCreationFriendlyMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const code = typeof record.code === 'string' ? record.code : '';
    const message = typeof record.message === 'string' ? record.message : '';

    if (code === '23505' && message.includes('users_phone_key')) {
      return 'A user with this phone number already exists. Use a different phone number or promote the existing account.';
    }

    if (code === '23505' && message.includes('users_email_key')) {
      return 'A user with this email already exists. Use promote instead of onboarding.';
    }
  }

  return 'Unable to create provider account profile. Please verify email and phone details and try again.';
}

function getJoinedRoleName(rolesRaw: unknown): string | null {
  if (Array.isArray(rolesRaw)) {
    const first = rolesRaw[0];
    if (first && typeof first === 'object' && 'name' in first && typeof first.name === 'string') {
      return first.name;
    }
    return null;
  }

  if (rolesRaw && typeof rolesRaw === 'object' && 'name' in rolesRaw && typeof rolesRaw.name === 'string') {
    return rolesRaw.name;
  }

  return null;
}

export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { role, user, supabase } = auth.context;

  try {
    const idempotencyKey = request.headers.get('x-idempotency-key')?.trim() ?? '';

    if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 120)) {
      return NextResponse.json(
        { error: 'x-idempotency-key must be between 8 and 120 characters when provided' },
        { status: 400 },
      );
    }

    const payloadCandidate = (await request.json().catch(() => null)) as unknown;
    const parsedPayload = providerOnboardingSchema.safeParse(payloadCandidate);

    if (!parsedPayload.success) {
      const flattened = parsedPayload.error.flatten();
      const validationErrors = toFriendlyValidationErrorMap(flattened);
      return NextResponse.json(
        {
          error: 'Please check the highlighted fields and try again.',
          validationErrors,
          details: flattened,
        },
        { status: 400 },
      );
    }

    const payload: ProviderOnboardingPayload = parsedPayload.data;
    const adminClient = getSupabaseAdminClient();

    if (idempotencyKey) {
      const { data: existingIdempotentResponse, error: idempotencyReadError } = await adminClient
        .from('admin_idempotency_keys')
        .select('status_code, response_body')
        .eq('endpoint', PROVIDER_ONBOARD_IDEMPOTENCY_ENDPOINT)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (idempotencyReadError) {
        return NextResponse.json({ error: `Failed to check idempotency key: ${idempotencyReadError.message}` }, { status: 500 });
      }

      if (existingIdempotentResponse) {
        return NextResponse.json(existingIdempotentResponse.response_body, {
          status: existingIdempotentResponse.status_code,
        });
      }
    }

    // Determine provider type: use custom type if "other" is selected, otherwise use predefined type
    let resolvedProviderType: string;
    if (payload.provider_type === 'other' && payload.custom_provider_type?.trim()) {
      // Allow any custom provider type name - normalize it for storage
      resolvedProviderType = payload.custom_provider_type
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, ''); // Remove special characters
    } else {
      resolvedProviderType = payload.provider_type as string;
    }

    if (!resolvedProviderType) {
      return NextResponse.json({ error: 'Provider type is required.' }, { status: 400 });
    }

    const { data: roleRows, error: roleError } = await supabase
      .from('roles')
      .select('id, name')
      .in('name', ['provider', 'admin', 'staff']);

    if (roleError) {
      return NextResponse.json({ error: 'Failed to load role configuration. Please try again.' }, { status: 500 });
    }

    const providerRole = roleRows?.find((entry) => entry.name === 'provider') ?? null;
    const adminRole = roleRows?.find((entry) => entry.name === 'admin') ?? null;
    const staffRole = roleRows?.find((entry) => entry.name === 'staff') ?? null;

    if (!providerRole) {
      return NextResponse.json({ error: 'Provider role is not configured' }, { status: 500 });
    }

    const normalizedPhone = toIndianE164(payload.phone);

    const { data: existingEmailUser, error: existingEmailUserError } = await supabase
      .from('users')
      .select('id, email, role_id, roles(name)')
      .ilike('email', payload.email)
      .maybeSingle();

    if (existingEmailUserError) {
      return NextResponse.json({ error: 'Unable to validate email. Please try again.' }, { status: 500 });
    }

    const { data: existingPhoneUser, error: existingPhoneUserError } = await supabase
      .from('users')
      .select('id, email, role_id, roles(name)')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingPhoneUserError) {
      return NextResponse.json({ error: 'Unable to validate phone number. Please try again.' }, { status: 500 });
    }

    if (existingEmailUser && existingPhoneUser && existingEmailUser.id !== existingPhoneUser.id) {
      return NextResponse.json(
        {
          error:
            'Email and phone belong to different existing accounts. Use matching email and phone for the same user before onboarding.',
        },
        { status: 409 },
      );
    }

    const existingUser = existingEmailUser ?? existingPhoneUser;
    const existingUserRoleName = getJoinedRoleName(existingUser?.roles);

    if (
      existingUser &&
      ((adminRole && existingUser.role_id === adminRole.id) ||
        (staffRole && existingUser.role_id === staffRole.id) ||
        existingUserRoleName === 'admin' ||
        existingUserRoleName === 'staff')
    ) {
      return NextResponse.json(
        { error: 'Admin and staff accounts cannot be replaced by provider onboarding.' },
        { status: 409 },
      );
    }

    let providerUserId = existingUser?.id ?? '';
    let providerEmail = existingUser?.email?.trim().toLowerCase() ?? payload.email;
    let usedExistingUser = false;
    let createdAuthUserId: string | null = null;

    if (existingUser) {
      usedExistingUser = true;

      const { error: userUpdateError } = await supabase
        .from('users')
        .update({
          name: payload.name.trim(),
          phone: normalizedPhone,
          address: payload.address.trim(),
          role_id: providerRole.id,
        })
        .eq('id', existingUser.id);

      if (userUpdateError) {
        const friendlyProfileError = getUserProfileCreationFriendlyMessage(userUpdateError);

        logSecurityEvent('error', 'admin.action', {
          route: 'api/admin/providers/onboard',
          actorId: user.id,
          actorRole: role,
          message: friendlyProfileError,
          metadata: { email: payload.email, existingUserId: existingUser.id },
        });

        return NextResponse.json(
          { error: friendlyProfileError },
          { status: 409 },
        );
      }

      providerUserId = existingUser.id;
    } else {
      const inviteRedirectTo = new URL('/auth/callback?next=/dashboard/provider', request.url).toString();

      const { data: authUser, error: authError } = await adminClient.auth.admin.inviteUserByEmail(payload.email, {
        data: {
          name: payload.name.trim(),
          phone: payload.phone.trim(),
          onboarding_role: 'provider',
        },
        redirectTo: inviteRedirectTo,
      });

      if (authError || !authUser.user) {
        logSecurityEvent('error', 'admin.action', {
          route: 'api/admin/providers/onboard',
          actorId: user.id,
          actorRole: role,
          message: authError?.message || 'Failed to invite auth user',
          metadata: { email: payload.email },
        });

        return NextResponse.json({ error: 'Failed to send provider invite email. Please try again.' }, { status: 500 });
      }

      createdAuthUserId = authUser.user.id;
      providerUserId = authUser.user.id;
      providerEmail = payload.email;

      const { error: userProfileError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email: payload.email,
          name: payload.name.trim(),
          phone: normalizedPhone,
          address: payload.address.trim(),
          role_id: providerRole.id,
        });

      if (userProfileError) {
        await adminClient.auth.admin.deleteUser(authUser.user.id);

        const friendlyProfileError = getUserProfileCreationFriendlyMessage(userProfileError);

        logSecurityEvent('error', 'admin.action', {
          route: 'api/admin/providers/onboard',
          actorId: user.id,
          actorRole: role,
          message: friendlyProfileError,
          metadata: { email: payload.email },
        });

        return NextResponse.json(
          { error: friendlyProfileError },
          { status: 409 },
        );
      }
    }

    // Parse numeric fields
    const yearsOfExperience = payload.years_of_experience;
    const latitude = payload.latitude ?? null;
    const longitude = payload.longitude ?? null;
    const serviceRadiusKm = payload.service_radius_km ?? null;

    // Prepare provider input
    // Note: Custom provider types are accepted here. If the database has enum constraints,
    // they will need to be removed/updated to allow arbitrary text values or a migration
    // to add custom provider types to the enum.
    const providerInput: CreateProviderInput = {
      provider_type: resolvedProviderType as ProviderType,
      is_individual: resolvedProviderType !== 'clinic',
      address: payload.address.trim(),
      business_name: payload.business_name?.trim() || payload.name.trim(),
      profile_photo_url: payload.profile_photo_url?.trim() || null,
      phone_number: payload.phone.trim(),
      email: providerEmail,
      years_of_experience: Number.isFinite(yearsOfExperience) ? yearsOfExperience : null,
      service_radius_km: Number.isFinite(serviceRadiusKm) ? serviceRadiusKm : null,
    };

    // Add professional details if provided
    if (payload.qualification || payload.specialization) {
      providerInput.professional_details = {
        license_number: payload.qualification?.trim() || null,
        specialization: payload.specialization?.trim() || null,
        teleconsult_enabled: false,
        emergency_service_enabled: false,
        equipment_details: null,
        insurance_document_url: null,
        license_verified: false,
      };
    }

    // Add clinic details with address if it's a clinic/center
    if (resolvedProviderType === 'clinic') {
      providerInput.clinic_details = {
        registration_number: payload.business_registration_number?.trim() || null,
        gst_number: null,
        address: payload.address.trim(),
        city: payload.city.trim(),
        state: payload.state.trim(),
        pincode: payload.pincode.trim(),
        latitude: latitude && Number.isFinite(latitude) ? latitude : null,
        longitude: longitude && Number.isFinite(longitude) ? longitude : null,
        operating_hours: null,
        number_of_doctors: null,
        hospitalization_available: false,
        emergency_services_available: false,
        registration_verified: false,
      };
    }

    let provider: Awaited<ReturnType<typeof createProvider>>;

    try {
      const { data: existingProviderRecord, error: existingProviderError } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', providerUserId)
        .maybeSingle();

      if (existingProviderError) {
        throw existingProviderError;
      }

      if (existingProviderRecord) {
        const { data: updatedProvider, error: updateProviderError } = await supabase
          .from('providers')
          .update({
            provider_type: providerInput.provider_type,
            is_individual: providerInput.is_individual,
            address: providerInput.address ?? undefined,
            business_name: providerInput.business_name ?? undefined,
            profile_photo_url: providerInput.profile_photo_url ?? undefined,
            phone_number: providerInput.phone_number ?? undefined,
            email: providerInput.email ?? undefined,
            years_of_experience: providerInput.years_of_experience ?? undefined,
            service_radius_km: providerInput.service_radius_km ?? undefined,
            admin_approval_status: 'pending',
            verification_status: 'pending',
            account_status: 'active',
          })
          .eq('id', existingProviderRecord.id)
          .select('*')
          .single();

        if (updateProviderError || !updatedProvider) {
          throw updateProviderError ?? new Error('Failed to update existing provider profile');
        }

        provider = updatedProvider as Awaited<ReturnType<typeof createProvider>>;
      } else {
        provider = await createProvider(supabase, providerUserId, providerInput);

        const { error: providerStatusError } = await supabase
          .from('providers')
          .update({
            admin_approval_status: 'pending',
            verification_status: 'pending',
            account_status: 'active',
          })
          .eq('id', provider.id);

        if (providerStatusError) {
          throw providerStatusError;
        }
      }

      if (providerInput.professional_details) {
        const { error: professionalDetailsError } = await supabase.from('provider_professional_details').upsert(
          {
            provider_id: provider.id,
            ...providerInput.professional_details,
          },
          { onConflict: 'provider_id' },
        );

        if (professionalDetailsError) {
          throw professionalDetailsError;
        }
      }

      if (providerInput.clinic_details) {
        const clinicDetailsPayload = {
          provider_id: provider.id,
          ...providerInput.clinic_details,
          operating_hours: (providerInput.clinic_details.operating_hours ?? null) as Json | null,
        };

        const { error: clinicDetailsError } = await supabase.from('provider_clinic_details').upsert(
          clinicDetailsPayload,
          { onConflict: 'provider_id' },
        );

        if (clinicDetailsError) {
          throw clinicDetailsError;
        }
      }
    } catch (providerCreationError) {
      if (createdAuthUserId) {
        await supabase.from('users').delete().eq('id', createdAuthUserId);
        await adminClient.auth.admin.deleteUser(createdAuthUserId);
      }

      const providerErrorMessage = getProviderCreationFriendlyMessage(extractErrorMessage(providerCreationError));

      logSecurityEvent('error', 'admin.action', {
        route: 'api/admin/providers/onboard',
        actorId: user.id,
        actorRole: role,
        message: providerErrorMessage,
        metadata: { email: payload.email },
      });

      return NextResponse.json({ error: providerErrorMessage }, { status: 500 });
    }

    // If service pincodes are provided for home visit professionals, create them
    if (payload.service_pincodes?.trim() && resolvedProviderType !== 'clinic') {
      const pincodes = payload.service_pincodes
        .split(',')
        .map((p) => p.trim())
        .filter((p) => /^[1-9]\d{5}$/.test(p));

      if (pincodes.length > 0) {
        // Note: Service pincodes will be added when the provider sets up their services
        // For now, just log this information
        logSecurityEvent('info', 'admin.action', {
          route: 'api/admin/providers/onboard',
          actorId: user.id,
          actorRole: role,
          message: 'Provider onboarded with service pincodes',
          metadata: {
            providerId: provider.id,
            pincodeCount: pincodes.length,
          },
        });
      }
    }

    logSecurityEvent('info', 'admin.action', {
      route: 'api/admin/providers/onboard',
      actorId: user.id,
      actorRole: role,
      targetId: provider.id,
      message: 'Provider successfully onboarded',
      metadata: {
        providerName: payload.name,
        providerType: provider.provider_type,
        email: provider.email,
      },
    });

    const responseBody = {
      success: true,
      provider: {
        id: provider.id,
        business_name: provider.business_name,
        email: provider.email,
        provider_type: provider.provider_type,
      },
      message: usedExistingUser
        ? 'Provider successfully onboarded using existing user account.'
        : 'Provider successfully onboarded. An email invitation will be sent.',
    };

    if (idempotencyKey) {
      await adminClient.from('admin_idempotency_keys').upsert(
        {
          endpoint: PROVIDER_ONBOARD_IDEMPOTENCY_ENDPOINT,
          idempotency_key: idempotencyKey,
          actor_user_id: user.id,
          request_payload: payload,
          status_code: 200,
          response_body: responseBody,
        },
        { onConflict: 'endpoint,idempotency_key' },
      );
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to onboard provider';

    logSecurityEvent('error', 'admin.action', {
      route: 'api/admin/providers/onboard',
      actorId: user.id,
      actorRole: role,
      message,
    });

    return NextResponse.json({ error: 'Failed to onboard provider. Please try again.' }, { status: 500 });
  }
}
