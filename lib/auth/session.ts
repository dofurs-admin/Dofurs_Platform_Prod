import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { resolveRoleWithProviderPrecedence } from '@/lib/auth/api-auth';

export async function requireAuthenticatedUser(redirectPath = '/auth/sign-in') {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(redirectPath);
  }

  return { supabase, user };
}

export async function getCurrentUserRole() {
  const { supabase, user } = await requireAuthenticatedUser();
  return resolveRoleWithProviderPrecedence(supabase, user.id);
}

export async function requireRole(allowedRoles: Array<'user' | 'provider' | 'admin' | 'staff'>, fallbackPath = '/dashboard') {
  const { supabase, user } = await requireAuthenticatedUser();
  const role = await getCurrentUserRole();

  if (!role || !allowedRoles.includes(role as 'user' | 'provider' | 'admin' | 'staff')) {
    redirect(fallbackPath);
  }

  // Check if provider account is suspended/banned
  if (role === 'provider') {
    const { data: provider } = await supabase
      .from('providers')
      .select('account_status')
      .eq('user_id', user.id)
      .single();

    if (provider?.account_status === 'suspended' || provider?.account_status === 'banned') {
      redirect('/auth/suspended');
    }
  }

  return role;
}
