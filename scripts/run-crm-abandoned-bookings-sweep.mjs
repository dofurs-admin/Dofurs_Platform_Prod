// Cron runner for the CRM abandoned-booking sweep (Phase 3).
// Mirrors run-crm-meta-sheet-import.mjs. Schedule every 5 minutes on Render —
// the staleness window is CRM_ABANDON_AFTER_MINUTES (default 10), so hot leads
// surface roughly 10–15 minutes after a customer goes quiet mid-booking:
//
//   CRM_IMPORT_BASE_URL=https://dofurs.in \
//   CRM_SHEET_IMPORT_SECRET=<secret> \
//   node scripts/run-crm-abandoned-bookings-sweep.mjs

function normalizeBaseUrl(rawUrl) {
  const trimmed = rawUrl?.trim() ?? '';
  if (!trimmed) {
    throw new Error('Missing CRM_IMPORT_BASE_URL (or NEXT_PUBLIC_SITE_URL).');
  }
  return trimmed.replace(/\/+$/, '');
}

function buildAuthHeaders(secret) {
  const mode = (process.env.CRM_IMPORT_AUTH_MODE ?? 'authorization').trim().toLowerCase();
  if (mode === 'x-token') {
    return { 'x-crm-import-token': secret };
  }
  return { authorization: `Bearer ${secret}` };
}

const baseUrl = normalizeBaseUrl(process.env.CRM_IMPORT_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL);
const secret = process.env.CRM_SHEET_IMPORT_SECRET?.trim() ?? '';

if (!secret) {
  throw new Error('Missing CRM_SHEET_IMPORT_SECRET.');
}

const endpoint = `${baseUrl}/api/admin/crm/abandoned-bookings/run`;
const heartbeatEndpoint = `${baseUrl}/api/crm/automation/heartbeat`;

// Out-of-band observability: report every attempt (success or failure) to the
// PUBLIC heartbeat endpoint so the CRM "Automation health" panel and Discord
// alerts keep working even when the main admin endpoint above is unreachable.
// Never throws — a heartbeat problem must not mask or amplify the main outcome.
async function reportHeartbeat(outcome) {
  try {
    const response = await fetch(heartbeatEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...buildAuthHeaders(secret) },
      body: JSON.stringify(outcome),
    });
    if (!response.ok) {
      console.warn(
        `[heartbeat] Endpoint returned ${response.status} — this run will not appear in the CRM automation panel.`,
      );
    }
  } catch (error) {
    console.warn(`[heartbeat] Failed to report: ${error instanceof Error ? error.message : error}`);
  }
}

const JOB = 'abandoned_bookings_sweep';
const startedAtMs = Date.now();
let mainOutcome;

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...buildAuthHeaders(secret) },
    body: JSON.stringify({ dryRun: false }),
  });

  const responseText = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = { raw: responseText };
  }

  const ok = response.ok || response.status === 409;
  const result = payload && typeof payload === 'object' ? payload.result : undefined;

  mainOutcome = {
    job: JOB,
    ok,
    httpStatus: response.status,
    durationMs: Date.now() - startedAtMs,
    errorMessage: ok ? null : `HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 400)}`,
    summary:
      result && typeof result === 'object'
        ? {
            scanned: result.scanned ?? null,
            abandonedLeads: result.abandonedLeads ?? null,
            expiredSessions: result.expiredSessions ?? null,
            skippedNoContact: result.skippedNoContact ?? null,
            acceptedConflict: response.status === 409,
          }
        : { acceptedConflict: response.status === 409 },
  };

  await reportHeartbeat(mainOutcome);

  if (!ok) {
    throw new Error(`CRM abandoned booking sweep failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  console.log(
    JSON.stringify(
      { ok: true, endpoint, status: response.status, response: payload, ran_at: new Date().toISOString() },
      null,
      2,
    ),
  );
} catch (error) {
  if (!mainOutcome) {
    // Network-level failure (fetch threw before a response arrived) — still
    // report so the outage is visible in the automation panel.
    await reportHeartbeat({
      job: JOB,
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAtMs,
    });
  }
  throw error;
}
