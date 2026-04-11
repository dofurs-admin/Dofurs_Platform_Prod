import { randomUUID } from 'crypto';

type SecurityLogLevel = 'info' | 'warn' | 'error';

type SecurityEvent =
  | 'booking.failure'
  | 'booking.slot_conflict'
  | 'booking.client_service_fallback'
  | 'provider.rejection'
  | 'admin.action'
  | 'auth.role_denied';

type SecurityLogPayload = {
  route: string;
  actorId?: string | null;
  actorRole?: string | null;
  targetId?: string | number | null;
  message?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
};

// Generate or extract a request ID for correlation across log lines.
// Pass request?.headers.get('x-request-id') when available from the caller.
export function getOrCreateRequestId(request?: Request | null): string {
  return request?.headers.get('x-request-id') ?? request?.headers.get('x-correlation-id') ?? randomUUID();
}

export function logSecurityEvent(level: SecurityLogLevel, event: SecurityEvent, payload: SecurityLogPayload) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    requestId: payload.requestId ?? randomUUID(),
    ...payload,
  };

  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function isSlotConflictMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('bookings_overlap') || normalized.includes('slot is no longer available') || normalized.includes('overlap');
}
