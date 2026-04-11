import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const STALE_THRESHOLD_HOURS = 24;

/**
 * POST /api/admin/payments/cleanup-stale-transactions
 *
 * Marks payment_transactions that have been stuck in `initiated` status for longer than
 * STALE_THRESHOLD_HOURS as `failed`. This prevents orphaned rows from growing unbounded
 * and makes the payment dashboard accurate.
 *
 * Should be called by a scheduled job (e.g. daily cron hitting this endpoint with
 * the BILLING_AUTOMATION_SECRET header) or triggered manually from the admin panel.
 */
export async function POST(request: Request) {
  // Allow both admin/staff roles and the billing automation secret for scheduled calls.
  const automationSecret = process.env.BILLING_AUTOMATION_SECRET;
  const authHeader = request.headers.get('authorization');
  const isAutomation =
    automationSecret &&
    authHeader === `Bearer ${automationSecret}`;

  if (!isAutomation) {
    const auth = await requireApiRole(['admin', 'staff']);
    if (auth.response) return auth.response;
  }

  const admin = getSupabaseAdminClient();

  const thresholdISO = new Date(Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString();

  const { data: staleTxList, error: fetchError } = await admin
    .from('payment_transactions')
    .select('id, user_id, transaction_type, amount_inr, created_at')
    .eq('status', 'initiated')
    .lt('created_at', thresholdISO)
    .order('created_at', { ascending: true })
    .limit(200);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const staleIds = (staleTxList ?? []).map((tx) => tx.id);

  if (staleIds.length === 0) {
    return NextResponse.json({ success: true, cleaned: 0, message: 'No stale transactions found.' });
  }

  const { error: updateError } = await admin
    .from('payment_transactions')
    .update({
      status: 'failed',
      metadata: { abandoned_reason: 'stale_initiated_cleanup', abandoned_at: new Date().toISOString() },
    })
    .in('id', staleIds)
    .eq('status', 'initiated');

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    cleaned: staleIds.length,
    message: `Marked ${staleIds.length} stale transaction(s) as failed.`,
    staleThresholdHours: STALE_THRESHOLD_HOURS,
  });
}
