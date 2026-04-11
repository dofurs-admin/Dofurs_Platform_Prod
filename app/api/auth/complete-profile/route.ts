import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { authSignupSchema } from '@/lib/flows/validation';
import { toFriendlyApiError } from '@/lib/api/errors';
import { isRateLimited } from '@/lib/api/rate-limit';
import { redeemReferralCode } from '@/lib/referrals/service';

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };

function toTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveE164Phone(candidates: Array<unknown>) {
  for (const value of candidates) {
    const candidate = toTrimmedString(value);
    if (/^\+[1-9]\d{6,14}$/.test(candidate)) {
      return candidate;
    }
  }

  return '';
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rate = isRateLimited(`auth:complete-profile:${user.id}`, RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = authSignupSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid profile payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedEmail = (parsed.data.email ?? user.email ?? '').trim().toLowerCase();
  const normalizedPhone = resolveE164Phone([
    parsed.data.phone,
    user.user_metadata?.phone,
    user.user_metadata?.phone_number,
  ]);

  if (normalizedEmail) {
    const { data: existingEmailProfile, error: existingEmailProfileError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', normalizedEmail)
      .neq('id', user.id)
      .maybeSingle();

    if (existingEmailProfileError) {
      const mapped = toFriendlyApiError(existingEmailProfileError, 'Unable to verify email');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    if (existingEmailProfile) {
      return NextResponse.json({ error: 'This email is already registered. Please use Log in.' }, { status: 409 });
    }
  }

  const { data: existingPhoneProfile, error: existingPhoneProfileError } = await supabase
    .from('users')
    .select('id')
    .eq('phone', normalizedPhone)
    .neq('id', user.id)
    .maybeSingle();

  if (existingPhoneProfileError) {
    const mapped = toFriendlyApiError(existingPhoneProfileError, 'Unable to verify phone number');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  if (existingPhoneProfile) {
    return NextResponse.json({ error: 'This phone number is already in use.' }, { status: 409 });
  }

  const { data: userRole, error: roleError } = await supabase.from('roles').select('id').eq('name', 'user').single();

  if (roleError || !userRole) {
    return NextResponse.json({ error: 'Default role not configured' }, { status: 500 });
  }

  const { data: existingProfileRole, error: existingProfileRoleError } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .maybeSingle();

  if (existingProfileRoleError) {
    const mapped = toFriendlyApiError(existingProfileRoleError, 'Unable to complete profile');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const resolvedRoleId = existingProfileRole?.role_id ?? userRole.id;

  const upsertInput = {
    id: user.id,
    phone: normalizedPhone,
    name: parsed.data.name,
    email: normalizedEmail || null,
    role_id: resolvedRoleId,
  };

  let upsertError: { message: string } | null = null;

  const firstUpsertResult = await supabase.from('users').upsert(upsertInput, { onConflict: 'id' });
  upsertError = firstUpsertResult.error;

  if (upsertError && upsertError.message.toLowerCase().includes('phone is required for user role')) {
    const retryPhone = resolveE164Phone([
      user.user_metadata?.phone,
      user.user_metadata?.phone_number,
      parsed.data.phone,
      user.phone,
    ]);

    if (retryPhone) {
      const retryUpsertResult = await supabase.from('users').upsert(
        {
          ...upsertInput,
          phone: retryPhone,
        },
        { onConflict: 'id' },
      );

      upsertError = retryUpsertResult.error;
    }
  }

  if (upsertError) {
    const message = upsertError.message.toLowerCase();

    if (message.includes('users_phone_key')) {
      return NextResponse.json({ error: 'This phone number is already in use.' }, { status: 409 });
    }

    if (message.includes('users_email_unique_ci_idx') || message.includes('email')) {
      return NextResponse.json({ error: 'This email is already registered. Please use Log in.' }, { status: 409 });
    }

    if (message.includes('duplicate key') || message.includes('unique')) {
      return NextResponse.json({ error: 'A duplicate profile value exists. Please verify email and phone.' }, { status: 409 });
    }

    const mapped = toFriendlyApiError(upsertError, 'Unable to complete profile');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const { error: ownerProfileUpsertError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      full_name: parsed.data.name,
      phone_number: normalizedPhone,
    },
    { onConflict: 'id' },
  );

  if (ownerProfileUpsertError) {
    const mapped = toFriendlyApiError(ownerProfileUpsertError, 'Unable to complete profile');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  // Attempt referral redemption — non-fatal: sign-up always succeeds regardless
  const referralCode = parsed.data.referralCode?.trim().toUpperCase();
  if (referralCode) {
    try {
      await redeemReferralCode(user.id, referralCode);
    } catch (referralErr) {
      console.error('[complete-profile] referral redemption failed (non-fatal):', referralErr);
    }
  }

  return NextResponse.json({ success: true });
}
