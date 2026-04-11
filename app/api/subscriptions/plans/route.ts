import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';

export async function GET() {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);
  if (auth.response) return auth.response;

  const { supabase } = auth.context;

  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('id, code, name, description, duration_days, price_inr, is_active, subscription_plan_services(service_type, credits_included:credit_count)')
    .eq('is_active', true)
    .order('price_inr', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plans: plans ?? [] });
}
