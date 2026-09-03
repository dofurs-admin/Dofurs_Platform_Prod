import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { logAdminAction } from '@/lib/admin/audit';
import { CrmServiceError, runMetaSheetImport, type RunMetaSheetImportResult } from '@/lib/crm/service';
import { recordCrmAutomationHeartbeat } from '@/lib/crm/automation-status';

// ── Shared token helpers (mirrors app/api/admin/payments/cleanup-stale-transactions) ──

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

// ── GET: recent import run history (admin/staff only) ──────────────────────────

export async function GET() {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('crm_sheet_import_runs')
    .select(
      'id, trigger_source, status, dry_run, rows_scanned, rows_imported, rows_skipped, rows_invalid, rows_empty, error_message, started_at, finished_at, metadata, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: 'Unable to load import history right now.' }, { status: 500 });
  }

  return NextResponse.json(
    { runs: data ?? [] },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

// ── POST: run the import (admin/staff session OR automation secret) ───────────

const runImportSchema = z.object({
  dryRun: z.boolean().default(false),
});

// ── Route-side automation heartbeat ────────────────────────────────────────────
//
// Scheduling moved database-side (pg_cron + pg_net, migration 101) and a
// Google-Sheet push trigger also calls this endpoint, so the ROUTE records the
// heartbeat for every secret-authenticated run instead of relying on the Node
// cron runner scripts alone. This keeps the "Automation health" panel and
// Discord alerts accurate for every trigger path (pg_cron, sheet push trigger,
// manual script run). Manual admin-panel runs are deliberately excluded — they
// must never mask scheduler health. A heartbeat failure must never break the
// main import run (observability only).

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
 * POST /api/admin/crm/imports/meta-sheet
 *
 * Imports Meta lead-form rows from the synced Google Sheet into crm_leads.
 * Called manually from the admin CRM tab, or by cron with
 * Authorization: Bearer <CRM_SHEET_IMPORT_SECRET> or x-crm-import-token.
 */
export async function POST(request: Request) {
  const automationSecret = process.env.CRM_SHEET_IMPORT_SECRET?.trim() ?? '';
  const token = extractToken(request);
  const isAutomation = !!automationSecret && !!token && safeTokenEqual(automationSecret, token);
  const startedAtMs = Date.now();

  let actorUserId: string | undefined;
  if (!isAutomation) {
    const auth = await requireApiRole(ADMIN_ROLES);
    if (auth.response) return auth.response;
    actorUserId = auth.context.user.id;
  }

  const payload = await request.json().catch(() => null);
  const parsed = runImportSchema.safeParse(payload ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid import payload' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  try {
    const result: RunMetaSheetImportResult = await runMetaSheetImport(supabase, {
      triggerSource: isAutomation ? 'cron' : 'admin_panel',
      dryRun: parsed.data.dryRun,
      actorUserId,
      request,
    });

    if (isAutomation) {
      await reportAutomationHeartbeat(supabase, {
        job: 'meta_sheet_import',
        ok: true,
        httpStatus: 200,
        durationMs: Date.now() - startedAtMs,
        summary: {
          dryRun: result.dryRun,
          scanned: result.rowsScanned,
          imported: result.imported,
          skipped: result.skippedExisting,
          invalid: result.invalid,
          newCustomers: result.newCustomers,
          candidatesFound: result.candidatesFound,
        },
      });
    }

    if (!parsed.data.dryRun && actorUserId && result.imported > 0) {
      await logAdminAction({
        adminUserId: actorUserId,
        action: 'crm.lead.import.meta_sheet',
        entityType: 'crm_lead',
        entityId: 'batch',
        newValue: { imported: result.imported, new_customers: result.newCustomers, skipped: result.skippedExisting },
        request,
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
        job: 'meta_sheet_import',
        ok: lockConflict,
        httpStatus: status,
        durationMs: Date.now() - startedAtMs,
        errorMessage: lockConflict
          ? 'Another import run held the lock'
          : error instanceof Error
            ? error.message
            : 'Unknown import failure',
        summary: lockConflict ? { acceptedConflict: true } : {},
      });
    }

    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sheet import failed.' },
      { status: 500 },
    );
  }
}
