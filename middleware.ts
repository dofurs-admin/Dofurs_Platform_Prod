import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';
import { type AppRole, isRoleAllowed, resolveRoleWithProviderPrecedence } from '@/lib/auth/api-auth';

const protectedRoutes = [
  '/dashboard',
  '/forms/customer-booking',
  '/api/bookings',
  '/api/storage',
  '/api/provider',
  '/api/admin',
  '/api/user',
  '/api/payments/methods',
  '/api/payments/bookings',
  '/api/payments/subscriptions',
];

function isProtectedPath(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isSchedulerTokenRoute(pathname: string) {
  return pathname === '/api/admin/billing/reminders/schedule' || pathname.startsWith('/api/admin/billing/reminders/schedule/');
}

const roleGuards: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: '/dashboard/user', roles: ['user'] },
  { prefix: '/dashboard/provider', roles: ['provider'] },
  { prefix: '/dashboard/admin', roles: ['admin', 'staff'] },
  { prefix: '/api/provider', roles: ['provider', 'admin', 'staff'] },
  { prefix: '/api/admin', roles: ['admin', 'staff'] },
];

function getRequiredRoles(pathname: string) {
  const match = roleGuards.find((guard) => pathname === guard.prefix || pathname.startsWith(`${guard.prefix}/`));
  return match?.roles ?? null;
}

function resolveFallbackPath(role: AppRole | null) {
  if (role === 'admin' || role === 'staff') {
    return '/dashboard/admin';
  }

  if (role === 'provider') {
    return '/dashboard/provider';
  }

  return '/dashboard/user';
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const { response, user } = await updateSession(request);

  if (isSchedulerTokenRoute(pathname)) {
    return response;
  }

  // Redirect already-authenticated users away from the sign-in page
  if (pathname === '/auth/sign-in' && user) {
    const hasAuthCookie = request.cookies
      .getAll()
      .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));

    if (hasAuthCookie) {
      const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      });

      const roleName = await resolveRoleWithProviderPrecedence(supabase, user.id);
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = resolveFallbackPath(roleName ?? null);
      dashboardUrl.search = '';
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (!isProtectedPath(pathname)) {
    return response;
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));

  if (!hasAuthCookie) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/auth/sign-in';
    const originalSearch = request.nextUrl.search;
    signInUrl.searchParams.set('next', `${pathname}${originalSearch}`);
    return NextResponse.redirect(signInUrl);
  }

  const requiredRoles = getRequiredRoles(pathname);

  if (!requiredRoles || !user) {
    return response;
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const roleName = await resolveRoleWithProviderPrecedence(supabase, user.id);

  // Check if provider account is suspended
  if (roleName === 'provider') {
    const { data: provider } = await supabase
      .from('providers')
      .select('account_status')
      .eq('user_id', user.id)
      .single();

    if (provider?.account_status === 'suspended' || provider?.account_status === 'banned') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
      }
      const suspendedUrl = request.nextUrl.clone();
      suspendedUrl.pathname = '/auth/suspended';
      return NextResponse.redirect(suspendedUrl);
    }
  }

  if (isRoleAllowed(roleName ?? null, requiredRoles)) {
    return response;
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const fallbackUrl = request.nextUrl.clone();
  fallbackUrl.pathname = resolveFallbackPath(roleName ?? null);
  return NextResponse.redirect(fallbackUrl);

}

export const config = {
  matcher: [
    '/auth/sign-in',
    '/dashboard/:path*',
    '/forms/customer-booking/:path*',
    '/api/bookings/:path*',
    '/api/storage/:path*',
    '/api/provider/:path*',
    '/api/admin/:path*',
    '/api/user/:path*',
    '/api/payments/methods/:path*',
    '/api/payments/bookings/:path*',
    '/api/payments/subscriptions/:path*',
  ],
};
