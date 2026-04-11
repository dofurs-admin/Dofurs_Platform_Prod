import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export interface AdminAuditActionParams {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  request?: Request;
}

export async function logAdminAction(params: AdminAuditActionParams): Promise<void> {
  const { adminUserId, action, entityType, entityId, oldValue, newValue, metadata, request } = params;

  let ipAddress: string | null = null;
  let userAgent: string | null = null;

  if (request) {
    userAgent = request.headers.get('user-agent');
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const raw = forwarded ? forwarded.split(',')[0].trim() : realIp;
    // Basic IP format validation before storing
    if (raw && /^[\d.:a-fA-F]+$/.test(raw)) {
      ipAddress = raw;
    }
  }

  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from('admin_audit_log').insert({
    admin_user_id: adminUserId,
    action,
    entity_type: entityType,
    entity_id: String(entityId),
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: metadata ?? null,
  });

  if (error) {
    // Non-fatal: log to stderr but don't throw — audit failure must not block the primary action
    console.error('[audit] Failed to write audit log entry:', error.message);
  }
}
