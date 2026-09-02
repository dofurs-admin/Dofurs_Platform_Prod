// Cron runner for the CRM Meta sheet import.
//
// Mirrors scripts/run-billing-reminders-schedule.mjs: POSTs to the import
// endpoint with the automation secret. Schedule it every 15 minutes on Render:
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
const body = {
  dryRun: parseBoolean(process.env.CRM_SHEET_IMPORT_DRY_RUN, false),
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
const acceptConflict = parseBoolean(process.env.CRM_SHEET_IMPORT_ACCEPT_CONFLICT, true);
const ok = response.ok || (acceptConflict && response.status === 409);

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
