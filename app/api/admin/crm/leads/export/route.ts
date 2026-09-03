import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';
import { CrmServiceError, buildLeadsCsv, listCrmLeads } from '@/lib/crm/service';
import { isCrmLeadSource, isCrmLeadStatus } from '@/lib/crm/types';

// Exports the CURRENT filtered view (the same filter params the leads list
// route accepts) instead of always dumping everything, so cohorts can be
// exported. No params = all leads (up to the 5,000 export cap) — the previous
// behavior stays the default.

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  const url = new URL(request.url);

  const statusParam = url.searchParams.get('status');
  const sourceParam = url.searchParams.get('source');
  const statusFilter = statusParam ? (isCrmLeadStatus(statusParam) ? statusParam : null) : undefined;
  const sourceFilter = sourceParam ? (isCrmLeadSource(sourceParam) ? sourceParam : null) : undefined;

  if (statusFilter === null) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }
  if (sourceFilter === null) {
    return NextResponse.json({ error: 'Invalid source filter' }, { status: 400 });
  }

  const assignedToParam = url.searchParams.get('assignedTo');
  const assignedTo = assignedToParam === 'me' ? user.id : assignedToParam;
  const priorityParam = url.searchParams.get('priority');
  const search = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  const dueOnly = url.searchParams.get('due') === 'true';
  const areaParam = url.searchParams.get('area');
  const areaFilter = areaParam && /^[a-z0-9-]{1,80}$/.test(areaParam) ? areaParam : undefined;

  try {
    const { leads } = await listCrmLeads(getSupabaseAdminClient(), {
      status: statusFilter,
      source: sourceFilter,
      priority: priorityParam === 'hot' || priorityParam === 'normal' ? priorityParam : undefined,
      assignedTo: assignedTo ?? undefined,
      search: search || undefined,
      dueOnly,
      area: areaFilter,
      limit: 5000,
    });
    const csv = buildLeadsCsv(leads);
    const filename = `dofurs-crm-leads-${getISTTimestamp().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to export leads right now.' }, { status: 500 });
  }
}
