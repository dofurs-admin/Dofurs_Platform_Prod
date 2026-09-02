import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { CrmServiceError, listRetentionCandidates } from '@/lib/crm/service';

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const days = Number(url.searchParams.get('days') ?? 25);

  try {
    const candidates = await listRetentionCandidates(getSupabaseAdminClient(), {
      days: Number.isFinite(days) ? days : undefined,
    });

    return NextResponse.json(
      { candidates },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to load retention candidates.' }, { status: 500 });
  }
}
