import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getCrmAutomationStatus } from '@/lib/crm/automation-status';

// ── GET: CRM automation health snapshot (admin/staff only) ────────────────────

/**
 * GET /api/admin/crm/automation/status
 *
 * Health snapshot for the "Automation health" panel: per-cron-job verdict
 * (healthy / stale / failing / not_reporting / misconfigured), last report
 * times vs the expected cadence, consecutive failures, recent heartbeat
 * errors, and environment config checks.
 */
export async function GET() {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  try {
    const status = await getCrmAutomationStatus(getSupabaseAdminClient());
    return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('[crm-automation] Status snapshot failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load automation status.' }, { status: 500 });
  }
}
