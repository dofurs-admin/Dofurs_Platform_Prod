import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { updateProviderDetails } from '@/lib/provider-management/service';
import { providerDetailsUpdateSchema } from '@/lib/provider-management/validation';

export async function PATCH(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = providerDetailsUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await updateProviderDetails(supabase, user.id, parsed.data);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update provider details';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
