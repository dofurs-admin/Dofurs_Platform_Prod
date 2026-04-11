import { NextResponse } from 'next/server';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { getCreditBalance, getCreditHistory } from '@/lib/credits/wallet';

export async function GET() {
  const { user, supabase } = await getApiAuthContext();
  if (!user) return unauthorized();

  try {
    const [balance, history] = await Promise.all([
      getCreditBalance(supabase, user.id),
      getCreditHistory(supabase, user.id, 20),
    ]);
    return NextResponse.json({ balance, history });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load credit wallet');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
