import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { logAdminAction } from '@/lib/admin/audit';

type PromoteUserPayload = {
  email?: string;
  role?: 'admin' | 'provider' | 'staff';
};

export async function POST(request: Request) {
  const { role, user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin') {
    return forbidden();
  }

  const payload = (await request.json().catch(() => null)) as PromoteUserPayload | null;
  const normalizedEmail = payload?.email?.trim().toLowerCase() ?? '';
  const targetRoleName =
    payload?.role === 'provider' ? 'provider' : payload?.role === 'staff' ? 'staff' : 'admin';

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const { data: targetRole, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', targetRoleName)
    .single();

  if (roleError || !targetRole) {
    return NextResponse.json({ error: `${targetRoleName} role is not configured` }, { status: 500 });
  }

  const { data: targetUser, error: targetUserError } = await supabase
    .from('users')
    .select('id, email, role_id')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (targetUserError) {
    return NextResponse.json({ error: targetUserError.message }, { status: 500 });
  }

  if (!targetUser) {
    return NextResponse.json(
      { error: 'User profile not found. Ask the user to complete sign-up/profile first.' },
      { status: 404 },
    );
  }

  if (targetUser.role_id !== targetRole.id) {
    const { error: updateError } = await supabase
      .from('users')
      .update({ role_id: targetRole.id })
      .eq('id', targetUser.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  void logAdminAction({
    adminUserId: user.id,
    action: 'user.promoted',
    entityType: 'user',
    entityId: targetUser.id,
    newValue: { role: targetRoleName },
    metadata: { email: normalizedEmail },
    request,
  });

  return NextResponse.json({
    success: true,
    user: {
      id: targetUser.id,
      email: targetUser.email,
      role: targetRoleName,
    },
  });
}