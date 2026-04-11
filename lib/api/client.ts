export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

function buildFetchInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  };
}

function extractErrorMessage(payload: { error?: unknown; message?: unknown } | null): string {
  const candidate = payload?.error ?? payload?.message;

  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim();
  }

  if (candidate && typeof candidate === 'object' && 'message' in candidate) {
    const nestedMessage = (candidate as { message?: unknown }).message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) {
      return nestedMessage.trim();
    }
  }

  return 'Request failed';
}

/**
 * On a 401, attempt a single client-side auth session refresh and retry.
 * This handles the common SSR edge-case where the server component consumed
 * the refresh token but failed to persist the new cookies (read-only context).
 */
async function tryRefreshAndRetry<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<T | null> {
  if (typeof window === 'undefined') return null;

  try {
    const { getSupabaseBrowserClient } = await import('@/lib/supabase/browser-client');
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return null;

    const retryResponse = await fetch(input, buildFetchInit(init));
    const retryPayload = (await retryResponse.json().catch(() => null)) as {
      error?: unknown;
      message?: unknown;
    } | null;

    if (!retryResponse.ok) return null;
    return retryPayload as T;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, buildFetchInit(init));

  const payload = (await response.json().catch(() => null)) as { error?: unknown; message?: unknown } | null;

  if (!response.ok) {
    // On 401, try refreshing the browser auth session and retry once.
    if (response.status === 401) {
      const retryResult = await tryRefreshAndRetry<T>(input, init);
      if (retryResult !== null) return retryResult;
    }

    throw new ApiClientError(extractErrorMessage(payload), response.status);
  }

  return payload as T;
}
