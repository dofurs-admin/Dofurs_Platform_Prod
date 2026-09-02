/**
 * Canonical production origin used as the last-resort fallback when no
 * configured site URL and no request URL are available.
 */
const CANONICAL_SITE_URL = 'https://dofurs.in';

function toSafeOrigin(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Resolves the origin that outbound links (e.g. Supabase invite email
 * redirects) should be built from.
 *
 * Prefers the explicitly configured canonical site URL so invites always land
 * on the production domain even when the admin panel is served from another
 * host (e.g. a staging/preview deployment or localhost). Falls back to the
 * request origin, then to the canonical production URL.
 */
export function resolveSiteOrigin(request?: { url?: string | null } | null): string {
  const configuredUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').trim();

  if (configuredUrl) {
    const configuredOrigin = toSafeOrigin(configuredUrl);
    if (configuredOrigin) {
      return configuredOrigin;
    }
  }

  if (request?.url) {
    const requestOrigin = toSafeOrigin(request.url);
    if (requestOrigin) {
      return requestOrigin;
    }
  }

  return CANONICAL_SITE_URL;
}