import { headers } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export type BearerAuthResult = {
  accessToken: string | null;
  user: User | null;
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function extractBearerAccessToken(authorizationHeader: string | null | undefined) {
  if (!hasText(authorizationHeader)) {
    return null;
  }

  const [scheme, ...rest] = authorizationHeader.trim().split(/\s+/);

  if (scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}

async function resolveAuthorizationHeader(candidate?: string | null) {
  if (hasText(candidate)) {
    return candidate;
  }

  try {
    const headerStore = await headers();
    return headerStore.get('authorization');
  } catch {
    return null;
  }
}

export async function resolveBearerAuthUser(authorizationHeader?: string | null): Promise<BearerAuthResult> {
  const headerValue = await resolveAuthorizationHeader(authorizationHeader);
  const accessToken = extractBearerAccessToken(headerValue);

  if (!accessToken) {
    return {
      accessToken: null,
      user: null,
    };
  }

  const adminSupabase = getSupabaseAdminClient();
  const {
    data: { user },
    error,
  } = await adminSupabase.auth.getUser(accessToken);

  if (error || !user) {
    return {
      accessToken: null,
      user: null,
    };
  }

  return {
    accessToken,
    user,
  };
}
