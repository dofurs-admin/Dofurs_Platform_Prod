import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { logAdminAction } from '@/lib/admin/audit';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { CrmServiceError, bulkUpdateCrmLeads } from '@/lib/crm/service';
import { CRM_LEAD_STATUSES } from '@/lib/crm/types';

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };

const bulkSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('assign'), assignedTo: z.string().uuid() }),
    z.object({
      type: z.literal('status'),
      status: z.enum(CRM_LEAD_STATUSES),
      lostReason: z.string().trim().max(500).optional(),
    }),
  ]),
});

export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { user, supabase } = auth.context;

  const parsed = bulkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid bulk payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const rate = await isRateLimited(supabase, getRateLimitKey('admin:crm:leads:bulk', user.id), RATE_LIMIT);
    if (rate.limited) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
    }

    const result = await bulkUpdateCrmLeads(getSupabaseAdminClient(), {
      actorUserId: user.id,
      leadIds: parsed.data.leadIds,
      action: parsed.data.action,
    });

    await logAdminAction({
      adminUserId: user.id,
      action: 'crm.lead.bulk_update',
      entityType: 'crm_lead',
      entityId: `bulk:${result.requested}`,
      newValue: { action: parsed.data.action, requested: result.requested, updated: result.updated },
      metadata: { skipped_sample: result.skipped.slice(0, 10) },
      request,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Bulk update failed.' }, { status: 500 });
  }
}
