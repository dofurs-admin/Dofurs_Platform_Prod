// ── CRM domain types (Phase 1) ─────────────────────────────────────────────────
//
// These mirror the DB schema in infra/supabase/migrations/096_crm_leads_foundation.sql.
// The generated Supabase types (lib/supabase/database.types.ts) are not regenerated
// per-table; CRM queries therefore use explicit row types with the untyped admin client,
// matching the pattern used by lib/crm/service.ts callers.

export const CRM_LEAD_SOURCES = [
  'meta_lead_form',
  'google_ads',
  'website_enquiry',
  'website_booking',
  'website_abandoned_booking',
  'whatsapp',
  'direct',
  'referral',
  'manual',
] as const;

export type CrmLeadSource = (typeof CRM_LEAD_SOURCES)[number];

export const CRM_LEAD_STATUSES = [
  'new',
  'contacted',
  'interested',
  'follow_up',
  'converted',
  'lost',
  'cancelled',
] as const;

export type CrmLeadStatus = (typeof CRM_LEAD_STATUSES)[number];

export const CRM_LEAD_OPEN_STATUSES: readonly CrmLeadStatus[] = [
  'new',
  'contacted',
  'interested',
  'follow_up',
];

export const CRM_LEAD_ACTIVITY_TYPES = [
  'created',
  'note',
  'call',
  'whatsapp',
  'email',
  'status_change',
  'assignment',
  'followup_scheduled',
  'location_updated',
  'priority_changed',
  'converted',
  'lost',
] as const;

export type CrmLeadActivityType = (typeof CRM_LEAD_ACTIVITY_TYPES)[number];

export type CrmLeadPriority = 'normal' | 'hot';

export type CrmLeadRow = {
  id: string;
  user_id: string;
  source: CrmLeadSource;
  source_details: Record<string, unknown>;
  status: CrmLeadStatus;
  priority: CrmLeadPriority;
  external_lead_id: string | null;
  assigned_to: string | null;
  lost_reason: string | null;
  converted_booking_id: number | null;
  pincode: string | null;
  address: string | null;
  first_contacted_at: string | null;
  next_followup_at: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
};

export type CrmLeadActivityRow = {
  id: string;
  lead_id: string;
  actor_id: string | null;
  activity_type: CrmLeadActivityType;
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CrmLeadCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type CrmLeadWithCustomer = CrmLeadRow & {
  customer: CrmLeadCustomer;
  assigned_user: { id: string; name: string | null } | null;
};

export type CrmLeadSummary = {
  total: number;
  new: number;
  contacted: number;
  interested: number;
  follow_up: number;
  converted: number;
  lost: number;
  cancelled: number;
  hot: number;
  overdue_followups: number;
  lostReasons: Array<{ reason: string; count: number }>;
};

export function isCrmLeadStatus(value: unknown): value is CrmLeadStatus {
  return typeof value === 'string' && (CRM_LEAD_STATUSES as readonly string[]).includes(value);
}

export function isCrmLeadSource(value: unknown): value is CrmLeadSource {
  return typeof value === 'string' && (CRM_LEAD_SOURCES as readonly string[]).includes(value);
}
