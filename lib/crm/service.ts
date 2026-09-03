import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  createCustomerProfileForBooking,
  type CustomerIntakeResult,
} from '@/lib/bookings/customer-intake';
import { acquireDistributedLock, releaseDistributedLock } from '@/lib/api/distributed-lock';
import { isRateLimited } from '@/lib/api/rate-limit';
import { createNotification } from '@/lib/notifications/service';
import { toIndianE164 } from '@/lib/utils/india-phone';
import { assertLeadStateTransition } from './lead-transition-guard';
import { sendCrmOpsAlert } from './ops-alert';
import {
  fetchMetaSheetTabs,
  isMetaSheetImportConfigured,
  mapMetaSheetRowsToCandidates,
  type MetaSheetLeadCandidate,
} from './sources/meta-sheet';
import { resolveLeadAreaSlug } from '@/lib/gaze/leads';
import {
  CRM_LEAD_OPEN_STATUSES,
  RETENTION_DEFAULT_RECOMMENDED_DAYS,
  RETENTION_LEAD_TIME_DAYS,
  RETENTION_RECOMMENDED_DAY_OPTIONS,
  type CrmLeadActivityRow,
  type CrmLeadActivityType,
  type CrmLeadRow,
  type CrmLeadSource,
  type CrmLeadStatus,
  type CrmLeadSummary,
  type CrmLeadWithCustomer,
} from './types';

// ── Errors ─────────────────────────────────────────────────────────────────────

export class CrmServiceError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'CrmServiceError';
    this.status = status;
  }
}

// ── Select helpers ─────────────────────────────────────────────────────────────
//
// crm_leads has two FKs to public.users (user_id + assigned_to), so embedded
// selects must disambiguate by FK name.

const LEAD_SELECT = [
  'id',
  'user_id',
  'source',
  'source_details',
  'status',
  'priority',
  'external_lead_id',
  'assigned_to',
  'lost_reason',
  'converted_booking_id',
  'pincode',
  'address',
  'first_contacted_at',
  'next_followup_at',
  'last_activity_at',
  'created_at',
  'updated_at',
  'customer:users!crm_leads_user_id_fkey(id, name, email, phone)',
  'assigned_user:users!crm_leads_assigned_to_fkey(id, name)',
].join(', ');

/** Normalizes a manual pincode: trimmed 6 digits, '' clears, anything else is invalid. */
export function normalizeLeadPincode(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  if (/^[0-9]{6}$/.test(trimmed)) return trimmed;
  return null;
}

const ACTIVITY_SELECT = 'id, lead_id, actor_id, activity_type, body, metadata, created_at';

const SUMMARY_SCAN_LIMIT = 5000;

type LeadEmbedRow = CrmLeadRow & {
  customer: CrmLeadWithCustomer['customer'] | null;
  assigned_user: CrmLeadWithCustomer['assigned_user'] | null;
};

function toLeadWithCustomer(row: LeadEmbedRow): CrmLeadWithCustomer {
  return {
    ...row,
    customer: row.customer ?? { id: row.user_id, name: null, email: null, phone: null },
    assigned_user: row.assigned_user ?? null,
  };
}

// ── Listing & summary ──────────────────────────────────────────────────────────

export type ListCrmLeadsOptions = {
  status?: CrmLeadStatus;
  source?: CrmLeadSource;
  priority?: 'normal' | 'hot';
  /** Staff user id, or the literal 'unassigned' for leads with no assignee. */
  assignedTo?: string | 'unassigned';
  search?: string;
  /** Bengaluru area slug (gazetteer) — matches lead area text or manual pincode. */
  area?: string;
  /** Open leads whose next follow-up is due now or overdue. */
  dueOnly?: boolean;
  limit?: number;
  offset?: number;
  /** Also resolve the filtered total row count (used by the admin list API for pagination). */
  includeTotal?: boolean;
};

export type ListCrmLeadsResult = {
  leads: CrmLeadWithCustomer[];
  /**
   * Filtered total row count. Null when `includeTotal` was not requested or the
   * count query failed — the pagination UI degrades gracefully in that case.
   */
  total: number | null;
};

export async function listCrmLeads(
  supabase: SupabaseClient,
  options: ListCrmLeadsOptions = {},
): Promise<ListCrmLeadsResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 5000);
  const offset = Math.max(options.offset ?? 0, 0);

  let userFilterIds: string[] | null = null;

  if (options.search) {
    // Search customers first (proven pattern from app/api/bookings/search-user)
    // instead of relying on embedded or-filters, then constrain leads by user_id.
    const queryLike = `%${options.search.replace(/[%(),]/g, '')}%`;
    const { data: matchingUsers, error: userError } = await supabase
      .from('users')
      .select('id')
      .or(`name.ilike.${queryLike},email.ilike.${queryLike},phone.ilike.${queryLike}`)
      .limit(50);

    if (userError) {
      throw new CrmServiceError('Unable to search leads right now.');
    }

    userFilterIds = (matchingUsers ?? []).map((row: { id: string }) => row.id);
    if (userFilterIds.length === 0) {
      return { leads: [], total: 0 };
    }
  }

  // Single source of truth for the list filters. Applied to both the page query
  // and (when requested) the exact-count query, so the pagination total always
  // matches exactly what the same filters would return.
  const buildFilteredQuery = (select: string, forExactCount: boolean) => {
    let query = supabase
      .from('crm_leads')
      .select(select, forExactCount ? { count: 'exact', head: true } : undefined);

    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.source) {
      query = query.eq('source', options.source);
    }
    if (options.priority) {
      query = query.eq('priority', options.priority);
    }
    if (options.assignedTo === 'unassigned') {
      query = query.is('assigned_to', null);
    } else if (options.assignedTo) {
      query = query.eq('assigned_to', options.assignedTo);
    }
    if (options.dueOnly) {
      const nowIso = new Date().toISOString();
      query = query
        .in('status', ['new', 'contacted', 'interested', 'follow_up'])
        .not('next_followup_at', 'is', null)
        .lte('next_followup_at', nowIso);
    }
    if (userFilterIds) {
      query = query.in('user_id', userFilterIds);
    }
    return query;
  };

  // Area filter (B4 deep links): the gazetteer match cannot run in SQL, so
  // fetch the full filtered set (bounded), match server-side with the same
  // chain the Gaze lead layer uses, then paginate in memory.
  if (options.area) {
    const { data: areaRows, error: areaError } = await buildFilteredQuery(LEAD_SELECT, false)
      .order('created_at', { ascending: false })
      .limit(5000)
      .returns<LeadEmbedRow[]>();

    if (areaError) {
      throw new CrmServiceError(areaError.message);
    }

    const matched = (areaRows ?? []).filter((row) => resolveLeadAreaSlug(row) === options.area);
    const pageRows = matched.slice(offset, offset + limit).map(toLeadWithCustomer);

    return { leads: pageRows, total: options.includeTotal ? matched.length : null };
  }

  const { data, error } = await buildFilteredQuery(LEAD_SELECT, false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<LeadEmbedRow[]>();

  if (error) {
    throw new CrmServiceError(error.message);
  }

  let total: number | null = null;
  if (options.includeTotal) {
    const { count, error: countError } = await buildFilteredQuery('id', true);
    if (countError) {
      // The pagination total is convenience, not correctness — degrade, never fail the list.
      console.error('[crm] Failed to count leads for pagination:', countError.message);
    } else {
      total = count ?? 0;
    }
  }

  return { leads: (data ?? []).map(toLeadWithCustomer), total };
}

export async function getCrmLeadSummary(supabase: SupabaseClient): Promise<CrmLeadSummary> {
  const { data, error } = await supabase
    .from('crm_leads')
    .select('status, priority, next_followup_at, lost_reason, created_at, first_contacted_at')
    .order('created_at', { ascending: false })
    .limit(SUMMARY_SCAN_LIMIT);

  if (error) {
    throw new CrmServiceError(error.message);
  }

  const nowIso = new Date().toISOString();
  const summary: CrmLeadSummary = {
    total: data?.length ?? 0,
    new: 0,
    contacted: 0,
    interested: 0,
    follow_up: 0,
    converted: 0,
    lost: 0,
    cancelled: 0,
    hot: 0,
    overdue_followups: 0,
    lostReasons: [],
    truncated: false,
    avgFirstResponseMinutes: null,
    medianFirstResponseMinutes: null,
    newUncontactedOver24h: 0,
  };

  const lostReasonCounts = new Map<string, number>();
  const firstResponseMinutes: number[] = [];

  for (const row of data ?? []) {
    if (row.status === 'new') summary.new += 1;
    else if (row.status === 'contacted') summary.contacted += 1;
    else if (row.status === 'interested') summary.interested += 1;
    else if (row.status === 'follow_up') summary.follow_up += 1;
    else if (row.status === 'converted') summary.converted += 1;
    else if (row.status === 'lost') {
      summary.lost += 1;
      const reason = (row.lost_reason ?? '').trim();
      if (reason) {
        lostReasonCounts.set(reason, (lostReasonCounts.get(reason) ?? 0) + 1);
      }
    }
    else if (row.status === 'cancelled') summary.cancelled += 1;

    if (row.priority === 'hot' && (CRM_LEAD_OPEN_STATUSES as readonly string[]).includes(row.status)) {
      summary.hot += 1;
    }

    if (
      (CRM_LEAD_OPEN_STATUSES as readonly string[]).includes(row.status) &&
      row.next_followup_at &&
      row.next_followup_at < nowIso
    ) {
      summary.overdue_followups += 1;
    }

    // Speed-to-lead: minutes from lead creation to first contact.
    const createdAtMs = Date.parse(row.created_at ?? '');
    const firstContactedMs = Date.parse(row.first_contacted_at ?? '');

    if (Number.isFinite(createdAtMs) && Number.isFinite(firstContactedMs)) {
      const elapsedMinutes = (firstContactedMs - createdAtMs) / 60_000;
      if (elapsedMinutes >= 0) {
        firstResponseMinutes.push(elapsedMinutes);
      }
    }

    // Aging: new leads waiting over 24h without any first contact.
    if (
      row.status === 'new' &&
      !row.first_contacted_at &&
      Number.isFinite(createdAtMs) &&
      Date.parse(nowIso) - createdAtMs > 24 * 3_600_000
    ) {
      summary.newUncontactedOver24h += 1;
    }
  }

  if (firstResponseMinutes.length > 0) {
    const totalMinutes = firstResponseMinutes.reduce((accumulator, value) => accumulator + value, 0);
    summary.avgFirstResponseMinutes = Math.round(totalMinutes / firstResponseMinutes.length);
    const sorted = [...firstResponseMinutes].sort((left, right) => left - right);
    summary.medianFirstResponseMinutes = Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0);
  }

  // Honesty at the scan cap: past SUMMARY_SCAN_LIMIT every count is a lower bound.
  summary.truncated = (data?.length ?? 0) >= SUMMARY_SCAN_LIMIT;

  summary.lostReasons = Array.from(lostReasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))
    .slice(0, 5);

  return summary;
}

