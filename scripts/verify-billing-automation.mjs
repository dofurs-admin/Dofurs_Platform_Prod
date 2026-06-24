function normalizeBaseUrl(rawUrl) {
  const trimmed = rawUrl?.trim() ?? '';
  if (!trimmed) {
    throw new Error('Missing BILLING_AUTOMATION_BASE_URL (or NEXT_PUBLIC_SITE_URL).');
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
  const mode = (process.env.BILLING_AUTOMATION_AUTH_MODE ?? 'authorization').trim().toLowerCase();
  if (mode === 'x-token') {
    return { 'x-billing-automation-token': secret };
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

async function requestJson({ endpoint, method, body, secret }) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(secret ? buildAuthHeaders(secret) : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const payload = parseResponsePayload(response, text);

  return {
    status: response.status,
    ok: response.ok,
    payload,
  };
}

const baseUrl = normalizeBaseUrl(process.env.BILLING_AUTOMATION_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL);
const secret = process.env.BILLING_AUTOMATION_SECRET?.trim() ?? '';
const runCleanup = parseBoolean(process.env.BILLING_AUTOMATION_VERIFY_CLEANUP, false);
const acceptConflict = parseBoolean(process.env.BILLING_AUTOMATION_ACCEPT_CONFLICT, true);

const scheduleStatus = await requestJson({
  endpoint: `${baseUrl}/api/admin/billing/reminders/schedule`,
  method: 'GET',
});

if (!scheduleStatus.ok) {
  throw new Error(`Schedule status check failed (${scheduleStatus.status}).`);
}

if (!secret) {
  throw new Error('Missing BILLING_AUTOMATION_SECRET for verification requests.');
}

const dryRunRequest = {
  bucket: process.env.BILLING_AUTOMATION_VERIFY_BUCKET ?? 'all',
  channel: process.env.BILLING_AUTOMATION_VERIFY_CHANNEL ?? 'whatsapp',
  enforceCadence: parseBoolean(process.env.BILLING_AUTOMATION_VERIFY_ENFORCE_CADENCE, true),
  enforceCooldown: parseBoolean(process.env.BILLING_AUTOMATION_VERIFY_ENFORCE_COOLDOWN, true),
  dryRun: true,
};

const scheduleDryRun = await requestJson({
  endpoint: `${baseUrl}/api/admin/billing/reminders/schedule`,
  method: 'POST',
  body: dryRunRequest,
  secret,
});

const dryRunOk = scheduleDryRun.ok || (acceptConflict && scheduleDryRun.status === 409);
if (!dryRunOk) {
  throw new Error(`Schedule dry-run failed (${scheduleDryRun.status}).`);
}

let cleanupResult = null;
if (runCleanup) {
  cleanupResult = await requestJson({
    endpoint: `${baseUrl}/api/admin/payments/cleanup-stale-transactions`,
    method: 'POST',
    secret,
  });

  if (!cleanupResult.ok) {
    throw new Error(`Cleanup verification failed (${cleanupResult.status}).`);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      base_url: baseUrl,
      cleanup_executed: runCleanup,
      checks: {
        schedule_status: scheduleStatus,
        schedule_dry_run: scheduleDryRun,
        cleanup: cleanupResult,
      },
      ran_at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
