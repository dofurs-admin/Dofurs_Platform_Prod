import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { createProvider, updateProviderProfile } from '@/lib/provider-management/service';
import { createProviderSchema, providerProfileUpdateSchema } from '@/lib/provider-management/validation';

export async function POST(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = createProviderSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const provider = await createProvider(supabase, user.id, parsed.data);
    return NextResponse.json({ success: true, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create provider profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = providerProfileUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields provided.' }, { status: 400 });
  }

  try {
    const provider = await updateProviderProfile(supabase, user.id, parsed.data);
    return NextResponse.json({ success: true, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update provider profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