// ── Lead SLA alert (speed-to-lead + overdue follow-ups) ────────────────────────

const LEAD_SLA_ALERT_COOLDOWN = { windowMs: 6 * 60 * 60_000, maxRequests: 1 } as const;

/**
 * Out-of-band lead-SLA alert driven by the abandoned-booking sweep cron (runs
 * every minute): pings Discord when follow-ups are overdue or new leads have
 * aged past 24h without contact. The shared rate-limit RPC acts as a cooldown
 * (at most one alert per 6h), consumed only when there is something to report.
 * Never throws — alerting must never break the sweep run.
 */
export async function maybeSendLeadSlaAlert(supabase: SupabaseClient): Promise<void> {
  try {
    const summary = await getCrmLeadSummary(supabase);
    const parts: string[] = [];

    if (summary.overdue_followups > 0) {
      parts.push(`${summary.overdue_followups} overdue follow-up(s)`);
    }

    if (summary.newUncontactedOver24h > 0) {
      parts.push(`${summary.newUncontactedOver24h} new lead(s) uncontacted over 24h`);
    }

    if (parts.length === 0) {
      return;
    }

    const cooldown = await isRateLimited(supabase, 'crm:alert:lead_sla', LEAD_SLA_ALERT_COOLDOWN);
    if (cooldown.limited) {
      return;
    }

    await sendCrmOpsAlert({
      level: 'warning',
      title: 'Lead SLA attention',
      message: `${parts.join(' · ')} — open the CRM to work the queue.`,
    });
  } catch (error) {
    console.error('[crm] Lead SLA alert failed:', error instanceof Error ? error.message : error);
  }
}

// ── Detail ─────────────────────────────────────────────────────────────────────

export type CrmLeadDetail = {
  lead: CrmLeadWithCustomer;
  activities: CrmLeadActivityRow[];
  converted_booking:
    | { id: number; booking_date: string; start_time: string; status: string; final_price: number | null }
    | null;
};

async function fetchLeadRow(supabase: SupabaseClient, leadId: string): Promise<LeadEmbedRow> {
  const { data, error } = await supabase
    .from('crm_leads')
    .select(LEAD_SELECT)
    .eq('id', leadId)
    .maybeSingle<LeadEmbedRow>();

  if (error) {
    throw new CrmServiceError(error.message);
  }
  if (!data) {
    throw new CrmServiceError('Lead not found.', 404);
  }

  return data;
}

