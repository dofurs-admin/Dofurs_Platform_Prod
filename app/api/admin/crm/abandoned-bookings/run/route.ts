import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { CrmServiceError, runAbandonedBookingSweep } from '@/lib/crm/service';
import { recordCrmAutomationHeartbeat } from '@/lib/crm/automation-status';

function safeTokenEqual(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function extractToken(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const tokenHeader = request.headers.get('x-crm-import-token');
  if (typeof tokenHeader === 'string' && tokenHeader.trim().length > 0) {
    return tokenHeader.trim();
  }

  return '';
}

const runSchema = z.object({
  dryRun: z.boolean().default(false),
});

// ── Route-side automation heartbeat ────────────────────────────────────────────
//
// Scheduling moved database-side (pg_cron + pg_net, migration 101), so the
// ROUTE records the heartbeat for every secret-authenticated run instead of
// relying on the Node cron runner scripts alone. This keeps the "Automation
// health" panel and Discord alerts accurate for every trigger path. Manual
// admin-panel runs are deliberately excluded — they must never mask scheduler
// health. A heartbeat failure must never break the main sweep run.

async function reportAutomationHeartbeat(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  input: Parameters<typeof recordCrmAutomationHeartbeat>[1],
) {
  try {
    await recordCrmAutomationHeartbeat(supabase, input);
  } catch (error) {
    console.error('[crm-automation] Route-side heartbeat failed:', error);
  }
}

/**
 * POST /api/admin/crm/abandoned-bookings/run
 *
 * Converts stale booking sessions (30+ min without completion) into hot CRM
 * leads. Called by cron with CRM_SHEET_IMPORT_SECRET or manually by admin/staff.
 */
export async function POST(request: Request) {
  const automationSecret = process.env.CRM_SHEET_IMPORT_SECRET?.trim() ?? '';
  const token = extractToken(request);
  const isAutomation = !!automationSecret && !!token && safeTokenEqual(automationSecret, token);
  const startedAtMs = Date.now();

  if (!isAutomation) {
    const auth = await requireApiRole(ADMIN_ROLES);
    if (auth.response) return auth.response;
  }

  const parsed = runSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid sweep payload' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  try {
    const result = await runAbandonedBookingSweep(supabase, {
      triggerSource: isAutomation ? 'cron' : 'admin_panel',
      dryRun: parsed.data.dryRun,
    });

    if (isAutomation) {
      await reportAutomationHeartbeat(supabase, {
        job: 'abandoned_bookings_sweep',
        ok: true,
        httpStatus: 200,
        durationMs: Date.now() - startedAtMs,
        summary: {
          dryRun: result.dryRun,
          scanned: result.scanned,
          abandonedLeads: result.abandonedLeads,
          expiredSessions: result.expiredSessions,
          skippedNoContact: result.skippedNoContact,
        },
      });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const status = error instanceof CrmServiceError ? error.status : 500;
    // A 409 means another run held the distributed lock — the cron runner
    // scripts treat that as OK, so the heartbeat does too.
    const lockConflict = status === 409;

    if (isAutomation) {
      await reportAutomationHeartbeat(supabase, {
        job: 'abandoned_bookings_sweep',
        ok: lockConflict,
        httpStatus: status,
        durationMs: Date.now() - startedAtMs,
        errorMessage: lockConflict
          ? 'Another sweep run held the lock'
          : error instanceof Error
            ? error.message
            : 'Unknown sweep failure',
        summary: lockConflict ? { acceptedConflict: true } : {},
      });
    }

    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Sweep failed.' }, { status: 500 });
  }
}
