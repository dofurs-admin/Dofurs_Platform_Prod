import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';

const noHtmlChars = (val: string) => !/<|>|&lt;|&gt;|javascript:/i.test(val);

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine(noHtmlChars, { message: 'Name must not contain HTML or script characters' }),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/),
  address: z.string().trim().min(5).max(300),
  age: z.number().int().min(13).max(120),
  gender: z.enum(['male', 'female', 'other']),
  photoUrl: z.string().trim().min(1).max(500).nullable().optional(),
});

export async function GET() {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, phone, name, email, address, age, gender, photo_url, created_at, role_id, roles(name)')
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [ownerProfileResult, providerResult] = await Promise.all([
    supabase.from('profiles').select('profile_photo_url').eq('id', user.id).maybeSingle(),
    supabase
      .from('providers')
      .select('profile_photo_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (ownerProfileResult.error && ownerProfileResult.error.code !== 'PGRST116') {
    const mapped = toFriendlyApiError(ownerProfileResult.error, 'Failed to load profile photo');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  if (providerResult.error && providerResult.error.code !== 'PGRST116') {
    const mapped = toFriendlyApiError(providerResult.error, 'Failed to load profile photo');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const normalizePhotoValue = (value: string | null | undefined) => {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const resolvedPhotoUrl =
    normalizePhotoValue(data.photo_url) ??
    normalizePhotoValue(ownerProfileResult.data?.profile_photo_url) ??
    normalizePhotoValue(providerResult.data?.profile_photo_url) ??
    null;

  const baseRole = (Array.isArray(data.roles) ? data.roles[0] : data.roles)?.name;
  const effectiveRoleName = role ?? baseRole ?? null;

  return NextResponse.json({
    profile: {
      ...data,
      photo_url: resolvedPhotoUrl,
      roles: effectiveRoleName ? { name: effectiveRoleName } : null,
    },
  });
}

export async function PATCH(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (!role) {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedPhone = parsed.data.phone.trim();

  const { data: existingPhoneProfile, error: existingPhoneProfileError } = await supabase
    .from('users')
    .select('id')
    .eq('phone', normalizedPhone)
    .neq('id', user.id)
    .maybeSingle();

  if (existingPhoneProfileError) {
    const mapped = toFriendlyApiError(existingPhoneProfileError, 'Failed to verify phone number');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  if (existingPhoneProfile) {
    return NextResponse.json({ error: 'This phone number is already in use.' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('users')
    .update({
      name: parsed.data.name.trim(),
      phone: normalizedPhone,
      address: parsed.data.address.trim(),
      age: parsed.data.age,
      gender: parsed.data.gender,
      photo_url: parsed.data.photoUrl ?? null,
    })
    .eq('id', user.id)
    .select('id, phone, name, email, address, age, gender, photo_url')
    .single();

  if (error) {
    const mapped = toFriendlyApiError(error, 'Failed to update profile');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  return NextResponse.json({ success: true, profile: data });
}
