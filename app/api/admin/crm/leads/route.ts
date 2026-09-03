import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { logAdminAction } from '@/lib/admin/audit';
import { getRateLimitKey, isRateLimited } from '@/lib/api/rate-limit';
import { CrmServiceError, createManualLead, getCrmLeadSummary, listCrmLeads, listCrmStaffUsers } from '@/lib/crm/service';
import { isCrmLeadSource, isCrmLeadStatus } from '@/lib/crm/types';

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 60,
};

const CREATE_LEAD_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,
};

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { user, supabase } = auth.context;
  const adminClient = getSupabaseAdminClient();
  const url = new URL(request.url);

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50), 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
  const assignedTo = url.searchParams.get('assignedTo') === 'me' ? user.id : url.searchParams.get('assignedTo');
  const search = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  const dueOnly = url.searchParams.get('due') === 'true';
  const priorityParam = url.searchParams.get('priority');

  const statusParam = url.searchParams.get('status');
  const sourceParam = url.searchParams.get('source');
  const statusFilter = statusParam ? (isCrmLeadStatus(statusParam) ? statusParam : null) : undefined;
  const sourceFilter = sourceParam ? (isCrmLeadSource(sourceParam) ? sourceParam : null) : undefined;
  const areaParam = url.searchParams.get('area');
  const areaFilter = areaParam && /^[a-z0-9-]{1,80}$/.test(areaParam) ? areaParam : undefined;

  if (statusFilter === null) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }
  if (sourceFilter === null) {
    return NextResponse.json({ error: 'Invalid source filter' }, { status: 400 });
  }

  try {
    const rate = await isRateLimited(supabase, getRateLimitKey('admin:crm:leads:list', user.id), RATE_LIMIT);
    if (rate.limited) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
    }

    const [leadPage, summary, staffUsers] = await Promise.all([
      listCrmLeads(adminClient, {
        status: statusFilter,
        source: sourceFilter,
        priority: priorityParam === 'hot' || priorityParam === 'normal' ? priorityParam : undefined,
        assignedTo: assignedTo ?? undefined,
        search: search || undefined,
        dueOnly,
        area: areaFilter,
        limit,
        offset,
        includeTotal: true,
      }),
      getCrmLeadSummary(adminClient),
      listCrmStaffUsers(adminClient),
    ]);

    return NextResponse.json(
      {
        leads: leadPage.leads,
        summary,
        staffUsers,
        pagination: { limit, offset, total: leadPage.total },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to load leads right now.' }, { status: 500 });
  }
}

const createLeadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(20),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  source: z.enum(['manual', 'whatsapp', 'direct', 'referral']),
  priority: z.enum(['normal', 'hot']).default('normal'),
  note: z.string().trim().max(4000).optional(),
  pincode: z.string().trim().regex(/^[0-9]{6}$/, 'Pincode must be 6 digits').optional().or(z.literal('')),
  address: z.string().trim().max(500).optional(),
  assignedTo: z.string().uuid().optional(),
  sourceDetails: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);
  if (auth.response) return auth.response;

  const { user, supabase } = auth.context;
  const adminClient = getSupabaseAdminClient();

  const payload = await request.json().catch(() => null);
  const parsed = createLeadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid lead payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const rate = await isRateLimited(supabase, getRateLimitKey('admin:crm:leads:create', user.id), CREATE_LEAD_RATE_LIMIT);
    if (rate.limited) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
    }

    const result = await createManualLead(adminClient, {
      actorUserId: user.id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || undefined,
      source: parsed.data.source,
      priority: parsed.data.priority,
      note: parsed.data.note,
      pincode: parsed.data.pincode || undefined,
      address: parsed.data.address || undefined,
      assignedTo: parsed.data.assignedTo ?? null,
      sourceDetails: parsed.data.sourceDetails,
      request,
    });

    await logAdminAction({
      adminUserId: user.id,
      action: 'crm.lead.create',
      entityType: 'crm_lead',
      entityId: result.lead.id,
      newValue: { source: parsed.data.source, status: 'new', customer_id: result.lead.user_id },
      metadata: { is_new_customer: result.isNewCustomer },
      request,
    });

    return NextResponse.json({
      success: true,
      lead: result.lead,
      isNewCustomer: result.isNewCustomer,
      inviteSent: result.inviteSent,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : 'Lead creation failed';
    const normalized = message.toLowerCase();
    if (normalized.includes('already') || normalized.includes('exists') || normalized.includes('duplicate')) {
      return NextResponse.json({ error: 'A customer with this email or phone already exists.' }, { status: 409 });
    }
    if (normalized.includes('phone')) {
      return NextResponse.json({ error: 'Enter a valid Indian phone number.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unable to create lead right now.' }, { status: 500 });
  }
}
