import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { logAdminAction } from '@/lib/admin/audit';
import { CrmServiceError, getCrmLeadDetail, updateCrmLead } from '@/lib/crm/service';
import { CRM_LEAD_STATUSES } from '@/lib/crm/types';

type RouteContext = { params: Promise<{ id: string }> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const detail = await getCrmLeadDetail(getSupabaseAdminClient(), id);
    return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to load lead right now.' }, { status: 500 });
  }
}

const updateLeadSchema = z.object({
  status: z.enum(CRM_LEAD_STATUSES).optional(),
  lostReason: z.string().trim().max(500).optional(),
  assignedTo: z.string().uuid().or(z.literal('self')).optional(),
  nextFollowupAt: z.string().datetime().nullable().optional(),
  convertedBookingId: z.number().int().positive().optional(),
  pincode: z.string().trim().regex(/^[0-9]{6}$/, 'Pincode must be 6 digits').optional().or(z.literal('')),
  address: z.string().trim().max(500).nullable().optional(),
  priority: z.enum(['normal', 'hot']).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateLeadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid lead update payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const lead = await updateCrmLead(getSupabaseAdminClient(), id, {
      actorUserId: user.id,
      status: parsed.data.status,
      lostReason: parsed.data.lostReason,
      assignedTo: parsed.data.assignedTo,
      nextFollowupAt: parsed.data.nextFollowupAt ?? undefined,
      convertedBookingId: parsed.data.convertedBookingId,
      pincode: parsed.data.pincode,
      address: parsed.data.address ?? undefined,
      priority: parsed.data.priority,
    });

    await logAdminAction({
      adminUserId: user.id,
      action: 'crm.lead.update',
      entityType: 'crm_lead',
      entityId: id,
      newValue: {
        status: parsed.data.status,
        assigned_to: parsed.data.assignedTo,
        next_followup_at: parsed.data.nextFollowupAt,
        converted_booking_id: parsed.data.convertedBookingId,
      },
      request,
    });

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.name === 'Error' && error.message.startsWith('INVALID_CRM_LEAD_TRANSITION')) {
      return NextResponse.json({ error: 'That status change is not allowed from the current lead status.' }, { status: 409 });
    }
    if (error instanceof Error && error.message.startsWith('CRM_LEAD_STATUS_NOOP')) {
      return NextResponse.json({ error: 'Lead is already in that status.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Unable to update lead right now.' }, { status: 500 });
  }
}
