import type { ApiClientConfig, ApiRequestOptions, HttpMethod } from '../types/api';
import { createIdempotencyKey } from '../utils/idempotency';
import { ApiError } from './errors';

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

function normalizePath(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return path.startsWith('/') ? path : `/${path}`;
}

async function parsePayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function isJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return contentType.includes('application/json') || contentType.includes('+json');
}

function combineAbortSignals(signals: Array<AbortSignal | undefined>) {
  const candidates = signals.filter((signal): signal is AbortSignal => Boolean(signal));

  if (candidates.length === 0) {
    return undefined;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const controller = new AbortController();

  const onAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  for (const signal of candidates) {
    if (signal.aborted) {
      onAbort();
      break;
    }

    signal.addEventListener('abort', onAbort, { once: true });
  }

  return controller.signal;
}

function toApiErrorFromFetchFailure(
  error: unknown,
  normalizedPath: string,
  timeoutMs: number,
  cancelled: boolean,
) {
  if ((error as { name?: string }).name === 'AbortError') {
    return new ApiError('API request timed out or was cancelled', 0, normalizedPath, {
      timeoutMs,
      cancelled,
    });
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('redirect')) {
    return new ApiError('Unexpected redirect response from API request', 0, normalizedPath, {
      redirected: true,
    });
  }

  return null;
}

function needsIdempotencyKey(path: string, method: HttpMethod) {
  if (method === 'GET') {
    return false;
  }

  return path.includes('/payments/') || path.includes('/bookings/create');
}

export function createApiClient(config: ApiClientConfig) {
  async function request<T>(path: string, options: ApiRequestOptions = {}) {
    const normalizedPath = normalizePath(path);
    const url = /^https?:\/\//i.test(normalizedPath) ? normalizedPath : `${config.baseUrl}${normalizedPath}`;
    const method = options.method ?? 'GET';

    const headers = new Headers(options.headers ?? {});
    headers.set('x-client-platform', config.platform);
    headers.set('x-app-version', config.appVersion);

    if (options.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (needsIdempotencyKey(normalizedPath, method) && !headers.has('x-idempotency-key')) {
      headers.set('x-idempotency-key', options.idempotencyKey ?? createIdempotencyKey('mobile'));
    }

    const applyAuthorizationHeader = async (forceRefresh = false) => {
      if (options.skipAuth) {
        return;
      }

      const accessToken = await config.getAccessToken({ forceRefresh });
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
        return;
      }

      headers.delete('Authorization');
    };

    await applyAuthorizationHeader(false);

    const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const timeoutController = timeoutMs > 0 ? new AbortController() : null;
    const requestSignal = combineAbortSignals([options.signal, timeoutController?.signal]);

    const requestInit: RequestInit = {
      method,
      headers,
      redirect: 'error',
    };

    if (requestSignal) {
      requestInit.signal = requestSignal;
    }

    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (timeoutController) {
      timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    }

    let response: Response;

    try {
      response = await fetch(url, requestInit);
    } catch (error) {
      const mappedError = toApiErrorFromFetchFailure(error, normalizedPath, timeoutMs, Boolean(options.signal?.aborted));
      throw mappedError ?? error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    if (!options.skipAuth && response.status === 401) {
      await applyAuthorizationHeader(true);

      if (timeoutController) {
        timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
      }

      try {
        response = await fetch(url, requestInit);
      } catch (error) {
        const mappedError = toApiErrorFromFetchFailure(error, normalizedPath, timeoutMs, Boolean(options.signal?.aborted));
        throw mappedError ?? error;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    if (response.redirected) {
      throw new ApiError('Unexpected redirect response from API request', response.status, normalizedPath, {
        redirected: true,
        url: response.url,
      });
    }

    if (!isJsonResponse(response)) {
      const payload = await parsePayload(response);
      throw new ApiError('Unexpected non-JSON API response', response.status, normalizedPath, payload);
    }

    const payload = await parsePayload(response);

    if (!response.ok) {
      throw new ApiError('API request failed', response.status, normalizedPath, payload);
    }

    return payload as T;
  }

  return {
    request,
    get<T>(path: string, options: Omit<ApiRequestOptions, 'method'> = {}) {
      return request<T>(path, { ...options, method: 'GET' });
    },
    post<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) {
      return request<T>(path, { ...options, body, method: 'POST' });
    },
    patch<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) {
      return request<T>(path, { ...options, body, method: 'PATCH' });
    },
    put<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) {
      return request<T>(path, { ...options, body, method: 'PUT' });
    },
    delete<T>(path: string, options: Omit<ApiRequestOptions, 'method'> = {}) {
      return request<T>(path, { ...options, method: 'DELETE' });
    },
  };
}
