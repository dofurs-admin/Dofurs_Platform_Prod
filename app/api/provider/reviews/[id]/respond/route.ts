import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { respondToReview } from '@/lib/provider-management/service';
import { providerReviewResponseSchema } from '@/lib/provider-management/validation';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = providerReviewResponseSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    const review = await respondToReview(supabase, providerId, id, parsed.data.responseText);
    return NextResponse.json({ success: true, review });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to respond to review';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
