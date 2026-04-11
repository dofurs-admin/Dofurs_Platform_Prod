import { NextRequest, NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function GET() {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();

  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('id, code, name, description, duration_days, price_inr, is_active, subscription_plan_services(service_type, credit_count)')
    .order('price_inr', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plans: plans ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole(['admin']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();

  const body = await req.json();
  const { name, code, description, price_inr, duration_days, services } = body as {
    name: string;
    code: string;
    description?: string;
    price_inr: number;
    duration_days: number;
    services: Array<{ service_type: string; credit_count: number }>;
  };

  if (!name || !code || !price_inr || !duration_days) {
    return NextResponse.json({ error: 'name, code, price_inr, and duration_days are required.' }, { status: 400 });
  }

  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .insert({ name, code, description: description ?? null, price_inr, duration_days, is_active: true })
    .select('id, name, code, price_inr, duration_days, is_active')
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: planError?.message ?? 'Failed to create plan.' }, { status: 500 });
  }

  if (Array.isArray(services) && services.length > 0) {
    const rows = services.map((s) => ({
      plan_id: plan.id,
      service_type: s.service_type,
      credit_count: s.credit_count,
    }));
    const { error: svcError } = await supabase.from('subscription_plan_services').insert(rows);
    if (svcError) {
      return NextResponse.json({ error: svcError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ plan }, { status: 201 });
}
