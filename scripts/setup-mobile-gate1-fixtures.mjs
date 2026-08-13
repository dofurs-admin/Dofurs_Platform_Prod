#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  FIXTURE_PASSWORD_ENV_BY_ACCOUNT,
  SHARED_FIXTURE_PASSWORD_ENV,
  listFixturePasswordEnvNames,
  normalizeFixtureSecretValue,
  resolveFixtureSecretsReportPath,
} from './mobile-fixture-secrets.mjs';

const FIXTURE_TAG = 'mobile-gate1-fixture-v1';
const REPORT_BASENAME = 'mobile-gate1-fixtures';

const ACCOUNT_DEFS = {
  customer: {
    key: 'customer',
    email: 'mobile.customer.gate1@dofurs.test',
    name: 'Mobile Customer Gate1',
    phone: '+919900000101',
    roleName: 'user',
  },
  providerApproved: {
    key: 'providerApproved',
    email: 'mobile.provider.approved.gate1@dofurs.test',
    name: 'Mobile Provider Approved Gate1',
    phone: '+919900000201',
    roleName: 'user',
    providerState: {
      account_status: 'active',
      admin_approval_status: 'approved',
      verification_status: 'approved',
    },
  },
  providerPending: {
    key: 'providerPending',
    email: 'mobile.provider.pending.gate1@dofurs.test',
    name: 'Mobile Provider Pending Gate1',
    phone: '+919900000202',
    roleName: 'user',
    providerState: {
      account_status: 'active',
      admin_approval_status: 'pending',
      verification_status: 'pending',
    },
  },
  providerRejected: {
    key: 'providerRejected',
    email: 'mobile.provider.rejected.gate1@dofurs.test',
    name: 'Mobile Provider Rejected Gate1',
    phone: '+919900000203',
    roleName: 'user',
    providerState: {
      account_status: 'active',
      admin_approval_status: 'rejected',
      verification_status: 'rejected',
    },
  },
  providerSuspended: {
    key: 'providerSuspended',
    email: 'mobile.provider.suspended.gate1@dofurs.test',
    name: 'Mobile Provider Suspended Gate1',
    phone: '+919900000204',
    roleName: 'user',
    providerState: {
      account_status: 'suspended',
      admin_approval_status: 'approved',
      verification_status: 'approved',
    },
  },
  providerBanned: {
    key: 'providerBanned',
    email: 'mobile.provider.banned.gate1@dofurs.test',
    name: 'Mobile Provider Banned Gate1',
    phone: '+919900000205',
    roleName: 'user',
    providerState: {
      account_status: 'banned',
      admin_approval_status: 'approved',
      verification_status: 'approved',
    },
  },
};

function parseEnvLocal(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }

  return env;
}

function parseArgs(argv) {
  const args = {
    outputDir: 'audit-output',
    emitTokens: true,
    skipTokens: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    if (arg === '--skip-tokens') {
      args.skipTokens = true;
      continue;
    }

    if (arg.startsWith('--output-dir=')) {
      args.outputDir = arg.slice('--output-dir='.length) || args.outputDir;
      continue;
    }
  }

  if (args.skipTokens) {
    args.emitTokens = false;
  }

  return args;
}

function printHelp() {
  console.log('Prepare deterministic mobile Gate 1 fixtures for local bearer smoke runs.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/setup-mobile-gate1-fixtures.mjs [--output-dir=audit-output] [--skip-tokens]');
  console.log('');
  console.log('Environment (.env.local or shell):');
  console.log('  NEXT_PUBLIC_SUPABASE_URL');
  console.log('  SUPABASE_SERVICE_ROLE_KEY');
  console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY (required unless --skip-tokens)');
  console.log(`  ${SHARED_FIXTURE_PASSWORD_ENV} (optional shared password for all fixture accounts)`);
  for (const envName of listFixturePasswordEnvNames(Object.keys(ACCOUNT_DEFS))) {
    console.log(`  ${envName} (optional per-account password override)`);
  }
}

function generateFixturePassword(accountKey) {
  const randomSuffix = randomBytes(9).toString('base64url');
  return `Dofurs!${accountKey}.${randomSuffix}`;
}

function resolveFixturePasswords(fileEnv) {
  const sharedPassword = normalizeFixtureSecretValue(
    process.env[SHARED_FIXTURE_PASSWORD_ENV] ?? fileEnv[SHARED_FIXTURE_PASSWORD_ENV],
  );

  const passwords = {};
  for (const accountDef of Object.values(ACCOUNT_DEFS)) {
    const envName = FIXTURE_PASSWORD_ENV_BY_ACCOUNT[accountDef.key];
    const specificPassword = normalizeFixtureSecretValue(process.env[envName] ?? fileEnv[envName]);

    passwords[accountDef.key] = specificPassword ?? sharedPassword ?? generateFixturePassword(accountDef.key);
  }

  return passwords;
}

