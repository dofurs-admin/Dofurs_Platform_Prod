import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getISTTimestamp } from '@/lib/utils/date';
import { CrmServiceError, buildLeadsCsv, listCrmLeads } from '@/lib/crm/service';

export async function GET() {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  try {
    const leads = await listCrmLeads(getSupabaseAdminClient(), { limit: 5000 });
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
