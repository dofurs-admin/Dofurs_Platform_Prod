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

const baseUrl = normalizeBaseUrl(process.env.BILLING_AUTOMATION_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL);
const secret = process.env.BILLING_AUTOMATION_SECRET?.trim() ?? '';

if (!secret) {
  throw new Error('Missing BILLING_AUTOMATION_SECRET.');
}

const endpoint = `${baseUrl}/api/admin/billing/reminders/schedule`;
const body = {
  bucket: process.env.BILLING_AUTOMATION_BUCKET ?? 'all',
  channel: process.env.BILLING_AUTOMATION_CHANNEL ?? 'whatsapp',
  enforceCadence: parseBoolean(process.env.BILLING_AUTOMATION_ENFORCE_CADENCE, true),
  enforceCooldown: parseBoolean(process.env.BILLING_AUTOMATION_ENFORCE_COOLDOWN, true),
  dryRun: parseBoolean(process.env.BILLING_AUTOMATION_DRY_RUN, false),
};

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
const acceptConflict = parseBoolean(process.env.BILLING_AUTOMATION_ACCEPT_CONFLICT, true);
const ok = response.ok || (acceptConflict && response.status === 409);

if (!ok) {
  throw new Error(
    `Scheduler request failed (${response.status}): ${JSON.stringify(payload)}`,
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
