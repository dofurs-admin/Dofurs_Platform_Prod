export const INACTIVITY_COOKIE_NAME = 'dofurs_last_activity_at';

const IDLE_TIMEOUT_MINUTES = 20;

export function getInactivityTimeoutMs() {
  return IDLE_TIMEOUT_MINUTES * 60 * 1000;
}

export function isInactivityExpired(lastActivityAt: number, nowMs = Date.now()) {
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) {
    return false;
  }

  return nowMs - lastActivityAt > getInactivityTimeoutMs();
}