function toIsoDate(dateLike) {
  return dateLike.toISOString().slice(0, 10);
}

function toIsoTimestamp(dateLike) {
  return dateLike.toISOString();
}

function createIstTimestamp(dateString, timeString) {
  return `${dateString}T${timeString}:00+05:30`;
}

async function listRoleIds(admin) {
  const { data, error } = await admin.from('roles').select('id, name');
  if (error) {
    throw new Error(`Unable to load roles: ${error.message}`);
  }

  const roleIds = {};
  for (const row of data ?? []) {
    roleIds[row.name] = row.id;
  }

  const requiredRoles = ['user', 'provider', 'admin', 'staff'];
  for (const roleName of requiredRoles) {
    if (!roleIds[roleName]) {
      throw new Error(`Missing role in roles table: ${roleName}`);
    }
  }

  return roleIds;
}

async function listAuthUsersByEmail(admin, email) {
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Unable to list auth users: ${error.message}`);
    }

    const users = data?.users ?? [];
    const match = users.find((item) => (item.email || '').toLowerCase() === email.toLowerCase());
    if (match) {
      return match;
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return null;
}

async function ensureAuthUser(admin, accountDef, accountPassword) {
  const existing = await listAuthUsersByEmail(admin, accountDef.email);

  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email: accountDef.email,
      password: accountPassword,
      email_confirm: true,
      user_metadata: {
        name: accountDef.name,
        phone: accountDef.phone,
        onboarding_role: accountDef.roleName,
        fixture_tag: FIXTURE_TAG,
      },
    });

    if (error || !data?.user) {
      throw new Error(`Unable to create auth user ${accountDef.email}: ${error?.message ?? 'unknown error'}`);
    }

    return data.user;
  }

  const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    password: accountPassword,
    user_metadata: {
      ...(existing.user_metadata ?? {}),
      name: accountDef.name,
      phone: accountDef.phone,
      onboarding_role: accountDef.roleName,
      fixture_tag: FIXTURE_TAG,
    },
  });

  if (error || !data?.user) {
    throw new Error(`Unable to update auth user ${accountDef.email}: ${error?.message ?? 'unknown error'}`);
  }

  return data.user;
}

async function ensurePublicUser(admin, roleIds, authUser, accountDef) {
  const payload = {
    id: authUser.id,
    role_id: roleIds[accountDef.roleName],
    name: accountDef.name,
    phone: accountDef.phone,
    email: accountDef.email,
    address: 'Indiranagar, Bengaluru',
    age: 29,
    gender: 'other',
  };

  const { error } = await admin.from('users').upsert(payload, { onConflict: 'id' });
  if (error) {
    throw new Error(`Unable to upsert users row for ${accountDef.email}: ${error.message}`);
  }
}

async function ensureOwnerProfile(admin, authUserId, accountDef) {
  const payload = {
    id: authUserId,
    full_name: accountDef.name,
    phone_number: accountDef.phone,
    account_status: 'active',
    is_phone_verified: true,
    is_email_verified: true,
    first_pet_owner: true,
  };

  const { error } = await admin.from('profiles').upsert(payload, { onConflict: 'id' });
  if (error) {
    throw new Error(`Unable to upsert owner profile for ${accountDef.email}: ${error.message}`);
  }
}

async function ensureProvider(admin, authUserId, accountDef, fallbackServiceType) {
  if (!accountDef.providerState) {
    return null;
  }

  const { data: existing, error: readError } = await admin
    .from('providers')
    .select('id')
    .eq('user_id', authUserId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(`Unable to read provider row for ${accountDef.email}: ${readError.message}`);
  }

  const providerPayload = {
    user_id: authUserId,
    name: accountDef.name,
    type: 'home',
    provider_type: 'groomer',
    is_individual: true,
    business_name: `${accountDef.name} Services`,
    address: 'Indiranagar, Bengaluru',
    start_time: '09:00',
    end_time: '19:00',
    phone_number: accountDef.phone,
    email: accountDef.email,
    service_radius_km: 12,
    verification_status: accountDef.providerState.verification_status,
    admin_approval_status: accountDef.providerState.admin_approval_status,
    account_status: accountDef.providerState.account_status,
    accepts_platform_payment: true,
    working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    bio: `Fixture provider for ${FIXTURE_TAG}`,
    years_of_experience: 4,
  };

  if (!existing) {
    const { data: inserted, error: insertError } = await admin
      .from('providers')
      .insert(providerPayload)
      .select('id')
      .single();

    if (insertError || !inserted) {
      throw new Error(`Unable to insert provider row for ${accountDef.email}: ${insertError?.message ?? 'unknown error'}`);
    }

    await ensureProviderAvailability(admin, inserted.id);
    await ensureProviderBlockedDate(admin, inserted.id);

    const providerService = await ensureProviderService(admin, inserted.id, fallbackServiceType);
    const legacyServiceId = await ensureLegacyService(admin, inserted.id, providerService.service_type);

    return {
      providerId: inserted.id,
      providerService,
      legacyServiceId,
    };
  }

  const { error: updateError } = await admin.from('providers').update(providerPayload).eq('id', existing.id);
  if (updateError) {
    throw new Error(`Unable to update provider row for ${accountDef.email}: ${updateError.message}`);
  }

  await ensureProviderAvailability(admin, existing.id);
  await ensureProviderBlockedDate(admin, existing.id);

  const providerService = await ensureProviderService(admin, existing.id, fallbackServiceType);
  const legacyServiceId = await ensureLegacyService(admin, existing.id, providerService.service_type);

  return {
    providerId: existing.id,
    providerService,
    legacyServiceId,
  };
}

async function ensureProviderAvailability(admin, providerId) {
  const { data: existingRows, error } = await admin
    .from('provider_availability')
    .select('id, day_of_week')
    .eq('provider_id', providerId)
    .order('day_of_week', { ascending: true });

  if (error) {
    throw new Error(`Unable to read provider availability for provider ${providerId}: ${error.message}`);
  }

  const byDay = new Map((existingRows ?? []).map((row) => [row.day_of_week, row.id]));

  for (let day = 0; day <= 6; day += 1) {
    const payload = {
      provider_id: providerId,
      day_of_week: day,
      start_time: '09:00',
      end_time: '18:00',
      is_available: day !== 0,
      slot_duration_minutes: 60,
      buffer_time_minutes: 15,
      set_by: 'admin',
      admin_locked: false,
    };

    const existingId = byDay.get(day);

    if (existingId) {
      const { error: updateError } = await admin.from('provider_availability').update(payload).eq('id', existingId);
      if (updateError) {
        throw new Error(`Unable to update provider availability for provider ${providerId}: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await admin.from('provider_availability').insert(payload);
      if (insertError) {
        throw new Error(`Unable to insert provider availability for provider ${providerId}: ${insertError.message}`);
      }
    }
  }
}

