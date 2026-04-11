import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getProviderReviewResponseHistory } from '@/lib/provider-management/service';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const { id } = await context.params;

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    const history = await getProviderReviewResponseHistory(supabase, providerId, id);
    return NextResponse.json({ history });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load review response history';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
