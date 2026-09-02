import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { CrmServiceError, listRetentionCandidates } from '@/lib/crm/service';
import {
  RETENTION_DEFAULT_RECOMMENDED_DAYS,
  RETENTION_RECOMMENDED_DAY_OPTIONS,
} from '@/lib/crm/types';

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const url = new URL(request.url);

  const daysParam = Number(url.searchParams.get('days'));
  const recommendedDays = (RETENTION_RECOMMENDED_DAY_OPTIONS as readonly number[]).includes(daysParam)
    ? daysParam
    : RETENTION_DEFAULT_RECOMMENDED_DAYS;

  const limitParam = Number(url.searchParams.get('limit'));
  const offsetParam = Number(url.searchParams.get('offset'));
  const limit = Math.min(Math.max(Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 10, 1), 100);
  const offset = Math.max(Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0, 0);

  try {
    const { candidates, total } = await listRetentionCandidates(getSupabaseAdminClient(), {
      recommendedDays,
      limit,
      offset,
    });

    return NextResponse.json(
      { candidates, total, pagination: { limit, offset, recommendedDays } },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to load retention candidates.' }, { status: 500 });
  }
}
