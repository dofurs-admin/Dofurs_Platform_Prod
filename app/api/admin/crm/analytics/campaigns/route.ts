import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { CrmServiceError, listCampaignPerformance } from '@/lib/crm/service';

export async function GET() {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  try {
    const campaigns = await listCampaignPerformance(getSupabaseAdminClient());
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
