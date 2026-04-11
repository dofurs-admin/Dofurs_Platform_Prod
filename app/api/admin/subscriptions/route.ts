import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

type SubscriptionListRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
  subscription_plans?: { name?: string | null; code?: string | null } | null;
};

type UserProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 30), 1), 200);
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

  let countQuery = supabase.from('user_subscriptions').select('*', { count: 'exact', head: true });
  let dataQuery = supabase
    .from('user_subscriptions')
    .select('id, user_id, plan_id, status, starts_at, ends_at, created_at, updated_at, subscription_plans(name, code)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    countQuery = countQuery.eq('status', status);
    dataQuery = dataQuery.eq('status', status);
  }

  const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as SubscriptionListRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter((id) => Boolean(id))));

  const { data: usersData } = userIds.length > 0
    ? await supabase
        .from('users')
        .select('id, name, email, phone')
        .in('id', userIds)
        .returns<UserProfileRow[]>()
    : { data: [] as UserProfileRow[] };

  const usersById = new Map((usersData ?? []).map((user) => [user.id, user]));
  const enrichedRows = rows.map((row) => {
    const user = usersById.get(row.user_id);
    return {
      ...row,
      user_name: user?.name ?? user?.email ?? null,
      user_email: user?.email ?? null,
      user_phone: user?.phone ?? null,
    };
  });

  const total = count ?? 0;
  return NextResponse.json({
    subscriptions: enrichedRows,
    total,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  });
}
