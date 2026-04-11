import { NextResponse } from 'next/server';
import { forbidden, unauthorized } from '@/lib/auth/api-auth';
import { getApiAuthContext } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { logAdminAction } from '@/lib/admin/audit';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { role, user } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin') {
    return forbidden();
  }

  const { id: targetUserId } = await context.params;

  if (!targetUserId || !/^[0-9a-f-]{36}$/.test(targetUserId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  // Prevent self-deletion
  if (targetUserId === user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Verify target exists and is not an admin or staff
  const { data: targetUser, error: lookupError } = await admin
    .from('users')
    .select('id, email, roles(name)')
    .eq('id', targetUserId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 });
  }

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const rolesRaw = targetUser.roles as unknown as { name: string } | { name: string }[] | null;
  const targetRole = Array.isArray(rolesRaw) ? rolesRaw[0]?.name : rolesRaw?.name;
  if (targetRole === 'admin' || targetRole === 'staff') {
    return NextResponse.json(
      { error: 'Cannot delete admin or staff accounts via this endpoint' },
      { status: 403 },
    );
  }

  // Delete Supabase auth user — cascades to users table via DB trigger/FK
  const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  logSecurityEvent('warn', 'admin.action', {
    route: 'api/admin/users/[id]/delete',
    actorId: user.id,
    actorRole: role,
    targetId: targetUserId,
    message: `Admin deleted user account: ${targetUser.email}`,
  });
  void logAdminAction({ adminUserId: user.id, action: 'user.deleted', entityType: 'user', entityId: targetUserId, metadata: { email: targetUser.email }, request });

  return NextResponse.json({ success: true, deletedUserId: targetUserId });
}
