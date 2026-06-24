import type { ApiClientConfig, ApiRequestOptions, HttpMethod } from '../types/api';
import { createIdempotencyKey } from '../utils/idempotency';
import { ApiError } from './errors';

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

    const requestInit: RequestInit = {
      method,
      headers,
    };

    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    let response = await fetch(url, requestInit);

    if (!options.skipAuth && response.status === 401) {
      await applyAuthorizationHeader(true);
      response = await fetch(url, requestInit);
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
