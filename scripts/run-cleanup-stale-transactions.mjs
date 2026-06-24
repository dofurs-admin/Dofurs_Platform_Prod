function normalizeBaseUrl(rawUrl) {
  const trimmed = rawUrl?.trim() ?? '';
  if (!trimmed) {
    throw new Error('Missing BILLING_AUTOMATION_BASE_URL (or NEXT_PUBLIC_SITE_URL).');
  }

  return trimmed.replace(/\/+$/, '');
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

const endpoint = `${baseUrl}/api/admin/payments/cleanup-stale-transactions`;

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    ...buildAuthHeaders(secret),
  },
});

const responseText = await response.text();
const payload = parseResponsePayload(response, responseText);

if (!response.ok) {
  throw new Error(
    `Cleanup request failed (${response.status}): ${JSON.stringify(payload)}`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      endpoint,
      status: response.status,
      response: payload,
      ran_at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
