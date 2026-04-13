import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getISTTimestamp } from '@/lib/utils/date';

function isSafeRedirectPath(next: string): boolean {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return false;
  try {
    const parsed = new URL(next, 'http://localhost');
    // Only allow paths under known safe prefixes — no external redirects via query params
    const pathname = parsed.pathname;
    const safePrefixes = ['/dashboard', '/forms/', '/services', '/search', '/about', '/blog', '/faqs', '/contact-us', '/refer-and-earn'];
    return safePrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
  const url = new URL(request.url);
  const rawNext = url.searchParams.get('next') || '';
  const next = isSafeRedirectPath(rawNext) ? rawNext : '/dashboard';
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  const redirectUrl = new URL(next, url.origin);
  const isSignUpFlow =
    redirectUrl.pathname === '/auth/sign-up' ||
    (redirectUrl.pathname === '/auth/sign-in' && redirectUrl.searchParams.get('mode') === 'signup');
  const authPageUrl = new URL('/auth/sign-in', url.origin);

  if (isSignUpFlow) {
    authPageUrl.searchParams.set('mode', 'signup');
  }

  if (!isSignUpFlow && next) {
    authPageUrl.searchParams.set('next', next);
  }

  const supabase = await getSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      authPageUrl.searchParams.set('error_code', 'exchange_failed');
      authPageUrl.searchParams.set('error_description', error.message);
      return NextResponse.redirect(authPageUrl);
    }
  } else if (tokenHash && type === 'email') {
    const { error } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: tokenHash,
    });

    if (error) {
      authPageUrl.searchParams.set('error_code', 'otp_invalid');
      authPageUrl.searchParams.set('error_description', error.message);
      return NextResponse.redirect(authPageUrl);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    authPageUrl.searchParams.set('error_code', 'auth_session_missing');
    authPageUrl.searchParams.set('error_description', 'Email link is invalid or has expired. Request a new link.');
    return NextResponse.redirect(authPageUrl);
  }

  if (isSignUpFlow) {
    const signupName = (user.user_metadata?.name as string | undefined)?.trim();
    const signupPhone = (user.user_metadata?.phone as string | undefined)?.trim();
    const signupEmail = user.email?.trim().toLowerCase();

    if (!signupName || !signupPhone || !signupEmail) {
      authPageUrl.searchParams.set('error_code', 'signup_profile_missing');
      authPageUrl.searchParams.set('error_description', 'Missing signup details. Please start signup again.');
      return NextResponse.redirect(authPageUrl);
    }

    const completeProfileResponse = await fetch(new URL('/api/auth/complete-profile', url.origin), {
      method: 'POST',
      headers: {
        cookie: request.headers.get('cookie') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: signupName,
        email: signupEmail,
        phone: signupPhone,
      }),
      cache: 'no-store',
    });

    if (!completeProfileResponse.ok) {
      const payload = (await completeProfileResponse.json().catch(() => ({}))) as { error?: string };
      authPageUrl.searchParams.set('error_code', 'signup_profile_failed');
      authPageUrl.searchParams.set(
        'error_description',
        payload.error || 'Could not create your profile. Please try signup again.',
      );
      return NextResponse.redirect(authPageUrl);
    }

    const bootstrapResponse = await fetch(new URL('/api/auth/bootstrap-profile', url.origin), {
      method: 'POST',
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    });

    if (!bootstrapResponse.ok) {
      authPageUrl.searchParams.set('error_code', 'bootstrap_failed');
      authPageUrl.searchParams.set('error_description', 'Could not initialize your profile. Please sign in again.');
      return NextResponse.redirect(authPageUrl);
    }

    return NextResponse.redirect(new URL('/dashboard', url.origin));
  }

  const bootstrapResponse = await fetch(new URL('/api/auth/bootstrap-profile', url.origin), {
    method: 'POST',
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
    cache: 'no-store',
  });

  if (!bootstrapResponse.ok) {
    authPageUrl.searchParams.set('error_code', 'bootstrap_failed');
    authPageUrl.searchParams.set('error_description', 'Could not initialize your profile. Please sign in again.');
    return NextResponse.redirect(authPageUrl);
  }

  const { data: profile } = await supabase.from('users').select('roles(name)').eq('id', user.id).maybeSingle();
  const roleName = (Array.isArray(profile?.roles) ? profile?.roles[0] : profile?.roles)?.name;

  if (roleName === 'admin' || roleName === 'staff') {
    const adminRedirectUrl = new URL('/dashboard/admin', url.origin);
    return NextResponse.redirect(adminRedirectUrl);
  }

  return NextResponse.redirect(redirectUrl);
  } catch (err) {
    const errorCode = err instanceof Error ? (err as NodeJS.ErrnoException).code : undefined;
    const isTransient = errorCode ? ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'FETCH_ERROR'].includes(errorCode) : false;
    console.error('[auth/callback] Unexpected error:', {
      message: err instanceof Error ? err.message : String(err),
      code: errorCode,
      transient: isTransient,
      timestamp: getISTTimestamp(),
    });
    const fallbackMessage = isTransient
      ? 'Authentication temporarily unavailable. Please try again in a moment.'
      : 'Something went wrong. Please try again.';
    const fallbackCode = isTransient ? 'callback_temporary' : 'callback_error';
    const fallback = new URL(`/auth/sign-in?error_code=${fallbackCode}&error_description=${encodeURIComponent(fallbackMessage)}`, request.url);
    return NextResponse.redirect(fallback);
  }
}