async function ensureProviderBlockedDate(admin, providerId) {
  const blockedDate = new Date();
  blockedDate.setDate(blockedDate.getDate() + 3);
  const blockedDateIso = toIsoDate(blockedDate);
  const reason = `${FIXTURE_TAG}:maintenance-window`;

  const { data: existing, error: readError } = await admin
    .from('provider_blocked_dates')
    .select('id')
    .eq('provider_id', providerId)
    .eq('blocked_date', blockedDateIso)
    .eq('reason', reason)
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(`Unable to read provider blocked dates for provider ${providerId}: ${readError.message}`);
  }

  if (!existing) {
    const { error: insertError } = await admin.from('provider_blocked_dates').insert({
      provider_id: providerId,
      blocked_date: blockedDateIso,
      block_start_time: '12:00',
      block_end_time: '14:00',
      reason,
    });

    if (insertError) {
      throw new Error(`Unable to insert provider blocked date for provider ${providerId}: ${insertError.message}`);
    }
  }
}

async function resolveCatalogTemplateServiceType(admin) {
  const { data, error } = await admin
    .from('provider_services')
    .select('service_type')
    .is('provider_id', null)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read catalog template service type: ${error.message}`);
  }

  if (!data?.service_type) {
    return 'pet grooming';
  }

  return data.service_type;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

async function ensureProviderService(admin, providerId, serviceType) {
  const { data: existing, error: readError } = await admin
    .from('provider_services')
    .select('id, service_type')
    .eq('provider_id', providerId)
    .eq('service_type', serviceType)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(`Unable to read provider service for provider ${providerId}: ${readError.message}`);
  }

  const payload = {
    provider_id: providerId,
    service_type: serviceType,
    base_price: 799,
    service_duration_minutes: 60,
    is_active: true,
    service_mode: 'home_visit',
    requires_location: true,
    requires_pet_details: true,
    short_description: `${FIXTURE_TAG} service`,
    slug: `${slugify(serviceType)}-${providerId}`,
    display_order: 10,
  };

  if (!existing) {
    const { data: inserted, error: insertError } = await admin
      .from('provider_services')
      .insert(payload)
      .select('id, service_type')
      .single();

    if (insertError || !inserted) {
      throw new Error(`Unable to insert provider service for provider ${providerId}: ${insertError?.message ?? 'unknown error'}`);
    }

    return inserted;
  }

  const { error: updateError } = await admin.from('provider_services').update(payload).eq('id', existing.id);
  if (updateError) {
    throw new Error(`Unable to update provider service for provider ${providerId}: ${updateError.message}`);
  }

  return existing;
}

async function ensureLegacyService(admin, providerId, serviceType) {
  const fixtureName = `Fixture ${serviceType}`;
  const { data: existing, error: readError } = await admin
    .from('services')
    .select('id')
    .eq('provider_id', providerId)
    .eq('name', fixtureName)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(`Unable to read legacy services for provider ${providerId}: ${readError.message}`);
  }

  const payload = {
    provider_id: providerId,
    name: fixtureName,
    duration_minutes: 60,
    buffer_minutes: 15,
    price: 799,
  };

  if (!existing) {
    const { data: inserted, error: insertError } = await admin.from('services').insert(payload).select('id').single();
    if (insertError || !inserted) {
      throw new Error(`Unable to insert legacy service for provider ${providerId}: ${insertError?.message ?? 'unknown error'}`);
    }
    return inserted.id;
  }

  const { error: updateError } = await admin.from('services').update(payload).eq('id', existing.id);
  if (updateError) {
    throw new Error(`Unable to update legacy service for provider ${providerId}: ${updateError.message}`);
  }

  return existing.id;
}

async function ensureCustomerPet(admin, customerUserId) {
  const petName = 'Fixture Buddy';

  const { data: existing, error: readError } = await admin
    .from('pets')
    .select('id')
    .eq('user_id', customerUserId)
    .eq('name', petName)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(`Unable to read customer pet: ${readError.message}`);
  }

  const payload = {
    user_id: customerUserId,
    name: petName,
    breed: 'Labrador',
    age: 3,
    weight: 22,
    gender: 'male',
    neutered_spayed: true,
    house_trained: true,
    leash_trained: true,
    crate_trained: true,
    is_bite_history: false,
    bite_incidents_count: 0,
    has_disability: false,
    separation_anxiety: false,
    allergies: null,
    color: 'golden',
  };

  if (!existing) {
    const { data: inserted, error: insertError } = await admin.from('pets').insert(payload).select('id').single();
    if (insertError || !inserted) {
      throw new Error(`Unable to insert customer pet: ${insertError?.message ?? 'unknown error'}`);
    }
    return inserted.id;
  }

  const { error: updateError } = await admin.from('pets').update(payload).eq('id', existing.id);
  if (updateError) {
    throw new Error(`Unable to update customer pet: ${updateError.message}`);
  }

  return existing.id;
}

async function ensureCustomerAddress(admin, customerUserId, customerPhone) {
  const label = 'Home';
  const line1 = 'Fixture Residency, 12th Main';

  const { data: existing, error: readError } = await admin
    .from('user_addresses')
    .select('id')
    .eq('user_id', customerUserId)
    .eq('label', label)
    .eq('address_line_1', line1)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(`Unable to read customer address: ${readError.message}`);
  }

  const payload = {
    user_id: customerUserId,
    label,
    address_line_1: line1,
    address_line_2: 'Near Metro Pillar 108',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
    country: 'India',
    latitude: 12.9719,
    longitude: 77.6412,
    phone: customerPhone,
    is_default: true,
  };

  if (!existing) {
    const { data: inserted, error: insertError } = await admin.from('user_addresses').insert(payload).select('id').single();
    if (insertError || !inserted) {
      throw new Error(`Unable to insert customer address: ${insertError?.message ?? 'unknown error'}`);
    }
    return inserted.id;
  }

  const { error: updateError } = await admin.from('user_addresses').update(payload).eq('id', existing.id);
  if (updateError) {
    throw new Error(`Unable to update customer address: ${updateError.message}`);
  }

  return existing.id;
}

async function ensureDiscount(admin, creatorUserId, serviceType) {
  const code = 'MOBILEFIX10';
  const now = new Date();
  const validFrom = new Date(now);
  validFrom.setDate(validFrom.getDate() - 1);
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + 180);

  const payload = {
    code,
    title: 'Mobile Fixture 10% Off',
    description: `Deterministic discount for ${FIXTURE_TAG}`,
    discount_type: 'percentage',
    discount_value: 10,
    max_discount_amount: 200,
    min_booking_amount: 300,
    applies_to_service_type: serviceType,
    first_booking_only: false,
    is_active: true,
    valid_from: toIsoTimestamp(validFrom),
    valid_until: toIsoTimestamp(validUntil),
    created_by: creatorUserId,
  };

  const { data: existing, error: readError } = await admin
    .from('platform_discounts')
    .select('id')
    .eq('code', code)
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(`Unable to read platform discount: ${readError.message}`);
  }

  if (!existing) {
    const { data: inserted, error: insertError } = await admin.from('platform_discounts').insert(payload).select('id').single();
    if (insertError || !inserted) {
      throw new Error(`Unable to insert platform discount: ${insertError?.message ?? 'unknown error'}`);
    }
    return { id: inserted.id, code };
  }

  const { error: updateError } = await admin.from('platform_discounts').update(payload).eq('id', existing.id);
  if (updateError) {
    throw new Error(`Unable to update platform discount: ${updateError.message}`);
  }

  return { id: existing.id, code };
}

async function ensureWalletBalance(admin, customerUserId) {
  const balancePayload = {
    user_id: customerUserId,
    available_inr: 500,
    lifetime_earned_inr: 500,
    lifetime_used_inr: 0,
    updated_at: toIsoTimestamp(new Date()),
  };

  const { error: upsertError } = await admin.from('user_credit_balance').upsert(balancePayload, { onConflict: 'user_id' });
  if (upsertError) {
    throw new Error(`Unable to upsert user credit balance: ${upsertError.message}`);
  }

  const notes = `${FIXTURE_TAG}:initial-wallet-balance`;

  const { data: existingTx, error: txReadError } = await admin
    .from('credit_wallet_transactions')
    .select('id')
    .eq('user_id', customerUserId)
    .eq('notes', notes)
    .limit(1)
    .maybeSingle();

  if (txReadError) {
    throw new Error(`Unable to read credit wallet transaction: ${txReadError.message}`);
  }

  if (!existingTx) {
    const { error: txInsertError } = await admin.from('credit_wallet_transactions').insert({
      user_id: customerUserId,
      amount_inr: 500,
      transaction_type: 'admin_grant',
      reference_id: null,
      notes,
      balance_after: 500,
    });

    if (txInsertError) {
      throw new Error(`Unable to insert credit wallet transaction: ${txInsertError.message}`);
    }
  }
}

async function ensureSubscriptionCreditFixtures(admin, customerUserId, serviceType) {
  const planCode = 'MOBILE_GROOM_CREDIT_FIX';
  const now = new Date();
  const startsAt = new Date(now);
  startsAt.setDate(startsAt.getDate() - 2);
  const endsAt = new Date(now);
  endsAt.setDate(endsAt.getDate() + 28);

  const planPayload = {
    code: planCode,
    name: 'Mobile Groom Credit Fixture Plan',
    description: `Deterministic plan for ${FIXTURE_TAG}`,
    price_inr: 1499,
    duration_days: 30,
    is_active: true,
    metadata: { fixture_tag: FIXTURE_TAG },
  };

  const { data: existingPlan, error: planReadError } = await admin
    .from('subscription_plans')
    .select('id')
    .eq('code', planCode)
    .limit(1)
    .maybeSingle();

  if (planReadError) {
    throw new Error(`Unable to read subscription plan: ${planReadError.message}`);
  }

  let planId;

  if (!existingPlan) {
    const { data: insertedPlan, error: planInsertError } = await admin
      .from('subscription_plans')
      .insert(planPayload)
      .select('id')
      .single();

    if (planInsertError || !insertedPlan) {
      throw new Error(`Unable to insert subscription plan: ${planInsertError?.message ?? 'unknown error'}`);
    }

    planId = insertedPlan.id;
  } else {
    planId = existingPlan.id;
    const { error: planUpdateError } = await admin.from('subscription_plans').update(planPayload).eq('id', planId);
    if (planUpdateError) {
      throw new Error(`Unable to update subscription plan: ${planUpdateError.message}`);
    }
  }

  const planServicePayload = {
    plan_id: planId,
    service_type: serviceType,
    credit_count: 4,
  };

  const { data: existingPlanService, error: planServiceReadError } = await admin
    .from('subscription_plan_services')
    .select('id')
    .eq('plan_id', planId)
    .eq('service_type', serviceType)
    .limit(1)
    .maybeSingle();

  if (planServiceReadError) {
    throw new Error(`Unable to read subscription plan service: ${planServiceReadError.message}`);
  }

  if (!existingPlanService) {
    const { error: planServiceInsertError } = await admin.from('subscription_plan_services').insert(planServicePayload);
    if (planServiceInsertError) {
      throw new Error(`Unable to insert subscription plan service: ${planServiceInsertError.message}`);
    }
  } else {
    const { error: planServiceUpdateError } = await admin
      .from('subscription_plan_services')
      .update(planServicePayload)
      .eq('id', existingPlanService.id);

    if (planServiceUpdateError) {
      throw new Error(`Unable to update subscription plan service: ${planServiceUpdateError.message}`);
    }
  }

  const { data: existingUserSub, error: userSubReadError } = await admin
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', customerUserId)
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (userSubReadError) {
    throw new Error(`Unable to read user subscription: ${userSubReadError.message}`);
  }

  const userSubPayload = {
    user_id: customerUserId,
    plan_id: planId,
    status: 'active',
    starts_at: toIsoTimestamp(startsAt),
    activated_at: toIsoTimestamp(startsAt),
    ends_at: toIsoTimestamp(endsAt),
    metadata: { fixture_tag: FIXTURE_TAG },
  };

  let userSubscriptionId;

  if (!existingUserSub) {
    const { data: insertedUserSub, error: userSubInsertError } = await admin
      .from('user_subscriptions')
      .insert(userSubPayload)
      .select('id')
      .single();

    if (userSubInsertError || !insertedUserSub) {
      throw new Error(`Unable to insert user subscription: ${userSubInsertError?.message ?? 'unknown error'}`);
    }

    userSubscriptionId = insertedUserSub.id;
  } else {
    userSubscriptionId = existingUserSub.id;
    const { error: userSubUpdateError } = await admin.from('user_subscriptions').update(userSubPayload).eq('id', userSubscriptionId);
    if (userSubUpdateError) {
      throw new Error(`Unable to update user subscription: ${userSubUpdateError.message}`);
    }
  }

  const userServiceCreditsPayload = {
    user_id: customerUserId,
    user_subscription_id: userSubscriptionId,
    service_type: serviceType,
    total_credits: 4,
    available_credits: 3,
    consumed_credits: 1,
  };

  const { data: existingCredits, error: creditsReadError } = await admin
    .from('user_service_credits')
    .select('id')
    .eq('user_subscription_id', userSubscriptionId)
    .eq('service_type', serviceType)
    .limit(1)
    .maybeSingle();

  if (creditsReadError) {
    throw new Error(`Unable to read user service credits: ${creditsReadError.message}`);
  }

  if (!existingCredits) {
    const { error: creditsInsertError } = await admin.from('user_service_credits').insert(userServiceCreditsPayload);
    if (creditsInsertError) {
      throw new Error(`Unable to insert user service credits: ${creditsInsertError.message}`);
    }
  } else {
    const { error: creditsUpdateError } = await admin
      .from('user_service_credits')
      .update(userServiceCreditsPayload)
      .eq('id', existingCredits.id);

    if (creditsUpdateError) {
      throw new Error(`Unable to update user service credits: ${creditsUpdateError.message}`);
    }
  }

  return {
    planId,
    userSubscriptionId,
    serviceType,
  };
}

async function ensureBookingAndBillingFixtures(admin, input) {
  const {
    customerUserId,
    providerUserId,
    providerId,
    providerServiceId,
    serviceType,
    legacyServiceId,
    petId,
    discountCode,
  } = input;

  const now = new Date();
  const bookingDate = new Date(now);
  bookingDate.setDate(bookingDate.getDate() + 1);
  const bookingDateIso = toIsoDate(bookingDate);

  const internalNotes = `${FIXTURE_TAG}:booking`;

  const bookingPayload = {
    user_id: customerUserId,
    provider_id: providerId,
    pet_id: petId,
    provider_service_id: providerServiceId,
    service_id: legacyServiceId,
    service_type: serviceType,
    booking_date: bookingDateIso,
    booking_start: createIstTimestamp(bookingDateIso, '10:00'),
    booking_end: createIstTimestamp(bookingDateIso, '11:00'),
    start_time: '10:00',
    end_time: '11:00',
    booking_mode: 'home_visit',
    amount: 799,
    price_at_booking: 799,
    admin_price_reference: 799,
    discount_amount: 80,
    discount_code: discountCode,
    final_price: 719,
    status: 'confirmed',
    booking_status: 'confirmed',
    payment_mode: 'platform',
    location_address: 'Fixture Residency, 12th Main, Indiranagar, Bengaluru, 560038',
    latitude: 12.9719,
    longitude: 77.6412,
    internal_notes: internalNotes,
    provider_notes: `${FIXTURE_TAG}:provider-notes`,
  };

  const { data: existingBooking, error: bookingReadError } = await admin
    .from('bookings')
    .select('id')
    .eq('user_id', customerUserId)
    .eq('provider_id', providerId)
    .eq('internal_notes', internalNotes)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bookingReadError) {
    throw new Error(`Unable to read fixture booking: ${bookingReadError.message}`);
  }

  let bookingId;

  if (!existingBooking) {
    const { data: insertedBooking, error: bookingInsertError } = await admin
      .from('bookings')
      .insert(bookingPayload)
      .select('id')
      .single();

    if (bookingInsertError || !insertedBooking) {
      throw new Error(`Unable to insert fixture booking: ${bookingInsertError?.message ?? 'unknown error'}`);
    }

    bookingId = insertedBooking.id;
  } else {
    bookingId = existingBooking.id;
    const { error: bookingUpdateError } = await admin.from('bookings').update(bookingPayload).eq('id', bookingId);
    if (bookingUpdateError) {
      throw new Error(`Unable to update fixture booking: ${bookingUpdateError.message}`);
    }
  }

  const providerPaymentId = `pay_${FIXTURE_TAG}_${bookingId}`;
  const paymentOrderId = `order_${FIXTURE_TAG}_${bookingId}`;

  const paymentPayload = {
    user_id: customerUserId,
    booking_id: bookingId,
    amount_inr: 719,
    currency: 'INR',
    provider: 'razorpay',
    transaction_type: 'service_collection',
    status: 'captured',
    payment_order_id: null,
    provider_payment_id: providerPaymentId,
    provider_signature: `${FIXTURE_TAG}:signature`,
    metadata: {
      fixture_tag: FIXTURE_TAG,
      booking_id: bookingId,
      provider_user_id: providerUserId,
      provider_id: providerId,
      provider_service_id: providerServiceId,
      expected_order_id: paymentOrderId,
    },
  };

  const { data: existingPayment, error: paymentReadError } = await admin
    .from('payment_transactions')
    .select('id')
    .eq('provider_payment_id', providerPaymentId)
    .limit(1)
    .maybeSingle();

  if (paymentReadError) {
    throw new Error(`Unable to read fixture payment transaction: ${paymentReadError.message}`);
  }

  let paymentTransactionId;

  if (!existingPayment) {
    const { data: insertedPayment, error: paymentInsertError } = await admin
      .from('payment_transactions')
      .insert(paymentPayload)
      .select('id')
      .single();

    if (paymentInsertError || !insertedPayment) {
      throw new Error(`Unable to insert fixture payment transaction: ${paymentInsertError?.message ?? 'unknown error'}`);
    }

    paymentTransactionId = insertedPayment.id;
  } else {
    paymentTransactionId = existingPayment.id;
    const { error: paymentUpdateError } = await admin
      .from('payment_transactions')
      .update(paymentPayload)
      .eq('id', paymentTransactionId);

    if (paymentUpdateError) {
      throw new Error(`Unable to update fixture payment transaction: ${paymentUpdateError.message}`);
    }
  }

  const invoiceNumber = `INV-${String(bookingId).padStart(6, '0')}-MOB`;

  const invoicePayload = {
    booking_id: bookingId,
    user_id: customerUserId,
    payment_transaction_id: paymentTransactionId,
    invoice_number: invoiceNumber,
    invoice_type: 'service',
    status: 'paid',
    subtotal_inr: 799,
    discount_inr: 80,
    tax_inr: 0,
    cgst_inr: 0,
    sgst_inr: 0,
    igst_inr: 0,
    total_inr: 719,
    issued_at: toIsoTimestamp(new Date()),
    paid_at: toIsoTimestamp(new Date()),
    metadata: {
      fixture_tag: FIXTURE_TAG,
      booking_id: bookingId,
    },
  };

  const { data: existingInvoice, error: invoiceReadError } = await admin
    .from('billing_invoices')
    .select('id')
    .eq('booking_id', bookingId)
    .limit(1)
    .maybeSingle();

  if (invoiceReadError) {
    throw new Error(`Unable to read fixture invoice: ${invoiceReadError.message}`);
  }

  let invoiceId;

  if (!existingInvoice) {
    const { data: insertedInvoice, error: invoiceInsertError } = await admin
      .from('billing_invoices')
      .insert(invoicePayload)
      .select('id')
      .single();

    if (invoiceInsertError || !insertedInvoice) {
      throw new Error(`Unable to insert fixture invoice: ${invoiceInsertError?.message ?? 'unknown error'}`);
    }

    invoiceId = insertedInvoice.id;
  } else {
    invoiceId = existingInvoice.id;
    const { error: invoiceUpdateError } = await admin.from('billing_invoices').update(invoicePayload).eq('id', invoiceId);
    if (invoiceUpdateError) {
      throw new Error(`Unable to update fixture invoice: ${invoiceUpdateError.message}`);
    }
  }

  return {
    bookingId,
    paymentTransactionId,
    invoiceId,
    invoiceNumber,
    providerPaymentId,
  };
}

async function signInAndGetToken(anon, email, password) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password });

  if (error || !data?.session?.access_token) {
    throw new Error(`Unable to sign in ${email} for token minting: ${error?.message ?? 'missing session'}`);
  }

  return data.session.access_token;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const root = process.cwd();
  const envPath = path.join(root, '.env.local');
  const fileEnv = fs.existsSync(envPath) ? parseEnvLocal(envPath) : {};

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (args.emitTokens && !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY (required for token minting). Use --skip-tokens to continue without tokens.');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const anon = args.emitTokens
    ? createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  const roleIds = await listRoleIds(admin);
  const catalogServiceType = await resolveCatalogTemplateServiceType(admin);
  const fixturePasswords = resolveFixturePasswords(fileEnv);

  const accountResults = {};

  for (const accountDef of Object.values(ACCOUNT_DEFS)) {
    const accountPassword = fixturePasswords[accountDef.key];
    const authUser = await ensureAuthUser(admin, accountDef, accountPassword);
    await ensurePublicUser(admin, roleIds, authUser, accountDef);
    await ensureOwnerProfile(admin, authUser.id, accountDef);

    const accountRecord = {
      key: accountDef.key,
      authUserId: authUser.id,
      email: accountDef.email,
      phone: accountDef.phone,
      roleName: accountDef.roleName,
      provider: null,
    };

    if (accountDef.providerState) {
      accountRecord.provider = await ensureProvider(admin, authUser.id, accountDef, catalogServiceType);
    }

    accountResults[accountDef.key] = accountRecord;
  }

  const customer = accountResults.customer;
  const providerApproved = accountResults.providerApproved;

  if (!providerApproved.provider) {
    throw new Error('Approved provider fixture setup did not create provider details.');
  }

  const petId = await ensureCustomerPet(admin, customer.authUserId);
  const addressId = await ensureCustomerAddress(admin, customer.authUserId, customer.phone);
  const discount = await ensureDiscount(admin, customer.authUserId, providerApproved.provider.providerService.service_type);
  await ensureWalletBalance(admin, customer.authUserId);
  const subscriptionFixture = await ensureSubscriptionCreditFixtures(
    admin,
    customer.authUserId,
    providerApproved.provider.providerService.service_type,
  );

  const bookingBillingFixture = await ensureBookingAndBillingFixtures(admin, {
    customerUserId: customer.authUserId,
    providerUserId: providerApproved.authUserId,
    providerId: providerApproved.provider.providerId,
    providerServiceId: providerApproved.provider.providerService.id,
    serviceType: providerApproved.provider.providerService.service_type,
    legacyServiceId: providerApproved.provider.legacyServiceId,
    petId,
    discountCode: discount.code,
  });

  const tokens = {};

  if (anon) {
    tokens.customer = await signInAndGetToken(anon, ACCOUNT_DEFS.customer.email, fixturePasswords.customer);
    tokens.providerApproved = await signInAndGetToken(
      anon,
      ACCOUNT_DEFS.providerApproved.email,
      fixturePasswords.providerApproved,
    );
  }

  const report = {
    generated_at: new Date().toISOString(),
    fixture_tag: FIXTURE_TAG,
    catalog_service_type: catalogServiceType,
    accounts: accountResults,
    customer_data: {
      pet_id: petId,
      address_id: addressId,
    },
    provider_data: {
      approved_provider_id: providerApproved.provider.providerId,
      approved_provider_service_id: providerApproved.provider.providerService.id,
      approved_legacy_service_id: providerApproved.provider.legacyServiceId,
    },
    commerce_data: {
      discount,
      subscription: subscriptionFixture,
      booking_billing: bookingBillingFixture,
      wallet_expected_available_inr: 500,
    },
  };

  const outputDir = path.join(root, args.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outputDir, `${REPORT_BASENAME}-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const secretsReport = {
    generated_at: new Date().toISOString(),
    fixture_tag: FIXTURE_TAG,
    fixture_report_path: reportPath,
    accounts: Object.fromEntries(
      Object.values(ACCOUNT_DEFS).map((accountDef) => [
        accountDef.key,
        {
          email: accountDef.email,
          password: fixturePasswords[accountDef.key],
        },
      ]),
    ),
    tokens,
  };

  const secretsReportPath = resolveFixtureSecretsReportPath(reportPath);
  fs.writeFileSync(secretsReportPath, JSON.stringify(secretsReport, null, 2), { mode: 0o600 });

  console.log('Mobile Gate 1 fixtures prepared successfully.');
  console.log(`- Fixture tag: ${FIXTURE_TAG}`);
  console.log(`- Report: ${reportPath}`);
  console.log(`- Secrets report (gitignored): ${secretsReportPath}`);
  console.log(`- Customer: ${ACCOUNT_DEFS.customer.email}`);
  console.log(`- Provider (approved): ${ACCOUNT_DEFS.providerApproved.email}`);

  if (Object.keys(tokens).length > 0) {
    console.log('- Token minting: completed (stored only in the gitignored secrets report)');
  } else {
    console.log('- Token minting: skipped');
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
