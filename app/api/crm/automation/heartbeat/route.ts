import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { isRateLimited } from '@/lib/api/rate-limit';
import { CRM_AUTOMATION_JOBS, recordCrmAutomationHeartbeat } from '@/lib/crm/automation-status';

// ── CRM automation heartbeat (out-of-band cron observability) ──────────────────
//
// Deliberately mounted on the PUBLIC /api/crm path (NOT /api/admin): the
// middleware's protected-route list never covers /api/crm, so cron runners can
// report their outcome here even when the main /api/admin/crm/* endpoints are
// unreachable (middleware gating, auth regressions, route crashes — the exact
// failure mode of the 2026-09-03 incident where every cron run failed
// invisibly). Auth is the shared CRM automation secret.

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,
};

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

function getRequestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const candidate = forwarded.split(',')[0]?.trim();
  return candidate || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

const heartbeatSchema = z.object({
  job: z.enum(CRM_AUTOMATION_JOBS),
  ok: z.boolean(),
  httpStatus: z.number().int().min(100).max(599).nullable().optional(),
  errorMessage: z.string().trim().max(500).nullable().optional(),
  durationMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
  summary: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/crm/automation/heartbeat
 *
 * Called by the CRM cron runners after every attempt (success or failure).
 * Records the outcome in crm_automation_heartbeats and raises a Discord alert
 * when a job crosses the consecutive-failure threshold or recovers from one.
 */
export async function POST(request: Request) {
  const automationSecret = process.env.CRM_SHEET_IMPORT_SECRET?.trim() ?? '';
  const token = extractToken(request);

  if (!automationSecret || !token || !safeTokenEqual(automationSecret, token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const ip = getRequestIp(request);
  const rate = await isRateLimited(supabase, `crm:automation:heartbeat:${ip}`, RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Too many heartbeat requests.' }, { status: 429 });
  }

  const parsed = heartbeatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid heartbeat payload' }, { status: 400 });
  }

  const { job, ok, httpStatus, errorMessage, durationMs, summary } = parsed.data;

  const outcome = await recordCrmAutomationHeartbeat(supabase, {
    job,
    ok,
    httpStatus: httpStatus ?? null,
    errorMessage: errorMessage ?? null,
    durationMs: durationMs ?? null,
    summary: summary && typeof summary === 'object' ? summary : {},
  });

  if (!outcome.recorded) {
    return NextResponse.json({ error: 'Unable to record heartbeat.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, alert: outcome.alert }, { status: 201 });
}
