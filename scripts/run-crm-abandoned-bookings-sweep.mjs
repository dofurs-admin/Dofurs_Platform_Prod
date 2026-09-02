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
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...buildAuthHeaders(secret) },
  body: JSON.stringify({ dryRun: false }),
});

const payload = await response.json().catch(() => ({ raw: await response.text() }));
const ok = response.ok || response.status === 409;

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
