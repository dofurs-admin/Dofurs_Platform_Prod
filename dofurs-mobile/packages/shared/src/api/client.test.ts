import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { ApiError } from './errors';

const originalFetch = global.fetch;

function createClient() {
  return createApiClient({
    baseUrl: 'https://api.example.com',
    platform: 'ios',
    appVersion: '1.0.0',
    getAccessToken: async () => 'token-1',
  });
}

describe('createApiClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('rejects non-json responses', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('ok', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      }),
    );

    const client = createClient();

    await expect(client.get('/api/ping')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Unexpected non-JSON API response',
      status: 200,
    });
  });

  it('maps redirect-mode fetch failures to API redirect errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('redirect mode is set to error'));

    const client = createClient();

    await expect(client.get('/api/ping')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Unexpected redirect response from API request',
      status: 0,
    });
  });

  it('times out long-running requests', async () => {
    global.fetch = vi.fn((_url, init) => {
      const signal = init?.signal as AbortSignal | null | undefined;
      return new Promise<Response>((resolve, reject) => {
        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        }

        setTimeout(() => {
          resolve(
            new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            }),
          );
        }, 1000);
      });
    }) as typeof fetch;

    const client = createClient();
    const requestPromise = client.get('/api/ping', { timeoutMs: 50 });
    const guardedPromise = requestPromise.catch((caught) => caught);

    await vi.advanceTimersByTimeAsync(100);

    const error = await guardedPromise;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: 'API request timed out or was cancelled',
      status: 0,
      endpoint: '/api/ping',
    });
  });
});