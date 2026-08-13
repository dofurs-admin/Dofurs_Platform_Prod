export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type AccessTokenResolverOptions = {
  forceRefresh?: boolean;
};

export type ApiRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  skipAuth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type ApiClientConfig = {
  baseUrl: string;
  platform: 'ios' | 'android';
  appVersion: string;
  getAccessToken: (options?: AccessTokenResolverOptions) => Promise<string | null>;
};
