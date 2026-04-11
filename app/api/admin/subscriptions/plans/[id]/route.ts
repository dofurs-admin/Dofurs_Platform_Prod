import { NextRequest, NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['admin']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { id } = await params;

  const body = await req.json();
  const updates: {
    name?: string;
    code?: string;
    description?: string | null;
    price_inr?: number;
    duration_days?: number;
    is_active?: boolean;
  } = {};
  const hasServicesPayload = Array.isArray((body as { services?: unknown }).services);
  const services = hasServicesPayload
    ? ((body as { services: Array<{ service_type: string; credit_count: number }> }).services ?? [])
    : [];

  if ('name' in body && typeof body.name === 'string' && body.name.trim().length > 0) {
    updates.name = body.name.trim();
  }
  if ('code' in body && typeof body.code === 'string' && body.code.trim().length > 0) {
    updates.code = body.code.trim().toUpperCase();
  }
  if ('description' in body) {
    updates.description = typeof body.description === 'string' ? body.description.trim() : null;
  }
  if ('price_inr' in body && Number.isFinite(Number(body.price_inr))) {
    updates.price_inr = Number(body.price_inr);
  }
  if ('duration_days' in body && Number.isFinite(Number(body.duration_days))) {
    updates.duration_days = Number(body.duration_days);
  }
  if ('is_active' in body && typeof body.is_active === 'boolean') {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0 && !hasServicesPayload) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  if (hasServicesPayload) {
    if (services.length === 0) {
      return NextResponse.json({ error: 'At least one service row is required.' }, { status: 400 });
    }

    const uniqueServiceTypes = new Set<string>();
    for (const service of services) {
      if (!service?.service_type || !Number.isInteger(Number(service.credit_count)) || Number(service.credit_count) <= 0) {
        return NextResponse.json({ error: 'Each service must have a valid type and credit_count > 0.' }, { status: 400 });
      }
      if (uniqueServiceTypes.has(service.service_type)) {
        return NextResponse.json({ error: 'Duplicate service_type entries are not allowed.' }, { status: 400 });
      }
      uniqueServiceTypes.add(service.service_type);
    }
  }

  const planQuery = supabase
    .from('subscription_plans')
    .select('id, name, code, price_inr, duration_days, is_active')
    .eq('id', id);

  const { data: plan, error } = Object.keys(updates).length > 0
    ? await supabase
        .from('subscription_plans')
        .update(updates)
        .eq('id', id)
        .select('id, name, code, price_inr, duration_days, is_active')
        .single()
    : await planQuery.single();

  if (error || !plan) {
    return NextResponse.json({ error: error?.message ?? 'Plan not found.' }, { status: 404 });
  }

  if (hasServicesPayload) {
    const { error: deleteServicesError } = await supabase
      .from('subscription_plan_services')
      .delete()
      .eq('plan_id', id);

    if (deleteServicesError) {
      return NextResponse.json({ error: deleteServicesError.message }, { status: 500 });
    }

    const rows = services.map((s) => ({
      plan_id: id,
      service_type: s.service_type,
      credit_count: Number(s.credit_count),
    }));

    const { error: insertServicesError } = await supabase
      .from('subscription_plan_services')
      .insert(rows);

    if (insertServicesError) {
      return NextResponse.json({ error: insertServicesError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ plan });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['admin']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { id } = await params;

  const { data: plan, error: planLookupError } = await supabase
    .from('subscription_plans')
    .select('id, name, code')
    .eq('id', id)
    .maybeSingle();

  if (planLookupError) {
    return NextResponse.json({ error: planLookupError.message }, { status: 500 });
  }

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from('subscription_plans')
    .delete()
    .eq('id', id);

  if (deleteError) {
    if (deleteError.code === '23503') {
      return NextResponse.json(
        { error: 'This plan has linked subscriptions or payment records. Archive it instead of deleting.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
