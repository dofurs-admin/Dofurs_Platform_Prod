import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';

export async function GET(request: Request) {
  const auth = await requireApiRole(['admin', 'staff']);
  if (auth.response) return auth.response;

  const { supabase } = auth.context;
  const { searchParams } = new URL(request.url);

  const action = searchParams.get('action')?.trim() ?? '';
  const entityType = searchParams.get('entityType')?.trim() ?? '';
  const adminUserId = searchParams.get('adminUserId')?.trim() ?? '';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 50), 1), 200);
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

  let query = supabase
    .from('admin_audit_log')
    .select('id, admin_user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (action) query = query.eq('action', action);
  if (entityType) query = query.eq('entity_type', entityType);
  if (adminUserId) query = query.eq('admin_user_id', adminUserId);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    entries: data ?? [],
    total,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  });
}
