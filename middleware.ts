import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';
import { extractBearerAccessToken } from '@/lib/auth/bearer-auth';
import { type AppRole, isRoleAllowed, resolveRoleWithProviderPrecedence } from '@/lib/auth/api-auth';

const protectedRoutes = [
  '/dashboard',
  '/forms/customer-booking',
  '/api/bookings',
  '/api/storage',
  '/api/provider',
  '/api/admin',
  '/api/user',
  '/api/subscriptions',
  '/api/payments/methods',
  '/api/payments/bookings',
  '/api/payments/subscriptions',
];

type HeaderReader = Pick<Headers, 'get'>;

function isProtectedPath(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function hasBearerAuthorizationHeader(headers: HeaderReader) {
  return Boolean(extractBearerAccessToken(headers.get('authorization')));
}

export function shouldBypassProtectedApiCookieGate(pathname: string, headers: HeaderReader) {
  return pathname.startsWith('/api/') && hasBearerAuthorizationHeader(headers);
}

function isAutomationTokenRoute(pathname: string) {
  return (
    pathname === '/api/admin/billing/reminders/schedule'
    || pathname.startsWith('/api/admin/billing/reminders/schedule/')
    || pathname === '/api/admin/payments/cleanup-stale-transactions'
    || pathname.startsWith('/api/admin/payments/cleanup-stale-transactions/')
  );
}

function resolveCorsOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = new Set(['http://localhost:8081']);

  if (origin && allowedOrigins.has(origin)) {
    return origin;
  }

  return null;
}

function createCorsPreflightResponse(request: NextRequest) {
  const origin = resolveCorsOrigin(request);

  if (!origin) {
    return null;
  }

  const requestedHeaders = request.headers.get('access-control-request-headers');
  const headers = new Headers({
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-credentials': 'true',
    'access-control-max-age': '86400',
    vary: 'Origin',
  });

  headers.set(
    'access-control-allow-headers',
    requestedHeaders && requestedHeaders.trim().length > 0
      ? requestedHeaders
      : 'authorization,content-type,x-idempotency-key,x-mobile-platform,x-mobile-app-version',
  );

  return new NextResponse(null, { status: 204, headers });
}

function withCorsHeaders(request: NextRequest, response: NextResponse) {
  const origin = resolveCorsOrigin(request);

  if (!origin) {
    return response;
  }

  response.headers.set('access-control-allow-origin', origin);
  response.headers.set('access-control-allow-credentials', 'true');
  response.headers.set('vary', 'Origin');
  return response;
}

type ProviderAccountState = {
  exists: boolean;
  accountStatus: string | null;
  adminApprovalStatus: string | null;
  verificationStatus: string | null;
};

function normalizeProviderStatus(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

async function readProviderAccountState(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
) : Promise<ProviderAccountState> {
  const { data: provider } = await supabase
    .from('providers')
    .select('account_status, admin_approval_status, verification_status')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    exists: Boolean(provider),
    accountStatus: normalizeProviderStatus(provider?.account_status),
    adminApprovalStatus: normalizeProviderStatus(provider?.admin_approval_status),
    verificationStatus: normalizeProviderStatus(provider?.verification_status),
  };
}

function isInactiveProviderAccount(providerState: ProviderAccountState) {
  if (!providerState.exists) {
    return true;
  }

  if (providerState.accountStatus === 'suspended' || providerState.accountStatus === 'banned') {
    return true;
  }

  if (providerState.adminApprovalStatus === 'pending' || providerState.adminApprovalStatus === 'rejected') {
    return true;
  }

  if (providerState.verificationStatus === 'pending' || providerState.verificationStatus === 'rejected') {
    return true;
  }

  return false;
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
  const isApiRequest = pathname.startsWith('/api/');

  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    const preflightResponse = createCorsPreflightResponse(request);

    if (preflightResponse) {
      return preflightResponse;
    }
  }

  const { response, user } = await updateSession(request);

  if (isAutomationTokenRoute(pathname)) {
    return isApiRequest ? withCorsHeaders(request, response) : response;
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
    return isApiRequest ? withCorsHeaders(request, response) : response;
  }

  const hasBearerToken = shouldBypassProtectedApiCookieGate(pathname, request.headers);
  const requiredRoles = getRequiredRoles(pathname);

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));

  if (!hasAuthCookie && !hasBearerToken) {
    if (isApiRequest) {
      return withCorsHeaders(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/auth/sign-in';
    const originalSearch = request.nextUrl.search;
    signInUrl.searchParams.set('next', `${pathname}${originalSearch}`);
    return NextResponse.redirect(signInUrl);
  }

  if (hasBearerToken && !hasAuthCookie) {
    const accessToken = extractBearerAccessToken(request.headers.get('authorization'));

    if (!accessToken) {
      return withCorsHeaders(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const adminSupabase = getSupabaseAdminClient();
    const {
      data: { user: bearerUser },
      error: bearerAuthError,
    } = await adminSupabase.auth.getUser(accessToken);

    if (bearerAuthError || !bearerUser) {
      return withCorsHeaders(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const roleName = await resolveRoleWithProviderPrecedence(adminSupabase, bearerUser.id);

    if (roleName === 'provider') {
      const providerState = await readProviderAccountState(adminSupabase, bearerUser.id);

      if (isInactiveProviderAccount(providerState)) {
        return withCorsHeaders(request, NextResponse.json({ error: 'Account suspended' }, { status: 403 }));
      }
    }

    if (requiredRoles && !isRoleAllowed(roleName ?? null, requiredRoles)) {
      return withCorsHeaders(request, NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    }

    return isApiRequest ? withCorsHeaders(request, response) : response;
  }

  if (!requiredRoles || !user) {
    return isApiRequest ? withCorsHeaders(request, response) : response;
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
    const providerState = await readProviderAccountState(supabase, user.id);

    if (isInactiveProviderAccount(providerState)) {
      if (pathname.startsWith('/api/')) {
        return withCorsHeaders(request, NextResponse.json({ error: 'Account suspended' }, { status: 403 }));
      }
      const suspendedUrl = request.nextUrl.clone();
      suspendedUrl.pathname = '/auth/suspended';
      return NextResponse.redirect(suspendedUrl);
    }
  }

  if (isRoleAllowed(roleName ?? null, requiredRoles)) {
    return isApiRequest ? withCorsHeaders(request, response) : response;
  }

  if (pathname.startsWith('/api/')) {
    return withCorsHeaders(request, NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
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
    '/api/auth/:path*',
    '/api/bookings/:path*',
    '/api/storage/:path*',
    '/api/provider/:path*',
    '/api/admin/:path*',
    '/api/user/:path*',
    '/api/messages/:path*',
    '/api/notifications/:path*',
    '/api/billing/:path*',
    '/api/referrals/:path*',
    '/api/credits/:path*',
    '/api/services/:path*',
    '/api/provider-applications/:path*',
    '/api/subscriptions/:path*',
    '/api/payments/methods/:path*',
    '/api/payments/bookings/:path*',
    '/api/payments/subscriptions/:path*',
  ],
};
