// Cron runner for the CRM Meta sheet import.
//
// Mirrors scripts/run-billing-reminders-schedule.mjs: POSTs to the import
// endpoint with the automation secret. Schedule it every 5 minutes on Render
// (runs are idempotent via external_lead_id and lock-protected, so frequent
// schedules are safe — new Meta leads land in the CRM within ~5 minutes):
//
//   CRM_IMPORT_BASE_URL=https://dofurs.in \
//   CRM_SHEET_IMPORT_SECRET=<secret> \
//   node scripts/run-crm-meta-sheet-import.mjs

function normalizeBaseUrl(rawUrl) {
  const trimmed = rawUrl?.trim() ?? '';
  if (!trimmed) {
    throw new Error('Missing CRM_IMPORT_BASE_URL (or NEXT_PUBLIC_SITE_URL).');
  }

  return trimmed.replace(/\/+$/, '');
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  throw new Error(`Invalid boolean value: ${value}`);
}

function buildAuthHeaders(secret) {
  const mode = (process.env.CRM_IMPORT_AUTH_MODE ?? 'authorization').trim().toLowerCase();
  if (mode === 'x-token') {
    return { 'x-crm-import-token': secret };
  }

  return { authorization: `Bearer ${secret}` };
}

function parseResponsePayload(response, text) {
  if (!text) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  return { raw: text };
}

const baseUrl = normalizeBaseUrl(process.env.CRM_IMPORT_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL);
const secret = process.env.CRM_SHEET_IMPORT_SECRET?.trim() ?? '';

if (!secret) {
  throw new Error('Missing CRM_SHEET_IMPORT_SECRET.');
}

const endpoint = `${baseUrl}/api/admin/crm/imports/meta-sheet`;
const heartbeatEndpoint = `${baseUrl}/api/crm/automation/heartbeat`;
const body = {
  dryRun: parseBoolean(process.env.CRM_SHEET_IMPORT_DRY_RUN, false),
};

// Out-of-band observability: report every attempt (success or failure) to the
// PUBLIC heartbeat endpoint so the CRM "Automation health" panel and Discord
// alerts keep working even when the main admin endpoint above is unreachable
// (middleware gating, auth regressions, route crashes). Never throws — a
// heartbeat problem must not mask or amplify the main-run outcome.
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

const JOB = 'meta_sheet_import';
const startedAtMs = Date.now();
let mainOutcome;

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildAuthHeaders(secret),
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  const payload = parseResponsePayload(response, responseText);
  const acceptConflict = parseBoolean(process.env.CRM_SHEET_IMPORT_ACCEPT_CONFLICT, true);
  const ok = response.ok || (acceptConflict && response.status === 409);
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
            dryRun: Boolean(result.dryRun),
            imported: result.imported ?? null,
            skipped: result.skippedExisting ?? null,
            invalid: result.invalid ?? null,
            newCustomers: result.newCustomers ?? null,
            candidatesFound: result.candidatesFound ?? null,
            acceptedConflict: response.status === 409,
          }
        : { acceptedConflict: response.status === 409 },
  };

  await reportHeartbeat(mainOutcome);

  if (!ok) {
    throw new Error(
      `CRM sheet import request failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        endpoint,
        status: response.status,
        accepted_conflict: response.status === 409,
        request: body,
        response: payload,
        ran_at: new Date().toISOString(),
      },
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
