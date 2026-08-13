import type { AppRole } from '../types/auth';
import { normalizeAppRole } from './role-policy';

type SessionUserLike = {
  id?: string | null;
  user_metadata?: {
    role?: unknown;
    app_role?: unknown;
  } | null;
};

export type SessionLike = {
  access_token?: string | null;
  user?: SessionUserLike | null;
} | null | undefined;

export type SessionLifecycleDecision =
  | {
      type: 'clear';
      nextPreviousUserId: null;
      shouldClearQuery: true;
    }
  | {
      type: 'set';
      nextPreviousUserId: string;
      shouldClearQuery: boolean;
      session: {
        accessToken: string;
        userId: string;
        role: AppRole | null;
      };
    };

export function deriveSessionLifecycleDecision(
  previousUserId: string | null,
  session: SessionLike,
): SessionLifecycleDecision {
  const accessToken = session?.access_token;
  const userId = session?.user?.id;

  if (!accessToken || !userId) {
    return {
      type: 'clear',
      nextPreviousUserId: null,
      shouldClearQuery: true,
    };
  }

  const role = normalizeAppRole(
    session?.user?.user_metadata?.role ?? session?.user?.user_metadata?.app_role ?? null,
  );

  return {
    type: 'set',
    nextPreviousUserId: userId,
    shouldClearQuery: Boolean(previousUserId && previousUserId !== userId),
    session: {
      accessToken,
      userId,
      role,
    },
  };
}