export async function getCrmLeadDetail(
  supabase: SupabaseClient,
  leadId: string,
): Promise<CrmLeadDetail> {
  const leadRow = await fetchLeadRow(supabase, leadId);

  const [activitiesResult, bookingResult] = await Promise.all([
    supabase
      .from('crm_lead_activities')
      .select(ACTIVITY_SELECT)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<CrmLeadActivityRow[]>(),
    leadRow.converted_booking_id
      ? supabase
          .from('bookings')
          .select('id, booking_date, start_time, status, final_price')
          .eq('id', leadRow.converted_booking_id)
          .maybeSingle<CrmLeadDetail['converted_booking']>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (activitiesResult.error) {
    throw new CrmServiceError(activitiesResult.error.message);
  }
  if (bookingResult.error) {
    throw new CrmServiceError(bookingResult.error.message);
  }

  return {
    lead: toLeadWithCustomer(leadRow),
    activities: activitiesResult.data ?? [],
    converted_booking: bookingResult.data ?? null,
  };
}

// ── Lead creation ──────────────────────────────────────────────────────────────

export type CreateManualLeadInput = {
  actorUserId: string;
  name: string;
  phone: string;
  email?: string;
  source: Extract<CrmLeadSource, 'manual' | 'whatsapp' | 'direct' | 'referral'>;
  priority?: 'normal' | 'hot';
  assignedTo?: string | null;
  sourceDetails?: Record<string, unknown>;
  note?: string;
  pincode?: string;
  address?: string;
  request?: Request;
};

export type CreateManualLeadResult = {
  lead: CrmLeadWithCustomer;
  isNewCustomer: boolean;
  inviteSent: boolean;
};

export async function createManualLead(
  supabase: SupabaseClient,
  input: CreateManualLeadInput,
): Promise<CreateManualLeadResult> {
  // Customer identity is resolved through the same intake pipeline used by the
  // booking flow: normalized phone (users.phone has a unique constraint) then
  // email. Repeat enquiries attach to the existing user — never a second customer.
  const intake: CustomerIntakeResult = await createCustomerProfileForBooking(supabase, {
    actorUserId: input.actorUserId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    noEmailInvite: !input.email,
    duplicateMode: 'return-existing',
    auditSource: 'crm_manual_lead',
    request: input.request,
  });

  // Assignment: explicit (validated admin/staff) or least-loaded auto-assign.
  let assignedTo: string | null = null;
  if (input.assignedTo) {
    assignedTo = await resolveAssignee(supabase, input.assignedTo, input.actorUserId);
  } else if (isLeadAutoAssignEnabled()) {
    assignedTo = await pickAutoAssignee(supabase);
  }

  const insertPayload = {
    user_id: intake.user.id,
    source: input.source,
    source_details: { entered_by: 'admin_panel', ...(input.sourceDetails ?? {}) },
    status: 'new' as const,
    priority: input.priority ?? 'normal',
    assigned_to: assignedTo,
    pincode: normalizeLeadPincode(input.pincode) || null,
    address: input.address?.trim() || null,
  };

  const { data: leadRow, error: leadError } = await supabase
    .from('crm_leads')
    .insert(insertPayload)
    .select(LEAD_SELECT)
    .single<LeadEmbedRow>();

  if (leadError || !leadRow) {
    throw new CrmServiceError(leadError?.message ?? 'Unable to create lead right now.');
  }

  const activityRows = [
    {
      lead_id: leadRow.id,
      actor_id: input.actorUserId,
      activity_type: 'created' as const,
      body: `Lead created (source: ${input.source}${intake.isNewUser ? ', new customer' : ', existing customer'}).`,
      metadata: { source: input.source, is_new_customer: intake.isNewUser },
    },
    ...(input.note
      ? [
          {
            lead_id: leadRow.id,
            actor_id: input.actorUserId,
            activity_type: 'note' as const,
            body: input.note,
            metadata: {},
          },
        ]
      : []),
    ...(assignedTo
      ? [
          {
            lead_id: leadRow.id,
            actor_id: input.actorUserId,
            activity_type: 'assignment' as const,
            body: assignedTo === input.assignedTo ? 'Lead assigned during creation.' : 'Lead auto-assigned (least-loaded staff).',
            metadata: { assigned_to: assignedTo },
          },
        ]
      : []),
  ];

  const { error: activityError } = await supabase
    .from('crm_lead_activities')
    .insert(activityRows);

  if (activityError) {
    // Lead exists but timeline insert failed — surface it rather than fail silently.
    throw new CrmServiceError(`Lead created, but activity log failed: ${activityError.message}`);
  }

  if (assignedTo) {
    await notifyAssignee(supabase, assignedTo, {
      id: leadRow.id,
      name: intake.user.name,
      source: input.source,
    });
  }

  void sendCrmOpsAlert({
    level: 'info',
    title: 'New CRM lead',
    message: `Lead created via ${input.source.replace(/_/g, ' ')}${assignedTo ? ' and assigned' : ' (unassigned)'}.`,
  });

  return {
    lead: toLeadWithCustomer(leadRow),
    isNewCustomer: intake.isNewUser,
    inviteSent: intake.inviteSent,
  };
}

// ── Lead updates ───────────────────────────────────────────────────────────────

export type UpdateCrmLeadInput = {
  actorUserId: string;
  status?: CrmLeadStatus;
  lostReason?: string;
  assignedTo?: string | 'self';
  nextFollowupAt?: string | null;
  convertedBookingId?: number;
  pincode?: string;
  address?: string;
  priority?: 'normal' | 'hot';
};

async function resolveAssignee(
  supabase: SupabaseClient,
  assignedTo: string | 'self',
  actorUserId: string,
): Promise<string> {
  const assigneeId = assignedTo === 'self' ? actorUserId : assignedTo;

  const { data: assignee, error } = await supabase
    .from('users')
    .select('id, name, roles(name)')
    .eq('id', assigneeId)
    .maybeSingle<{ id: string; name: string | null; roles?: { name?: string | null } | Array<{ name?: string | null }> }>();

  if (error || !assignee) {
    throw new CrmServiceError('Assignee not found.', 404);
  }

  const roleRow = Array.isArray(assignee.roles) ? assignee.roles[0] : assignee.roles;
  const roleName = roleRow?.name ?? null;
  if (roleName !== 'admin' && roleName !== 'staff') {
    throw new CrmServiceError('Leads can only be assigned to admin or staff users.', 400);
  }

  return assignee.id;
}

// First contact is stamped the first time a lead moves into a working state.
function impliesFirstContact(current: LeadEmbedRow, nextStatus: CrmLeadStatus): boolean {
  const workingStates: readonly string[] = ['contacted', 'interested', 'follow_up'];
  return workingStates.includes(nextStatus) && current.first_contacted_at === null;
}

// ── Salesperson assignment engine (Phase 2) ─────────────────────────────────────

/**
 * Auto-assignment is OFF by default: new leads (sheet imports, website
 * enquiries, abandoned-booking hot leads, and manual leads without an
 * explicit assignee) are created UNASSIGNED (owner decision 2026-09-03).
 * Opt back in explicitly via CRM_LEAD_AUTO_ASSIGN=true — only the exact
 * value "true" (case/whitespace tolerant) enables it.
 */
export function isLeadAutoAssignEnabled() {
  return (process.env.CRM_LEAD_AUTO_ASSIGN ?? 'false').trim().toLowerCase() === 'true';
}

/**
 * Pure decision core: pick the staff user with the fewest open leads
 * (ties resolve to the earliest-created staff member for stability).
 */
export function pickLeastLoadedAssignee(
  staff: ReadonlyArray<{ id: string; createdAt: string }>,
  openLeadCounts: ReadonlyMap<string, number>,
): string | null {
  let winner: { id: string; createdAt: string } | null = null;
  let winnerCount = Number.POSITIVE_INFINITY;

  for (const member of staff) {
    const count = openLeadCounts.get(member.id) ?? 0;
    if (count < winnerCount || (count === winnerCount && winner !== null && member.createdAt < winner.createdAt)) {
      winner = member;
      winnerCount = count;
    }
  }

  return winner?.id ?? null;
}

export type CrmStaffUser = { id: string; name: string };

/** Admin/staff users eligible for lead assignment. */
export async function listCrmStaffUsers(supabase: SupabaseClient): Promise<CrmStaffUser[]> {
  const { data: roleRows } = await supabase.from('roles').select('id').in('name', ['admin', 'staff']);
  const roleIds = (roleRows ?? []).map((row: { id: number }) => row.id);
  if (roleIds.length === 0) {
    return [];
  }

  const { data: userRows, error } = await supabase
    .from('users')
    .select('id, name')
    .in('role_id', roleIds)
    .order('created_at', { ascending: true })
    .limit(100)
    .returns<Array<{ id: string; name: string | null }>>();

  if (error) {
    throw new CrmServiceError('Unable to load staff users right now.');
  }

  return (userRows ?? []).map((row) => ({ id: row.id, name: row.name ?? 'Staff' }));
}

/** Least-loaded auto-assignee among admin/staff (null when none exist). */
async function pickAutoAssignee(supabase: SupabaseClient): Promise<string | null> {
  const staff = await listCrmStaffUsers(supabase);
  if (staff.length === 0) {
    return null;
  }

  const { data: openLeadRows } = await supabase
    .from('crm_leads')
    .select('assigned_to, created_at')
    .in('status', ['new', 'contacted', 'interested', 'follow_up'])
    .not('assigned_to', 'is', null)
    .limit(5000);

  const openLeadCounts = new Map<string, number>();
  for (const row of openLeadRows ?? []) {
    const assigneeId = row.assigned_to as string | null;
    if (assigneeId) {
      openLeadCounts.set(assigneeId, (openLeadCounts.get(assigneeId) ?? 0) + 1);
    }
  }

  return pickLeastLoadedAssignee(
    // listCrmStaffUsers returns staff ordered by users.created_at ascending,
    // so the array index is a stable earliest-first tie-break surrogate.
    staff.map((member, index) => ({ id: member.id, createdAt: String(index) })),
    openLeadCounts,
  );
}

async function notifyAssignee(
  supabase: SupabaseClient,
  assigneeId: string,
  lead: { id: string; name: string | null; source: string },
) {
  // In-app notification only — never let a notification failure break lead flow.
  try {
    await createNotification(supabase, {
      userId: assigneeId,
      type: 'crm.lead_assigned',
      title: 'New lead assigned to you',
      body: `${lead.name ?? 'Pet Owner'} (${lead.source.replace(/_/g, ' ')})`,
      data: { lead_id: lead.id, source: lead.source },
    });
  } catch (error) {
    console.warn('[crm] Failed to notify lead assignee:', error instanceof Error ? error.message : error);
  }
}


export async function updateCrmLead(
  supabase: SupabaseClient,
  leadId: string,
  input: UpdateCrmLeadInput,
): Promise<CrmLeadWithCustomer> {
  const current = await fetchLeadRow(supabase, leadId);
  const update: Record<string, unknown> = { last_activity_at: new Date().toISOString() };
  const activityInserts: Array<{
    lead_id: string;
    actor_id: string;
    activity_type: CrmLeadActivityType;
    body: string;
    metadata: Record<string, unknown>;
  }> = [];

  // ── Assignment ─────────────────────────────────────────────────────────────
  if (input.assignedTo !== undefined) {
    const assigneeId = input.assignedTo === null
      ? null
      : await resolveAssignee(supabase, input.assignedTo, input.actorUserId);

    update.assigned_to = assigneeId;
    activityInserts.push({
      lead_id: leadId,
      actor_id: input.actorUserId,
      activity_type: 'assignment',
      body: assigneeId ? 'Lead assigned.' : 'Lead unassigned.',
      metadata: { assigned_to: assigneeId },
    });
  }

  // ── Follow-up scheduling ────────────────────────────────────────────────────
  if (input.nextFollowupAt !== undefined) {
    update.next_followup_at = input.nextFollowupAt ?? null;
    activityInserts.push({
      lead_id: leadId,
      actor_id: input.actorUserId,
      activity_type: 'followup_scheduled',
      body: input.nextFollowupAt ? `Follow-up scheduled for ${input.nextFollowupAt}.` : 'Follow-up schedule cleared.',
      metadata: { next_followup_at: input.nextFollowupAt ?? null },
    });
  }

  // ── Location enrichment + priority (open leads only) ────────────────────────
  const isOpenLead = (CRM_LEAD_OPEN_STATUSES as readonly string[]).includes(current.status);

  if (input.pincode !== undefined || input.address !== undefined) {
    if (!isOpenLead) {
      throw new CrmServiceError(`Cannot update location on a ${current.status} lead.`, 400);
    }

    const changes: string[] = [];

    if (input.pincode !== undefined) {
      const pincode = normalizeLeadPincode(input.pincode);
      if (pincode === null) {
        throw new CrmServiceError('Enter a valid 6-digit pincode (or leave it empty to clear).', 400);
      }
      update.pincode = pincode || null;
      if (pincode !== (current.pincode ?? '')) changes.push(`pincode → ${pincode || '(cleared)'}`);
    }

    if (input.address !== undefined) {
      const address = input.address.trim().slice(0, 500);
      update.address = address || null;
      if (address !== (current.address ?? '')) changes.push(`address → ${address || '(cleared)'}`);
    }

    if (changes.length > 0) {
      activityInserts.push({
        lead_id: leadId,
        actor_id: input.actorUserId,
        activity_type: 'location_updated',
        body: `Lead location updated: ${changes.join(', ')}.`,
        metadata: { pincode: update.pincode ?? current.pincode, address: update.address ?? current.address },
      });
    }
  }

  if (input.priority !== undefined && input.priority !== current.priority) {
    if (!isOpenLead) {
      throw new CrmServiceError(`Cannot change priority on a ${current.status} lead.`, 400);
    }

    update.priority = input.priority;
    activityInserts.push({
      lead_id: leadId,
      actor_id: input.actorUserId,
      activity_type: 'priority_changed',
      body: input.priority === 'hot' ? 'Lead marked hot.' : 'Lead priority set to normal.',
      metadata: { priority: input.priority },
    });
  }

  // ── Status transition ──────────────────────────────────────────────────────
  if (input.status !== undefined && input.status !== current.status) {
    assertLeadStateTransition(current.status, input.status);
    update.status = input.status;

    if (input.status === 'lost') {
      const reason = input.lostReason?.trim();
      if (!reason) {
        throw new CrmServiceError('A lost reason is required when marking a lead lost.', 400);
      }
      update.lost_reason = reason;
      update.next_followup_at = null;
      activityInserts.push({
        lead_id: leadId,
        actor_id: input.actorUserId,
        activity_type: 'lost',
        body: `Lead lost: ${reason}`,
        metadata: { lost_reason: reason },
      });
    }

    if (input.status === 'cancelled') {
      update.next_followup_at = null;
    }

    if (input.status === 'converted') {
      if (!input.convertedBookingId) {
        throw new CrmServiceError('A booking id is required to convert a lead.', 400);
      }

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, user_id')
        .eq('id', input.convertedBookingId)
        .maybeSingle<{ id: number; user_id: string }>();

      if (bookingError || !booking) {
        throw new CrmServiceError('Linked booking not found.', 404);
      }
      if (booking.user_id !== current.user_id) {
        throw new CrmServiceError('The linked booking belongs to a different customer.', 400);
      }

      update.converted_booking_id = booking.id;
      update.next_followup_at = null;
      activityInserts.push({
        lead_id: leadId,
        actor_id: input.actorUserId,
        activity_type: 'converted',
        body: `Lead converted to booking #${booking.id}.`,
        metadata: { booking_id: booking.id },
      });
    }

    if (impliesFirstContact(current, input.status)) {
      update.first_contacted_at = new Date().toISOString();
    }

    activityInserts.push({
      lead_id: leadId,
      actor_id: input.actorUserId,
      activity_type: 'status_change',
      body: `Status changed from ${current.status} to ${input.status}.`,
      metadata: { from: current.status, to: input.status },
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from('crm_leads')
    .update(update)
    .eq('id', leadId)
    .select(LEAD_SELECT)
    .single<LeadEmbedRow>();

  if (updateError || !updated) {
    throw new CrmServiceError(updateError?.message ?? 'Unable to update lead right now.');
  }

  if (activityInserts.length > 0) {
    const { error: activityError } = await supabase
      .from('crm_lead_activities')
      .insert(activityInserts);

    if (activityError) {
      throw new CrmServiceError(`Lead updated, but activity log failed: ${activityError.message}`);
    }
  }

  if (input.assignedTo !== undefined && typeof update.assigned_to === 'string') {
    await notifyAssignee(supabase, update.assigned_to, {
      id: current.id,
      name: current.customer?.name ?? null,
      source: current.source,
    });
  }

  if (input.priority === 'hot') {
    void sendCrmOpsAlert({
      level: 'warning',
      title: 'Hot lead flagged',
      message: `Lead for ${current.customer?.name ?? 'a customer'} (${current.source.replace(/_/g, ' ')}) was marked hot.`,
    });
  }

  return toLeadWithCustomer(updated);
}

// ── Bulk updates (B3) ──────────────────────────────────────────────────────────

export type BulkUpdateCrmLeadsAction =
  | { type: 'assign'; assignedTo: string }
  | { type: 'status'; status: CrmLeadStatus; lostReason?: string };

export type BulkUpdateCrmLeadsResult = {
  requested: number;
  updated: number;
  skipped: Array<{ leadId: string; reason: string }>;
};

/**
 * Bulk assign / bulk status for the leads worklist. Runs each lead through the
 * SAME updateCrmLead path as the per-lead modal — transition guards, activity
 * logging, assignee notifications, and hot-lead alerts all apply identically,
 * and per-lead failures are reported instead of aborting the batch.
 */
export async function bulkUpdateCrmLeads(
  supabase: SupabaseClient,
  input: { actorUserId: string; leadIds: string[]; action: BulkUpdateCrmLeadsAction },
): Promise<BulkUpdateCrmLeadsResult> {
  if (input.leadIds.length === 0) {
    throw new CrmServiceError('Select at least one lead.', 400);
  }

  if (input.leadIds.length > 100) {
    throw new CrmServiceError('Bulk updates are capped at 100 leads per run.', 400);
  }

  const result: BulkUpdateCrmLeadsResult = {
    requested: input.leadIds.length,
    updated: 0,
    skipped: [],
  };

  for (const leadId of input.leadIds) {
    try {
      await updateCrmLead(supabase, leadId, {
        actorUserId: input.actorUserId,
        ...(input.action.type === 'assign' ? { assignedTo: input.action.assignedTo } : {}),
        ...(input.action.type === 'status'
          ? { status: input.action.status, lostReason: input.action.lostReason }
          : {}),
      });
      result.updated += 1;
    } catch (error) {
      result.skipped.push({
        leadId,
        reason: error instanceof CrmServiceError ? error.message : 'Update failed.',
      });
    }
  }

  return result;
}

// ── Activities ─────────────────────────────────────────────────────────────────

export type AddLeadActivityInput = {
  actorUserId: string;
  activityType: Extract<CrmLeadActivityType, 'note' | 'call' | 'whatsapp' | 'email'>;
  body: string;
  nextFollowupAt?: string;
};

export async function addCrmLeadActivity(
  supabase: SupabaseClient,
  leadId: string,
  input: AddLeadActivityInput,
): Promise<CrmLeadActivityRow> {
  const current = await fetchLeadRow(supabase, leadId);

  if ((CRM_LEAD_OPEN_STATUSES as readonly string[]).includes(current.status) === false) {
    throw new CrmServiceError(
      `Cannot add activities to a ${current.status} lead. Create a new enquiry for this customer instead.`,
      400,
    );
  }

  const { data: activity, error } = await supabase
    .from('crm_lead_activities')
    .insert({
      lead_id: leadId,
      actor_id: input.actorUserId,
      activity_type: input.activityType,
      body: input.body,
      metadata: {},
    })
    .select(ACTIVITY_SELECT)
    .single<CrmLeadActivityRow>();

  if (error || !activity) {
    throw new CrmServiceError(error?.message ?? 'Unable to add activity right now.');
  }

  const update: Record<string, unknown> = { last_activity_at: new Date().toISOString() };

  if (input.nextFollowupAt) {
    update.next_followup_at = input.nextFollowupAt;
  }

  // Auto-advance: first logged outreach moves the lead out of `new`.
  if (current.status === 'new' && input.activityType !== 'note') {
    update.status = 'contacted';
    update.first_contacted_at = current.first_contacted_at ?? new Date().toISOString();
  }

  const { error: touchError } = await supabase.from('crm_leads').update(update).eq('id', leadId);

  if (touchError) {
    throw new CrmServiceError(`Activity saved, but lead refresh failed: ${touchError.message}`);
  }

  return activity;
}

// ── Inbound leads (Meta sheet import) ─────────────────────────────────────────

export type CreateInboundLeadResult = {
  created: boolean;
  leadId: string | null;
  isNewCustomer: boolean;
};

async function resolveSystemAuditActorUserId(supabase: SupabaseClient): Promise<string | null> {
  // Cron imports have no human actor. admin_audit_log.admin_user_id is a NOT NULL
  // FK to auth.users, so attribute automated customer creation to the first admin.
  const { data: roleRows } = await supabase
    .from('roles')
    .select('id')
    .in('name', ['admin', 'staff']);

  const roleIds = (roleRows ?? []).map((row: { id: number }) => row.id);
  if (roleIds.length === 0) {
    return null;
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .in('role_id', roleIds)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  return userRow?.id ?? null;
}

async function findExistingCustomerForInboundLead(
  supabase: SupabaseClient,
  candidate: MetaSheetLeadCandidate,
): Promise<string | null> {
  const probes: Array<{ column: string; value: string }> = [];
  if (candidate.phone) probes.push({ column: 'phone', value: candidate.phone });
  if (candidate.email) probes.push({ column: 'email', value: candidate.email });

  for (const probe of probes) {
    const { data: row, error } = await supabase
      .from('users')
      .select('id, roles(name)')
      .eq(probe.column, probe.value)
      .limit(1)
      .maybeSingle<{ id: string; roles?: { name?: string | null } | Array<{ name?: string | null }> }>();

    if (error) {
      throw new CrmServiceError(`Unable to match customer during import: ${error.message}`);
    }
    if (!row) continue;

    const roleRow = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    const roleName = roleRow?.name ?? null;
    if (roleName === 'admin' || roleName === 'staff' || roleName === 'provider') {
      // Staff/provider accounts must never become CRM customers.
      continue;
    }

    return row.id;
  }

  return null;
}

export async function createInboundLead(
  supabase: SupabaseClient,
  input: {
    candidate: MetaSheetLeadCandidate;
    actorUserId?: string;
    request?: Request;
  },
): Promise<CreateInboundLeadResult> {
  const { candidate } = input;

  // Fast idempotency check — skip before touching the customer tables.
  const { data: existingLead } = await supabase
    .from('crm_leads')
    .select('id')
    .eq('source', 'meta_lead_form')
    .eq('external_lead_id', candidate.externalLeadId)
    .maybeSingle<{ id: string }>();

  if (existingLead) {
    return { created: false, leadId: existingLead.id, isNewCustomer: false };
  }

  // Sheet leads stay UNASSIGNED by default (owner decision 2026-09-03);
  // least-loaded auto-assign is opt-in via CRM_LEAD_AUTO_ASSIGN=true.
  const assignedTo = isLeadAutoAssignEnabled() ? await pickAutoAssignee(supabase) : null;

  const existingUserId = await findExistingCustomerForInboundLead(supabase, candidate);
  let userId = existingUserId;
  let isNewCustomer = false;

  if (!userId) {
    if (!candidate.phone) {
      // Email-only row with no matching customer: the intake pipeline requires
      // an Indian phone, so this row cannot be auto-created.
      throw new CrmServiceError(
        `Email-only lead "${candidate.email}" does not match an existing customer and has no phone to create one.`,
        422,
      );
    }

    const auditActor = input.actorUserId ?? (await resolveSystemAuditActorUserId(supabase));
    if (!auditActor) {
      throw new CrmServiceError('No admin actor available to attribute the import audit entry.', 500);
    }

    const intake = await createCustomerProfileForBooking(supabase, {
      actorUserId: auditActor,
      name: candidate.name,
      phone: candidate.phone,
      email: candidate.email ?? undefined,
      noEmailInvite: !candidate.email,
      duplicateMode: 'return-existing',
      auditSource: 'crm_meta_sheet_import',
      request: input.request,
    });

    userId = intake.user.id;
    isNewCustomer = intake.isNewUser;
  }

  // Idempotent insert — the unique (source, external_lead_id) constraint protects
  // against concurrent cron runs racing on the same row.
  const { data: leadRow, error: leadError } = await supabase
    .from('crm_leads')
    .upsert(
      {
        user_id: userId,
        source: 'meta_lead_form',
        source_details: candidate.sourceDetails,
        status: 'new',
        priority: 'normal',
        external_lead_id: candidate.externalLeadId,
        assigned_to: assignedTo,
      },
      { onConflict: 'source,external_lead_id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle<{ id: string }>();

  if (leadError) {
    throw new CrmServiceError(leadError.message);
  }

  if (!leadRow) {
    // Lost a race against a concurrent import of the same lead — treat as skipped.
    return { created: false, leadId: null, isNewCustomer: false };
  }

  await supabase.from('crm_lead_activities').insert([
    {
      lead_id: leadRow.id,
      actor_id: input.actorUserId ?? null,
      activity_type: 'created',
      body: 'Lead imported from Meta lead form (Google Sheet).',
      metadata: { source: 'meta_lead_form', imported_from: 'google_sheet' },
    },
    ...(assignedTo
      ? [
          {
            lead_id: leadRow.id,
            actor_id: null as string | null,
            activity_type: 'assignment' as const,
            body: 'Lead auto-assigned (least-loaded staff).',
            metadata: { assigned_to: assignedTo },
          },
        ]
      : []),
  ]);

  if (assignedTo) {
    await notifyAssignee(supabase, assignedTo, {
      id: leadRow.id,
      name: candidate.name,
      source: 'meta_lead_form',
    });
  }

  return { created: true, leadId: leadRow.id, isNewCustomer };
}

// ── Website enquiry leads (Phase 3) ───────────────────────────────────────────

const ENQUIRY_DEDUPE_WINDOW_MINUTES = 60;

export type CreateWebsiteEnquiryLeadInput = {
  name: string;
  phone: string;
  email?: string;
  message?: string;
  petInfo?: string;
  area?: string;
  request?: Request;
};

export type CreateWebsiteEnquiryLeadResult = {
  leadId: string;
  isNewCustomer: boolean;
  duplicate: boolean;
};

export async function createWebsiteEnquiryLead(
  supabase: SupabaseClient,
  input: CreateWebsiteEnquiryLeadInput,
): Promise<CreateWebsiteEnquiryLeadResult> {
  const normalizedPhone = toIndianE164(input.phone);
  if (!normalizedPhone) {
    throw new CrmServiceError('Enter a valid Indian phone number.', 400);
  }

  // Resolve the customer through the shared intake pipeline (phone → email).
  const intake = await createCustomerProfileForBooking(supabase, {
    actorUserId: (await resolveSystemAuditActorUserId(supabase)) ?? '',
    name: input.name,
    phone: input.phone,
    email: input.email,
    noEmailInvite: !input.email,
    duplicateMode: 'return-existing',
    auditSource: 'crm_website_enquiry',
    request: input.request,
  });

  // Dedupe: an open website enquiry for the same customer within the window
  // returns the existing lead instead of creating another.
  const sinceIso = new Date(Date.now() - ENQUIRY_DEDUPE_WINDOW_MINUTES * 60_000).toISOString();
  const { data: existingLead } = await supabase
    .from('crm_leads')
    .select('id')
    .eq('user_id', intake.user.id)
    .eq('source', 'website_enquiry')
    .eq('status', 'new')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingLead) {
    return { leadId: existingLead.id, isNewCustomer: intake.isNewUser, duplicate: true };
  }

  const assignedTo = isLeadAutoAssignEnabled() ? await pickAutoAssignee(supabase) : null;

  const { data: leadRow, error: leadError } = await supabase
    .from('crm_leads')
    .insert({
      user_id: intake.user.id,
      source: 'website_enquiry',
      source_details: {
        entered_via: 'contact_us',
        message: input.message || null,
        pet_info: input.petInfo || null,
        area: input.area || null,
      },
      status: 'new',
      priority: 'normal',
      assigned_to: assignedTo,
    })
    .select('id')
    .single<{ id: string }>();

  if (leadError || !leadRow) {
    throw new CrmServiceError('Unable to submit the enquiry right now.');
  }

  await supabase.from('crm_lead_activities').insert([
    {
      lead_id: leadRow.id,
      actor_id: null,
      activity_type: 'created',
      body: `Lead received from the website enquiry form${input.message ? `: "${input.message.slice(0, 200)}"` : ''}.`,
      metadata: { source: 'website_enquiry' },
    },
    ...(assignedTo
      ? [
          {
            lead_id: leadRow.id,
            actor_id: null as string | null,
            activity_type: 'assignment' as const,
            body: 'Lead auto-assigned (least-loaded staff).',
            metadata: { assigned_to: assignedTo },
          },
        ]
      : []),
  ]);

  if (assignedTo) {
    await notifyAssignee(supabase, assignedTo, {
      id: leadRow.id,
      name: input.name,
      source: 'website_enquiry',
    });
  }

  void sendCrmOpsAlert({
    level: 'info',
    title: 'New website enquiry',
    message: `Enquiry received from the contact page${assignedTo ? ' and assigned' : ' (unassigned)'}.`,
  });

  return { leadId: leadRow.id, isNewCustomer: intake.isNewUser, duplicate: false };
}

// ── Meta sheet import runner ──────────────────────────────────────────────────

export type RunMetaSheetImportOptions = {
  triggerSource: 'admin_panel' | 'cron';
  dryRun?: boolean;
  actorUserId?: string;
  request?: Request;
};

export type RunMetaSheetImportResult = {
  dryRun: boolean;
  spreadsheetId: string;
  range: string;
  tabsScanned: number;
  tabTitles: string[];
  rowsScanned: number;
  candidatesFound: number;
  imported: number;
  skippedExisting: number;
  invalid: number;
  invalidReasons: string[];
  emptyRows: number;
  newCustomers: number;
  warnings: string[];
  preview: Array<{ name: string; phone: string | null; email: string | null; campaign: string | null; externalLeadId: string }>;
};

export type SheetImportRunRow = {
  trigger_source: 'admin_panel' | 'cron';
  status: 'success' | 'failed';
  dry_run: boolean;
  rows_scanned: number;
  rows_imported: number;
  rows_skipped: number;
  rows_invalid: number;
  rows_empty: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  metadata: Record<string, unknown>;
};

async function recordSheetImportRun(supabase: SupabaseClient, row: SheetImportRunRow) {
  const { error } = await supabase.from('crm_sheet_import_runs').insert(row);
  if (error) {
    // Run history is observability, not correctness — log loudly but never block.
    console.error('[crm] Failed to record sheet import run:', error.message);
  }
}

export async function runMetaSheetImport(
  supabase: SupabaseClient,
  options: RunMetaSheetImportOptions,
): Promise<RunMetaSheetImportResult> {
  if (!isMetaSheetImportConfigured()) {
    throw new CrmServiceError(
      'Meta sheet import is not configured. Set GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY and GOOGLE_SHEETS_LEADS_SPREADSHEET_ID.',
      503,
    );
  }

  const dryRun = options.dryRun === true;
  const lockKey = 'crm:meta_sheet_import';
  const holder = `${options.triggerSource}:${randomUUID()}`;
  const startedAt = new Date().toISOString();

  const lockAcquired = await acquireDistributedLock(supabase, { lockKey, holder, ttlSeconds: 600 });
  if (!lockAcquired) {
    throw new CrmServiceError('Import already running. Try again once the current run finishes.', 409);
  }

  try {
    const sheet = await fetchMetaSheetTabs();

    // Aggregate across every allow-listed tab (Meta syncs write per-day tabs;
    // each tab is mapped independently so per-tab header differences are handled).
    const candidates: MetaSheetLeadCandidate[] = [];
    const invalidReasons: string[] = [];
    const warnings: string[] = [];
    let rowsScanned = 0;
    let invalid = 0;
    let emptyRows = 0;

    for (const tab of sheet.tabs) {
      const mapped = mapMetaSheetRowsToCandidates(tab.headers, tab.rows);
      rowsScanned += tab.rows.length;
      invalid += mapped.invalidCount;
      emptyRows += mapped.emptyCount;
      candidates.push(...mapped.candidates);

      for (const reason of mapped.invalidReasons) {
        if (invalidReasons.length < 10) {
          invalidReasons.push(`[${tab.title}] ${reason}`);
        }
      }
      for (const warning of mapped.warnings) {
        warnings.push(`[${tab.title}] ${warning}`);
      }
    }

    const result: RunMetaSheetImportResult = {
      dryRun,
      spreadsheetId: sheet.spreadsheetId,
      range: sheet.range,
      tabsScanned: sheet.tabs.length,
      tabTitles: sheet.tabs.map((tab) => tab.title),
      rowsScanned,
      candidatesFound: candidates.length,
      imported: 0,
      skippedExisting: 0,
      invalid,
      invalidReasons,
      emptyRows,
      newCustomers: 0,
      warnings,
      preview: candidates.slice(0, 5).map((candidate) => ({
        name: candidate.name,
        phone: candidate.phone,
        email: candidate.email,
        campaign: (candidate.sourceDetails.campaign as string | null) ?? null,
        externalLeadId: candidate.externalLeadId,
      })),
    };

    if (!dryRun) {
      for (const candidate of candidates) {
        try {
          const importResult = await createInboundLead(supabase, {
            candidate,
            actorUserId: options.actorUserId,
            request: options.request,
          });

          if (importResult.created) {
            result.imported += 1;
            if (importResult.isNewCustomer) {
              result.newCustomers += 1;
            }
          } else {
            result.skippedExisting += 1;
          }
        } catch (error) {
          if (error instanceof CrmServiceError && error.status === 422) {
            // Row-level data problem (no contact info / unusable phone) — count and continue.
            result.invalid += 1;
            if (result.invalidReasons.length < 10) {
              result.invalidReasons.push(error.message);
            }
          } else {
            // Unexpected failures abort the run so the failure is visible.
            throw error;
          }
        }
      }
    }

    await recordSheetImportRun(supabase, {
      trigger_source: options.triggerSource,
      status: 'success',
      dry_run: dryRun,
      rows_scanned: result.rowsScanned,
      rows_imported: result.imported,
      rows_skipped: result.skippedExisting,
      rows_invalid: result.invalid,
      rows_empty: result.emptyRows,
      error_message: null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      metadata: {
        tabs_scanned: result.tabsScanned,
        tab_titles: result.tabTitles,
        candidates_found: result.candidatesFound,
        new_customers: result.newCustomers,
        warnings: result.warnings,
        invalid_reasons: result.invalidReasons,
      },
    });

    if (!dryRun && result.imported > 0) {
      void sendCrmOpsAlert({
        level: 'info',
        title: 'Meta sheet import complete',
        message: `Imported ${result.imported} lead(s) (${result.newCustomers} new customer(s)), ${result.skippedExisting} already in CRM, ${result.invalid} invalid.`,
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sheet import error';

    await recordSheetImportRun(supabase, {
      trigger_source: options.triggerSource,
      status: 'failed',
      dry_run: dryRun,
      rows_scanned: 0,
      rows_imported: 0,
      rows_skipped: 0,
      rows_invalid: 0,
      rows_empty: 0,
      error_message: message.slice(0, 500),
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      metadata: {},
    });

    // Ops alerting must never take the import error path down with it.
    await sendCrmOpsAlert({
      level: 'error',
      title: 'CRM Meta sheet import failed',
      message: `Trigger: ${options.triggerSource}${dryRun ? ' (dry run)' : ''}\nError: ${message}`,
    }).catch(() => undefined);

    throw error;
  } finally {
    await releaseDistributedLock(supabase, { lockKey, holder }).catch((error) => {
      console.error('[crm] Failed to release sheet import lock:', error);
    });
  }
}

// ── Abandoned booking sweep (Phase 3) ─────────────────────────────────────────

const DEFAULT_ABANDON_AFTER_MINUTES = 10;
const EXPIRE_AFTER_HOURS = 24;

/**
 * Staleness window before an active booking session counts as abandoned.
 * Tunable via CRM_ABANDON_AFTER_MINUTES (1–60) without a code change — with the
 * sweep cron every 5 minutes, a 10-minute window surfaces hot leads roughly
 * 10–15 minutes after a customer goes quiet in the booking flow.
 */
function resolveAbandonAfterMinutes(): number {
  const raw = Number(process.env.CRM_ABANDON_AFTER_MINUTES);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 60) {
    return Math.floor(raw);
  }
  return DEFAULT_ABANDON_AFTER_MINUTES;
}

export type AbandonedBookingSweepOptions = {
  triggerSource: 'admin_panel' | 'cron';
  dryRun?: boolean;
};

export type AbandonedBookingSweepResult = {
  dryRun: boolean;
  scanned: number;
  abandonedLeads: number;
  expiredSessions: number;
  skippedNoContact: number;
};

type BookingSessionRow = {
  session_key: string;
  stage: string;
  service: string | null;
  pet_count: number | null;
  preferred_date: string | null;
  area: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  user_id: string | null;
  updated_at: string;
};

/**
 * Marks stale booking sessions as abandoned and converts the ones with usable
 * contact information into HOT leads (`source = website_abandoned_booking`).
 * Idempotent per session via external_lead_id = `session:<key>`.
 */
export async function runAbandonedBookingSweep(
  supabase: SupabaseClient,
  options: AbandonedBookingSweepOptions,
): Promise<AbandonedBookingSweepResult> {
  const dryRun = options.dryRun === true;
  const lockKey = 'crm:abandoned_bookings_sweep';
  const holder = `${options.triggerSource}:${randomUUID()}`;

  const lockAcquired = await acquireDistributedLock(supabase, { lockKey, holder, ttlSeconds: 300 });
  if (!lockAcquired) {
    throw new CrmServiceError('Abandoned booking sweep already running.', 409);
  }

  try {
    const abandonBefore = new Date(Date.now() - resolveAbandonAfterMinutes() * 60_000).toISOString();
    const { data: activeSessions, error } = await supabase
      .from('crm_booking_sessions')
      .select(
        'session_key, stage, service, pet_count, preferred_date, area, contact_name, contact_phone, contact_email, user_id, updated_at',
      )
      .eq('status', 'active')
      .lt('updated_at', abandonBefore)
      .order('updated_at', { ascending: true })
      .limit(200)
      .returns<BookingSessionRow[]>();

    if (error) {
      throw new CrmServiceError(`Unable to load booking sessions: ${error.message}`);
    }

    const result: AbandonedBookingSweepResult = {
      dryRun,
      scanned: activeSessions?.length ?? 0,
      abandonedLeads: 0,
      expiredSessions: 0,
      skippedNoContact: 0,
    };

    const expireBefore = new Date(Date.now() - EXPIRE_AFTER_HOURS * 3_600_000).toISOString();

    for (const session of activeSessions ?? []) {
      const hasContact = Boolean(session.contact_phone || session.user_id);

      if (!hasContact) {
        if (session.updated_at < expireBefore) {
          result.expiredSessions += 1;
          if (!dryRun) {
            await supabase
              .from('crm_booking_sessions')
              .update({ status: 'expired' })
              .eq('session_key', session.session_key);
          }
        } else {
          result.skippedNoContact += 1;
        }
        continue;
      }

      if (dryRun) {
        result.abandonedLeads += 1;
        continue;
      }

      try {
        await convertAbandonedSessionToLead(supabase, session);
        result.abandonedLeads += 1;
      } catch (error) {
        console.warn(
          '[crm] Abandoned booking session failed to convert:',
          session.session_key,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return result;
  } finally {
    await releaseDistributedLock(supabase, { lockKey, holder }).catch((error) => {
      console.error('[crm] Failed to release abandoned booking sweep lock:', error);
    });
  }
}

async function convertAbandonedSessionToLead(supabase: SupabaseClient, session: BookingSessionRow) {
  // Resolve the customer: known user wins, otherwise match/create by phone.
  let userId = session.user_id;
  if (!userId && session.contact_phone) {
    const normalizedPhone = toIndianE164(session.contact_phone);
    if (!normalizedPhone) {
      throw new CrmServiceError('Session phone is not a valid Indian number.', 422);
    }

    const auditActor = await resolveSystemAuditActorUserId(supabase);
    if (!auditActor) {
      throw new CrmServiceError('No admin actor available for abandoned booking lead creation.', 500);
    }

    const intake = await createCustomerProfileForBooking(supabase, {
      actorUserId: auditActor,
      name: session.contact_name || 'Pet Owner',
      phone: session.contact_phone,
      email: session.contact_email || undefined,
      noEmailInvite: !session.contact_email,
      duplicateMode: 'return-existing',
      auditSource: 'crm_abandoned_booking',
    });
    userId = intake.user.id;
  }

  if (!userId) {
    throw new CrmServiceError('Session has no usable contact.', 422);
  }

  const assignedTo = isLeadAutoAssignEnabled() ? await pickAutoAssignee(supabase) : null;

  const { data: leadRow } = await supabase
    .from('crm_leads')
    .upsert(
      {
        user_id: userId,
        source: 'website_abandoned_booking',
        source_details: {
          stage: session.stage,
          service: session.service || null,
          pet_count: session.pet_count ?? null,
          preferred_date: session.preferred_date || null,
          area: session.area || null,
          entered_via: 'booking_flow',
        },
        status: 'new',
        priority: 'hot',
        external_lead_id: `session:${session.session_key}`,
        assigned_to: assignedTo,
      },
      { onConflict: 'source,external_lead_id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle<{ id: string }>();

  await supabase
    .from('crm_booking_sessions')
    .update({ status: 'abandoned', abandoned_lead_id: leadRow?.id ?? null })
    .eq('session_key', session.session_key);

  if (!leadRow) {
    return; // Lead already existed from a previous sweep.
  }

  await supabase.from('crm_lead_activities').insert([
    {
      lead_id: leadRow.id,
      actor_id: null,
      activity_type: 'created',
      body: `Hot lead: customer started booking (${session.stage.replace('-', ' ')} step) but did not complete it.`,
      metadata: { source: 'website_abandoned_booking', session_key: session.session_key },
    },
    ...(assignedTo
      ? [
          {
            lead_id: leadRow.id,
            actor_id: null as string | null,
            activity_type: 'assignment' as const,
            body: 'Lead auto-assigned (least-loaded staff).',
            metadata: { assigned_to: assignedTo },
          },
        ]
      : []),
  ]);

  if (assignedTo) {
    await notifyAssignee(supabase, assignedTo, {
      id: leadRow.id,
      name: session.contact_name,
      source: 'website_abandoned_booking',
    });
  }

  void sendCrmOpsAlert({
    level: 'warning',
    title: 'Abandoned booking — hot lead',
    message: `A customer stopped at the "${session.stage.replace('-', ' ')}" step of booking${
      session.preferred_date ? ` for ${session.preferred_date}` : ''
    }.`,
  });
}

// ── Abandoned-lead resolution on completed bookings ────────────────────────────

export type ResolveAbandonedLeadOnBookingResult = {
  resolved: boolean;
  leadId: string | null;
  outcome: 'converted' | 'cancelled' | 'none';
};

/**
 * When a customer completes a booking after their session was already swept
 * into an abandoned-booking hot lead, resolve that lead so the pipeline never
 * shows an open hot lead for a customer who already booked. Same customer →
 * converted (tied to the real booking); a booking on a different account →
 * cancelled so no stale hot lead lingers.
 */
export async function resolveAbandonedLeadOnBooking(
  supabase: SupabaseClient,
  input: { sessionKey: string; bookingId: number },
): Promise<ResolveAbandonedLeadOnBookingResult> {
  const { data: session } = await supabase
    .from('crm_booking_sessions')
    .select('session_key, abandoned_lead_id')
    .eq('session_key', input.sessionKey)
    .maybeSingle<{ session_key: string; abandoned_lead_id: string | null }>();

  const leadId = session?.abandoned_lead_id ?? null;
  if (!leadId) {
    return { resolved: false, leadId: null, outcome: 'none' };
  }

  const { data: lead } = await supabase
    .from('crm_leads')
    .select('id, status, user_id')
    .eq('id', leadId)
    .maybeSingle<{ id: string; status: CrmLeadStatus; user_id: string }>();

  if (!lead || !(CRM_LEAD_OPEN_STATUSES as readonly string[]).includes(lead.status)) {
    return { resolved: false, leadId, outcome: 'none' };
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id')
    .eq('id', input.bookingId)
    .maybeSingle<{ id: number; user_id: string }>();

  if (!booking) {
    return { resolved: false, leadId, outcome: 'none' };
  }

  if (booking.user_id === lead.user_id) {
    assertLeadStateTransition(lead.status, 'converted');
    const { error } = await supabase
      .from('crm_leads')
      .update({ status: 'converted', converted_booking_id: booking.id })
      .eq('id', leadId);
    if (error) {
      throw new CrmServiceError(`Unable to resolve abandoned-session lead: ${error.message}`);
    }

    const { error: activityError } = await supabase.from('crm_lead_activities').insert({
      lead_id: leadId,
      actor_id: null,
      activity_type: 'converted',
      body: `Customer completed booking #${booking.id} — abandoned-session lead auto-converted.`,
      metadata: { booking_id: booking.id, session_key: input.sessionKey, auto: true },
    });
    if (activityError) {
      console.warn('[crm] Auto-convert activity log failed:', activityError.message);
    }

    return { resolved: true, leadId, outcome: 'converted' };
  }

  // The booking belongs to a different account than the lead's customer —
  // close the lead instead of leaving a stale hot lead in the pipeline.
  assertLeadStateTransition(lead.status, 'cancelled');
  const { error } = await supabase
    .from('crm_leads')
    .update({ status: 'cancelled', lost_reason: 'Booked on another account' })
    .eq('id', leadId);
  if (error) {
    throw new CrmServiceError(`Unable to resolve abandoned-session lead: ${error.message}`);
  }

  const { error: activityError } = await supabase.from('crm_lead_activities').insert({
    lead_id: leadId,
    actor_id: null,
    activity_type: 'status_change',
    body: 'Booking completed on a different account — abandoned-session lead closed automatically.',
    metadata: { booking_id: booking.id, session_key: input.sessionKey, auto: true },
  });
  if (activityError) {
    console.warn('[crm] Auto-cancel activity log failed:', activityError.message);
  }

  return { resolved: true, leadId, outcome: 'cancelled' };
}

// ── Customer 360 (Phase 5) ───────────────────────────────────────────────────

export const GROOMING_RECURRENCE_DAYS = 30;

export type CrmCustomer360 = {
  user: { id: string; name: string | null; email: string | null; phone: string | null; createdAt: string | null };
  pets: Array<{ id: number; name: string; breed: string | null; sizeCategory: string | null }>;
  addresses: Array<{ pincode: string | null; city: string | null; line: string | null; isDefault: boolean }>;
  leads: CrmLeadWithCustomer[];
  bookings: Array<{
    id: number;
    bookingDate: string | null;
    startTime: string | null;
    status: string;
    serviceType: string | null;
    finalPrice: number | null;
  }>;
  paymentSummary: { paidTransactions: number; paidAmountInr: number };
  grooming: {
    completedBookings: number;
    lastGroomingDate: string | null;
    nextRecommendedDate: string | null;
    daysSinceLastGrooming: number | null;
  };
};

export async function getCrmCustomer360(supabase: SupabaseClient, userId: string): Promise<CrmCustomer360> {
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id, name, email, phone, created_at')
    .eq('id', userId)
    .maybeSingle<{ id: string; name: string | null; email: string | null; phone: string | null; created_at: string | null }>();

  if (userError || !userRow) {
    throw new CrmServiceError('Customer not found.', 404);
  }

  const [petsResult, addressesResult, leadsResult, bookingsResult, paymentsResult] = await Promise.all([
    supabase
      .from('pets')
      .select('id, name, breed, size_category')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(20)
      .returns<Array<{ id: number; name: string; breed: string | null; size_category: string | null }>>(),
    supabase
      .from('user_addresses')
      .select('pincode, city, address_line_1, is_default')
      .eq('user_id', userId)
      .limit(10)
      .returns<Array<{ pincode: string | null; city: string | null; address_line_1: string | null; is_default: boolean | null }>>(),
    supabase
      .from('crm_leads')
      .select(LEAD_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<LeadEmbedRow[]>(),
    supabase
      .from('bookings')
      .select('id, booking_date, start_time, status, service_type, final_price')
      .eq('user_id', userId)
      .order('booking_start', { ascending: false })
      .limit(20)
      .returns<
        Array<{
          id: number;
          booking_date: string | null;
          start_time: string | null;
          status: string;
          service_type: string | null;
          final_price: number | null;
        }>
      >(),
    supabase
      .from('payment_transactions')
      .select('amount_inr')
      .eq('user_id', userId)
      .eq('status', 'paid')
      .limit(500)
      .returns<Array<{ amount_inr: number }>>(),
  ]);

  const bookings = bookingsResult.data ?? [];
  const completed = bookings
    .filter((booking) => booking.status === 'completed' && booking.booking_date)
    .sort((left, right) => (right.booking_date ?? '').localeCompare(left.booking_date ?? ''));

  const lastGroomingDate = completed[0]?.booking_date ?? null;
  const nextRecommendedDate = lastGroomingDate
    ? new Date(new Date(`${lastGroomingDate}T00:00:00Z`).getTime() + GROOMING_RECURRENCE_DAYS * 86_400_000)
        .toISOString()
        .slice(0, 10)
    : null;
  const daysSinceLastGrooming = lastGroomingDate
    ? Math.floor((Date.now() - new Date(`${lastGroomingDate}T00:00:00Z`).getTime()) / 86_400_000)
    : null;

  const paidAmountInr = (paymentsResult.data ?? []).reduce((sum, row) => sum + (row.amount_inr ?? 0), 0);

  return {
    user: {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      phone: userRow.phone,
      createdAt: userRow.created_at,
    },
    pets: (petsResult.data ?? []).map((pet) => ({
      id: pet.id,
      name: pet.name,
      breed: pet.breed,
      sizeCategory: pet.size_category,
    })),
    addresses: (addressesResult.data ?? []).map((address) => ({
      pincode: address.pincode,
      city: address.city,
      line: address.address_line_1,
      isDefault: address.is_default === true,
    })),
    leads: (leadsResult.data ?? []).map(toLeadWithCustomer),
    bookings: (bookingsResult.data ?? []).map((booking) => ({
      id: booking.id,
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      status: booking.status,
      serviceType: booking.service_type,
      finalPrice: booking.final_price,
    })),
    paymentSummary: {
      paidTransactions: (paymentsResult.data ?? []).length,
      paidAmountInr,
    },
    grooming: {
      completedBookings: completed.length,
      lastGroomingDate,
      nextRecommendedDate,
      daysSinceLastGrooming,
    },
  };
}

// ── Retention candidates (Phase 6) ─────────────────────────────────────────────

export type CrmRetentionCandidate = {
  userId: string;
  name: string | null;
  phone: string | null;
  lastGroomingDate: string;
  nextRecommendedDate: string;
  daysSinceLastGrooming: number;
  completedBookings: number;
  totalSpentInr: number;
};

/**
 * Repeat customers whose last completed grooming is old enough that the next
 * recommended grooming (last completed booking + the selected cadence) is
 * approaching, without an open lead already in the pipeline. Outreach starts
 * RETENTION_LEAD_TIME_DAYS before the recommendation so the booking lands on
 * the cadence (e.g. day 25 for a 30-day recommendation, day 55 for 60).
 *
 * The exact total is derived in memory from the same filters used for the page,
 * so the UI can paginate without a second count query.
 */
export async function listRetentionCandidates(
  supabase: SupabaseClient,
  options: { recommendedDays?: number; limit?: number; offset?: number } = {},
): Promise<{ candidates: CrmRetentionCandidate[]; total: number }> {
  const requestedDays = options.recommendedDays ?? RETENTION_DEFAULT_RECOMMENDED_DAYS;
  const recommendedDays = (RETENTION_RECOMMENDED_DAY_OPTIONS as readonly number[]).includes(requestedDays)
    ? requestedDays
    : RETENTION_DEFAULT_RECOMMENDED_DAYS;
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const cutoffDays = Math.max(recommendedDays - RETENTION_LEAD_TIME_DAYS, 7);

  const { data: completedRows, error } = await supabase
    .from('bookings')
    .select('id, user_id, booking_date, final_price, price_at_booking, amount')
    .eq('status', 'completed')
    .not('booking_date', 'is', null)
    .order('booking_date', { ascending: false })
    .limit(1000)
    .returns<Array<{
      id: number;
      user_id: string;
      booking_date: string;
      final_price: number | null;
      price_at_booking: number | null;
      amount: number | null;
    }>>();

  if (error) {
    throw new CrmServiceError(`Unable to load retention candidates: ${error.message}`);
  }

  const byUser = new Map<
    string,
    { lastDate: string; completed: number; spent: number }
  >();

  for (const row of completedRows ?? []) {
    const existing = byUser.get(row.user_id);
    const value = row.final_price ?? row.price_at_booking ?? row.amount ?? 0;
    if (!existing) {
      byUser.set(row.user_id, { lastDate: row.booking_date, completed: 1, spent: value });
    } else {
      existing.completed += 1;
      existing.spent += value;
    }
  }

  const cutoff = new Date(Date.now() - cutoffDays * 86_400_000).toISOString().slice(0, 10);

  // Full due list, oldest last-grooming first — sorted before paging so every
  // page is a stable, ordered slice of the same result set.
  const dueUsers = Array.from(byUser.entries())
    .filter(([, stats]) => stats.lastDate <= cutoff)
    .sort((left, right) => left[1].lastDate.localeCompare(right[1].lastDate));

  if (dueUsers.length === 0) {
    return { candidates: [], total: 0 };
  }

  // Exclude customers with a lead already open in the pipeline.
  const { data: openLeadRows } = await supabase
    .from('crm_leads')
    .select('user_id')
    .in('user_id', dueUsers.map(([userId]) => userId))
    .in('status', ['new', 'contacted', 'interested', 'follow_up'])
    .limit(1000)
    .returns<Array<{ user_id: string }>>();

  const busyUsers = new Set((openLeadRows ?? []).map((row) => row.user_id));
  const eligibleUsers = dueUsers.filter(([userId]) => !busyUsers.has(userId));
  const total = eligibleUsers.length;

  const pageUsers = eligibleUsers.slice(offset, offset + limit);
  if (pageUsers.length === 0) {
    return { candidates: [], total };
  }

  const { data: userRows } = await supabase
    .from('users')
    .select('id, name, phone')
    .in('id', pageUsers.map(([userId]) => userId))
    .limit(pageUsers.length)
    .returns<Array<{ id: string; name: string | null; phone: string | null }>>();

  const userById = new Map((userRows ?? []).map((row) => [row.id, row]));

  const candidates = pageUsers
    .filter(([userId]) => userById.has(userId))
    .map(([userId, stats]) => ({
      userId,
      name: userById.get(userId)?.name ?? null,
      phone: userById.get(userId)?.phone ?? null,
      lastGroomingDate: stats.lastDate,
      nextRecommendedDate: new Date(
        new Date(`${stats.lastDate}T00:00:00Z`).getTime() + recommendedDays * 86_400_000,
      )
        .toISOString()
        .slice(0, 10),
      daysSinceLastGrooming: Math.floor(
        (Date.now() - new Date(`${stats.lastDate}T00:00:00Z`).getTime()) / 86_400_000,
      ),
      completedBookings: stats.completed,
      totalSpentInr: stats.spent,
    }));

  return { candidates, total };
}

// ── Campaign analytics (Phase 7) ────────────────────────────────────────────────

export type CrmCampaignPerformance = {
  campaign: string;
  campaignId: string | null;
  source: string;
  totalLeads: number;
  openLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRate: number;
  revenueInr: number;
};

export async function listCampaignPerformance(
  supabase: SupabaseClient,
  options: { sinceIso?: string } = {},
): Promise<CrmCampaignPerformance[]> {
  const { data: leadRows, error } = await supabase
    .from('crm_leads')
    .select('source, status, source_details, converted_booking_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5000)
    .returns<
      Array<{
        source: string;
        status: string;
        source_details: Record<string, unknown> | null;
        converted_booking_id: number | null;
        created_at: string;
      }>
    >();

  if (error) {
    throw new CrmServiceError(`Unable to load campaign analytics: ${error.message}`);
  }

  // B6: optional date window — campaigns are no longer all-time only.
  const windowedRows = options.sinceIso
    ? (leadRows ?? []).filter((row) => row.created_at >= (options.sinceIso ?? ''))
    : (leadRows ?? []);

  // Revenue: final prices of the bookings behind converted leads.
  const convertedBookingIds = Array.from(
    new Set(
      windowedRows
        .map((row) => row.converted_booking_id)
        .filter((id): id is number => id != null),
    ),
  );

  const priceByBookingId = new Map<number, number>();
  for (let index = 0; index < convertedBookingIds.length; index += 100) {
    const chunk = convertedBookingIds.slice(index, index + 100);
    const { data: bookingRows } = await supabase
      .from('bookings')
      .select('id, final_price')
      .in('id', chunk)
      .limit(100)
      .returns<Array<{ id: number; final_price: number | null }>>();

    for (const row of bookingRows ?? []) {
      priceByBookingId.set(row.id, row.final_price ?? 0);
    }
  }

  const byCampaign = new Map<
    string,
    CrmCampaignPerformance & { campaignKey: string }
  >();

  for (const row of windowedRows) {
    const details = row.source_details ?? {};
    const campaignName =
      typeof details.campaign === 'string' && details.campaign.trim()
        ? details.campaign.trim()
        : '(unknown campaign)';
    const campaignId = typeof details.campaign_id === 'string' && details.campaign_id.trim() ? details.campaign_id.trim() : null;
    const key = `${campaignId ?? campaignName}`;

    let stat = byCampaign.get(key);
    if (!stat) {
      stat = {
        campaignKey: key,
        campaign: campaignName,
        campaignId,
        source: row.source,
        totalLeads: 0,
        openLeads: 0,
        convertedLeads: 0,
        lostLeads: 0,
        conversionRate: 0,
        revenueInr: 0,
      };
      byCampaign.set(key, stat);
    }

    stat.totalLeads += 1;

    if ((CRM_LEAD_OPEN_STATUSES as readonly string[]).includes(row.status)) {
      stat.openLeads += 1;
    } else if (row.status === 'converted') {
      stat.convertedLeads += 1;
      stat.revenueInr += row.converted_booking_id
        ? (priceByBookingId.get(row.converted_booking_id) ?? 0)
        : 0;
    } else if (row.status === 'lost') {
      stat.lostLeads += 1;
    }
  }

  return Array.from(byCampaign.values())
    .map((stat) => ({
      campaign: stat.campaign,
      campaignId: stat.campaignId,
      source: stat.source,
      totalLeads: stat.totalLeads,
      openLeads: stat.openLeads,
      convertedLeads: stat.convertedLeads,
      lostLeads: stat.lostLeads,
      conversionRate: stat.totalLeads > 0 ? stat.convertedLeads / stat.totalLeads : 0,
      revenueInr: stat.revenueInr,
    }))
    .sort((left, right) => right.totalLeads - left.totalLeads || left.campaign.localeCompare(right.campaign));
}

// ── Leads CSV export (Phase 7) ─────────────────────────────────────────────────

export function buildLeadsCsv(leads: ReadonlyArray<CrmLeadWithCustomer>): string {
  const headers = [
    'lead_id',
    'created_at',
    'customer_id',
    'customer_name',
    'customer_phone',
    'customer_email',
    'source',
    'status',
    'priority',
    'assigned_to',
    'campaign',
    'adset',
    'ad',
    'area',
    'pincode',
    'address',
    'lost_reason',
    'next_followup_at',
  ];

  const escapeCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/"/g, '""');
    return /[",\n]/.test(text) ? `"${text}"` : text;
  };

  const rows = leads.map((lead) => {
    const details = lead.source_details as Record<string, unknown>;
    return [
      lead.id,
      lead.created_at,
      lead.user_id,
      lead.customer.name,
      lead.customer.phone,
      lead.customer.email,
      lead.source,
      lead.status,
      lead.priority,
      lead.assigned_user?.name ?? lead.assigned_to,
      details?.campaign,
      details?.adset,
      details?.ad,
      details?.city,
      lead.pincode,
      lead.address,
      lead.lost_reason,
      lead.next_followup_at,
    ].map(escapeCell);
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}









