import type { CrmLeadSource, CrmLeadStatus } from './types';

// ── Shared CRM display vocabulary ───────────────────────────────────────────────
//
// Single source of truth for source/status/activity labels across admin
// surfaces (CrmTab, GazeTab legend, palette). Sentence case reads best in
// legends and chips — keep it consistent everywhere.

export const CRM_SOURCE_LABELS: Record<CrmLeadSource, string> = {
  meta_lead_form: 'Meta lead form',
  google_ads: 'Google Ads',
  website_enquiry: 'Website enquiry',
  website_booking: 'Website booking',
  website_abandoned_booking: 'Abandoned booking',
  whatsapp: 'WhatsApp',
  direct: 'Direct',
  referral: 'Referral',
  manual: 'Manual',
};

export const CRM_STATUS_LABELS: Record<CrmLeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  follow_up: 'Follow-up',
  converted: 'Converted',
  lost: 'Lost',
  cancelled: 'Cancelled',
};

export const CRM_ACTIVITY_LABELS: Record<string, string> = {
  created: 'Created',
  note: 'Note',
  call: 'Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  status_change: 'Status',
  assignment: 'Assignment',
  followup_scheduled: 'Follow-up',
  converted: 'Converted',
  lost: 'Lost',
};

export const CRM_LOST_REASON_OPTIONS = [
  'No response',
  'Price too high',
  'Booked elsewhere',
  'Out of coverage area',
  'Not interested',
  'Other',
] as const;

/** Formats a lead timestamp as a short IST date-time for admin surfaces. */
export function formatLeadTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
