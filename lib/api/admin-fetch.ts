// ── Shared typed admin fetch helper ────────────────────────────────────────────
//
// One place for admin-surface request semantics: no-store caching, JSON error
// extraction, and a typed error carrying the HTTP status. Replaces the
// hand-rolled fetch/parse/throw pattern that was duplicated per admin tab.

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

export async function adminRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...init });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!response.ok) {
    throw new AdminApiError(payload?.error ?? `Request failed (HTTP ${response.status})`, response.status);
  }

  if (payload === null) {
    throw new AdminApiError('The server returned an empty response.', response.status);
  }

  return payload;
}
