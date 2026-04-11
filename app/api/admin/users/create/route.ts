import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { toIndianE164 } from '@/lib/utils/india-phone';
import { logAdminAction } from '@/lib/admin/audit';

const createAdminUserSchema = z.object({
  name: z.string().trim().min(2).max(120).regex(/^[a-zA-Z\s.]+$/, 'Name can only contain letters, spaces, and periods'),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  phone: z.string().trim().min(10).max(20),
  noEmailInvite: z.boolean().optional(),
});

function toFriendlyCreateUserError(message: string) {
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

export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { user } = auth.context;
  const payload = await request.json().catch(() => null);
  const parsed = createAdminUserSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid user payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email?.trim().toLowerCase() ?? '';
  const createPhoneOnlyProfile = Boolean(parsed.data.noEmailInvite) || !email;
  const normalizedPhone = toIndianE164(parsed.data.phone);

  if (!normalizedPhone) {
    return NextResponse.json({ error: 'Enter a valid Indian phone number.' }, { status: 400 });
  }

  if (!createPhoneOnlyProfile && !email) {
    return NextResponse.json({ error: 'Email is required unless no-email profile is selected.' }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();

  const [emailProbe, phoneProbe] = await Promise.all([
    createPhoneOnlyProfile
      ? Promise.resolve({ data: null, error: null })
      : adminClient.from('users').select('id').ilike('email', email).limit(1).maybeSingle(),
    adminClient.from('users').select('id').eq('phone', normalizedPhone).limit(1).maybeSingle(),
  ]);

  if (emailProbe.error || phoneProbe.error) {
    return NextResponse.json({ error: 'Unable to verify duplicates right now.' }, { status: 500 });
  }

  if (!createPhoneOnlyProfile && emailProbe.data) {
    return NextResponse.json({ error: 'This email is already registered.' }, { status: 409 });
  }

  if (phoneProbe.data) {
    return NextResponse.json({ error: 'This phone number is already in use.' }, { status: 409 });
  }

  const { data: userRole, error: roleError } = await adminClient.from('roles').select('id').eq('name', 'user').single();

  if (roleError || !userRole) {
    return NextResponse.json({ error: 'User role is not configured.' }, { status: 500 });
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
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    authUserId = createdAuthUser.user.id;
  } else {
    const inviteRedirectTo = new URL('/auth/callback?next=/dashboard/user', request.url).toString();

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
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
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
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  void logAdminAction({
    adminUserId: user.id,
    action: 'user.created',
    entityType: 'user',
    entityId: authUserId ?? 'unknown',
    newValue: { name, phone: normalizedPhone, email: createPhoneOnlyProfile ? null : email },
    metadata: { inviteSent: !createPhoneOnlyProfile },
    request,
  });

  return NextResponse.json({
    success: true,
    user: {
      id: authUserId,
      name,
      email: createPhoneOnlyProfile ? null : email,
      phone: normalizedPhone,
    },
    inviteSent: !createPhoneOnlyProfile,
  });
}
