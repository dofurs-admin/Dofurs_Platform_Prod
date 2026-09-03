import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { CrmServiceError, listCampaignPerformance } from '@/lib/crm/service';

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  // B6: optional window — 30d / 90d of campaign history (default all-time).
  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get('days'));
  const sinceIso = daysParam === 30 || daysParam === 90
    ? new Date(Date.now() - daysParam * 86_400_000).toISOString()
    : undefined;

  try {
    const campaigns = await listCampaignPerformance(getSupabaseAdminClient(), { sinceIso });
    return NextResponse.json(
      { campaigns },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to load campaign analytics.' }, { status: 500 });
  }
}
