import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { logAdminAction } from '@/lib/admin/audit';
import { CrmServiceError, addCrmLeadActivity } from '@/lib/crm/service';

type RouteContext = { params: Promise<{ id: string }> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const activitySchema = z.object({
  activityType: z.enum(['note', 'call', 'whatsapp', 'email']),
  body: z.string().trim().min(1).max(4000),
  nextFollowupAt: z.string().datetime().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { user } = auth.context;
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = activitySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid activity payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const activity = await addCrmLeadActivity(getSupabaseAdminClient(), id, {
      actorUserId: user.id,
      activityType: parsed.data.activityType,
      body: parsed.data.body,
      nextFollowupAt: parsed.data.nextFollowupAt,
    });

    await logAdminAction({
      adminUserId: user.id,
      action: `crm.lead.activity.${parsed.data.activityType}`,
      entityType: 'crm_lead',
      entityId: id,
      newValue: { activity_type: parsed.data.activityType },
      request,
    });

    return NextResponse.json({ success: true, activity }, { status: 201 });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to add activity right now.' }, { status: 500 });
  }
}
