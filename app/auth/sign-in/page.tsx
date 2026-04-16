'use client';

import { Suspense } from 'react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import Link from 'next/link';
import { Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useToast } from '@/components/ui/ToastProvider';
import SignUpAuthPanel from '@/components/auth/SignUpAuthPanel';
import type { FlowState } from '@/lib/flows/contracts';
import { extractIndianPhoneDigits, isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';

type SignInStep = 'collect' | 'verify';

type CompleteProfilePayload = {
  name: string;
  email: string;
  phoneDigits: string;
};

type UserRoleProfileResponse = {
  profile?: {
    roles?: { name?: string | null } | Array<{ name?: string | null }> | null;
  };
};

function getRetryAfterSeconds(rawMessage: string) {
  const message = rawMessage.toLowerCase();
  const match = message.match(/(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m)\b/);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const unit = match[2];
  return unit.startsWith('m') ? value * 60 : value;
}

function normalizeErrorMessage(raw: unknown) {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed && trimmed !== '{}' && trimmed !== '[]') {
      return trimmed;
    }
  }

  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const candidates = [record.message, record.error_description, record.error, record.msg];

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed && trimmed !== '{}' && trimmed !== '[]') {
          return trimmed;
        }
      }
    }
  }

  return 'Unable to send OTP right now. Please verify Supabase Email Auth template/settings and try again.';
}

function isRateLimitError(rawMessage: string) {
  const message = rawMessage.toLowerCase();

  return (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('over_email_send_rate_limit') ||
    message.includes('security purposes')
  );
}

function getReadableAuthError(rawMessage: string) {
  const message = rawMessage.toLowerCase();

  if (message.includes('signups not allowed for otp') || message.includes('signup is disabled')) {
    return 'No account was found for this email. Please create an account first.';
  }

  if (message.includes('invalid email')) {
    return 'Invalid email format. Enter a valid email address.';
  }

  if (isRateLimitError(rawMessage)) {
    const seconds = getRetryAfterSeconds(rawMessage) ?? 60;
    return `Too many email requests. Please wait ${seconds} seconds before trying again.`;
  }

  return rawMessage;
}

function SignInFormPanel({ signUpHref }: { signUpHref: string }) {
  const { showToast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const requestedNextPath = params.get('next');
  const nextPath = requestedNextPath && requestedNextPath.startsWith('/') ? requestedNextPath : '/dashboard';
  const callbackErrorCode = params.get('error_code');
  const callbackErrorDescription = params.get('error_description');

  const [step, setStep] = useState<SignInStep>('collect');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowState>('collecting');
  const [isPending, setIsPending] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [completeProfileData, setCompleteProfileData] = useState<CompleteProfilePayload>({
    name: '',
    email: '',
    phoneDigits: '',
  });
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  function updateCompleteProfileField(field: keyof CompleteProfilePayload, value: string) {
    setCompleteProfileData((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    if (step !== 'verify') {
      return;
    }

    const timer = window.setTimeout(() => {
      otpInputRef.current?.focus();
      otpInputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [step]);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldownSeconds((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resendCooldownSeconds]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    let active = true;

    async function completeSignInIfSessionExists() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) {
        return;
      }

      const response = await fetch('/api/auth/bootstrap-profile', {
        method: 'POST',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          requiresProfileSetup?: boolean;
        };

        if (response.status === 409 && payload.requiresProfileSetup) {
          setNeedsProfileSetup(true);
          setCompleteProfileData((current) => ({
            ...current,
            email: user.email ?? current.email,
          }));
          setMessage('Your account is verified. Complete your profile to continue.');
          return;
        }

        setError(payload.error || 'Failed to initialize profile.');
        return;
      }

      let redirectPath = nextPath;

      try {
        const roleResponse = await fetch('/api/user/profile', { method: 'GET', cache: 'no-store' });

        if (roleResponse.ok) {
          const rolePayload = (await roleResponse.json()) as UserRoleProfileResponse;
          const roleRecord = Array.isArray(rolePayload.profile?.roles)
            ? rolePayload.profile?.roles[0]
            : rolePayload.profile?.roles;
          const roleName = roleRecord?.name ?? null;

          if (roleName === 'admin' || roleName === 'staff') {
            redirectPath = '/dashboard/admin';
          }
        }
      } catch (err) { console.error(err);
        // Fall back to nextPath when role lookup is unavailable
      }

      window.location.href = redirectPath;
    }

    completeSignInIfSessionExists();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_IN') {
        completeSignInIfSessionExists();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [nextPath, router]);

  useEffect(() => {
    if (!callbackErrorCode) {
      return;
    }

    setError(
      callbackErrorCode === 'otp_expired' || callbackErrorCode === 'auth_session_missing'
        ? 'This email OTP has expired or was already used. Please request a new one.'
        : callbackErrorDescription || 'Sign-in verification failed. Please request a new OTP.',
    );
  }, [callbackErrorCode, callbackErrorDescription]);

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setFlowState('validating');
    setIsPending(true);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Please enter your email address.');
      setFlowState('collecting');
      setIsPending(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Invalid email address');
      setFlowState('collecting');
      setIsPending(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const signInRequest = supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      const timeoutRequest = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out while contacting Supabase. Please try again.')), 45000);
      });

      const { error: otpError } = (await Promise.race([signInRequest, timeoutRequest])) as Awaited<
        ReturnType<typeof supabase.auth.signInWithOtp>
      >;

      if (otpError) {
        const resolvedMessage = normalizeErrorMessage(otpError.message || otpError);

        if (isRateLimitError(otpError.message)) {
          setResendCooldownSeconds(getRetryAfterSeconds(otpError.message) ?? 60);
        }

        setError(getReadableAuthError(resolvedMessage));
        setFlowState('error');
        showToast('Sign in failed. Check the error message.', 'error');
        setIsPending(false);
        return;
      }

      setResendCooldownSeconds(60);
      setStep('verify');
      setOtp('');
      setFlowState('ready');
      setMessage('6-digit OTP sent to your email. Enter it below to complete sign-in.');
      showToast('Email OTP sent successfully.', 'success');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : '';
      setError(message || 'Unable to send email OTP right now. Please try again in a moment.');
      setFlowState('error');
      showToast('Could not send email OTP.', 'error');
    } finally {
      setIsPending(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError('Enter the 6-digit OTP from your email.');
      setFlowState('collecting');
      return;
    }

    setIsPending(true);
    setFlowState('submitting');

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedOtp,
        type: 'email',
      });

      if (verifyError) {
        setError(getReadableAuthError(verifyError.message));
        setFlowState('error');
        showToast('OTP verification failed.', 'error');
        setIsPending(false);
        return;
      }

      // Set success state - auth listener will handle bootstrap & redirect
      setFlowState('success');
      showToast('OTP verified successfully.', 'success');
      
      // Safety fallback: if redirect doesn't happen in 5 seconds, force it
      setTimeout(() => {
        if (window.location.pathname === '/auth/sign-in') {
          window.location.href = nextPath;
        }
      }, 5000);
    } catch (err) { console.error(err);
      setError('Unable to verify OTP right now. Please try again.');
      setFlowState('error');
      showToast('OTP verification failed.', 'error');
      setIsPending(false);
    }
  }

  async function handleCompleteProfile(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const name = completeProfileData.name.trim();
    const normalizedEmail = completeProfileData.email.trim().toLowerCase();
    const phone = toIndianE164(completeProfileData.phoneDigits);

    if (!name || !normalizedEmail || !phone) {
      setError('Please complete name, email, and phone.');
      return;
    }

    if (!/^[a-zA-Z\s.]+$/.test(name)) {
      setError('Name can only contain letters, spaces, and periods');
      return;
    }

    if (!isValidIndianE164(phone)) {
      setError('Invalid phone number');
      return;
    }

    setIsPending(true);

    try {
      const completeResponse = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email: normalizedEmail,
          phone,
        }),
      });

      if (!completeResponse.ok) {
        const payload = (await completeResponse.json().catch(() => ({}))) as { error?: unknown };
        setError(normalizeErrorMessage(payload.error));
        return;
      }

      const bootstrapResponse = await fetch('/api/auth/bootstrap-profile', {
        method: 'POST',
      });

      if (!bootstrapResponse.ok) {
        const payload = (await bootstrapResponse.json().catch(() => ({}))) as { error?: unknown };
        setError(normalizeErrorMessage(payload.error));
        return;
      }

      setNeedsProfileSetup(false);
      router.replace(nextPath);
      showToast('Profile completed successfully.', 'success');
    } catch (err) { console.error(err);
      setError('Unable to complete profile right now. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden rounded-3xl border border-[#f2dfcf] bg-[linear-gradient(135deg,_#fff8f2_0%,_#fdf2e8_100%)] p-8 shadow-soft-md lg:block">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#f1decf] bg-white/80 px-3 py-1 text-xs font-semibold text-[#a05a2c]">
          <ShieldCheck className="h-4 w-4" />
          Verified Email Login
        </div>
        <h2 className="mt-5 text-3xl font-bold leading-tight text-ink">Welcome back to your Dofurs dashboard.</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#6b6b6b]">
          We send a secure 6-digit OTP to your email. Once verified, your profile is loaded automatically and redirected to your dashboard.
        </p>
        <ul className="mt-6 grid gap-3 text-sm text-[#4b4b4b]">
          <li className="rounded-xl border border-[#f2dfcf] bg-white p-3">✔ Passwordless login with one-time secure email OTP</li>
          <li className="rounded-xl border border-[#f2dfcf] bg-white p-3">✔ Session is validated server-side before dashboard access</li>
          <li className="rounded-xl border border-[#f2dfcf] bg-white p-3">✔ Rate-limited OTP flow for safer account protection</li>
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#f1decf] bg-[#fffaf6] px-3 py-1 text-xs font-semibold text-[#a05a2c]">
          <Sparkles className="h-3.5 w-3.5" />
          Secure Member Access
        </div>
        <h1 className="text-2xl font-bold text-ink">Sign in with Email</h1>
        <p className="mt-2 text-sm text-[#6b6b6b]">Enter your email and we’ll send a secure 6-digit OTP.</p>

        {flowState === 'success' && (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-green-700">✓ Signed in successfully!</p>
            <p className="mt-1 text-xs text-green-600">Redirecting to your dashboard...</p>
            <div className="mt-3 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-green-600" />
            </div>
          </div>
        )}

        {flowState !== 'success' && needsProfileSetup && (
          <form onSubmit={handleCompleteProfile} className="mt-6 space-y-4">
            <div className="rounded-xl border border-[#f2dfcf] bg-[#fffaf6] px-3 py-2 text-xs text-[#6b6b6b]">
              Complete your profile to finish sign-in.
            </div>

            <div>
              <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-ink">
                Full Name
              </label>
              <input
                id="profile-name"
                type="text"
                autoComplete="name"
                value={completeProfileData.name}
                onChange={(event) => updateCompleteProfileField('name', event.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-3 text-sm outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                required
              />
            </div>

            <div>
              <label htmlFor="profile-email" className="mb-1 block text-sm font-medium text-ink">
                Email Address
              </label>
              <input
                id="profile-email"
                type="email"
                autoComplete="email"
                value={completeProfileData.email}
                onChange={(event) => updateCompleteProfileField('email', event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-3 text-sm outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                required
              />
            </div>

            <div>
              <label htmlFor="profile-phone" className="mb-1 block text-sm font-medium text-ink">
                Phone Number
              </label>
              <div className="flex overflow-hidden rounded-xl border border-[#f2dfcf] focus-within:border-[#e89a5e] focus-within:ring-2 focus-within:ring-[#f7d8bd]">
                <span className="inline-flex items-center bg-[#fffaf6] px-3 text-sm font-semibold text-ink">+91</span>
                <input
                  id="profile-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={completeProfileData.phoneDigits}
                  onChange={(event) => updateCompleteProfileField('phoneDigits', extractIndianPhoneDigits(event.target.value))}
                  placeholder="9876543210"
                  className="w-full px-4 py-3 text-sm outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white transition-all duration-300 ease-out hover:bg-[#cf8448] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {isPending ? 'Saving profile...' : 'Complete Profile & Continue'}
            </button>
          </form>
        )}

        {flowState !== 'success' && !needsProfileSetup && step === 'collect' && (
          <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-3 text-sm outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isPending || resendCooldownSeconds > 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white transition-all duration-300 ease-out hover:bg-[#cf8448] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {isPending ? 'Sending email OTP...' : resendCooldownSeconds > 0 ? `Retry in ${resendCooldownSeconds}s` : 'Send Email OTP'}
            </button>
            <p className="text-xs text-[#8a7b6f]">No password needed. We’ll send a one-time 6-digit code to your email.</p>
          </form>
        )}

        {flowState !== 'success' && !needsProfileSetup && step === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <div className="rounded-xl border border-[#f2dfcf] bg-[#fffaf6] px-3 py-2 text-xs text-[#6b6b6b]">
              OTP sent to: <span className="font-semibold text-ink">{email}</span>
            </div>

            <div>
              <label htmlFor="signin-otp" className="mb-1 block text-sm font-medium text-ink">
                Enter 6-digit OTP
              </label>
              <input
                ref={otpInputRef}
                id="signin-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

                  if (!pasted) {
                    return;
                  }

                  event.preventDefault();
                  setOtp(pasted);
                }}
                placeholder="123456"
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-3 text-center text-lg tracking-[0.35em] outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white transition-all duration-300 ease-out hover:bg-[#cf8448] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {isPending ? 'Verifying OTP...' : 'Verify OTP & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('collect');
                setOtp('');
                setMessage(null);
                setError(null);
              }}
              className="inline-flex w-full items-center justify-center rounded-full border border-[#f2dfcf] bg-[#fffaf6] px-5 py-3 text-sm font-semibold text-[#6b6b6b] transition hover:bg-white"
            >
              Change email / Resend OTP
            </button>
          </form>
        )}

        {message && (
          <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" role="status" aria-live="polite">
            {message} Check spam/promotions if needed.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600" role="alert" aria-live="assertive">
            {error}
          </p>
        )}
        <p className="mt-5 text-center text-sm text-[#6b6b6b]">
          New to Dofurs?{' '}
          <Link href={signUpHref} className="font-semibold text-coral hover:underline">
            Create an account
          </Link>
        </p>
      </section>
    </div>
  );
}

function UnifiedAuthPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const modeParam = params.get('mode');
  const nextParam = params.get('next');
  const reasonParam = params.get('reason');
  const hasModeParam = modeParam === 'signin' || modeParam === 'signup';
  const [mode, setMode] = useState<'signin' | 'signup'>(modeParam === 'signup' ? 'signup' : 'signin');
  const [isModeReady, setIsModeReady] = useState(hasModeParam);

  useEffect(() => {
    if (hasModeParam) {
      const explicitMode = modeParam as 'signin' | 'signup';
      setMode(explicitMode);
      window.localStorage.setItem('dofurs-auth-mode', explicitMode);
      setIsModeReady(true);
      return;
    }

    const savedMode = window.localStorage.getItem('dofurs-auth-mode');
    const mustSignIn = Boolean(nextParam) || reasonParam === 'inactive';
    const resolvedMode = mustSignIn ? 'signin' : savedMode === 'signup' ? 'signup' : 'signin';

    setMode(resolvedMode);

    const nextSearchParams = new URLSearchParams(params.toString());
    nextSearchParams.set('mode', resolvedMode);
    router.replace(`/auth/sign-in?${nextSearchParams.toString()}`);

    setIsModeReady(true);
  }, [hasModeParam, modeParam, nextParam, params, reasonParam, router]);

  const signInHref = '/auth/sign-in?mode=signin';
  const signUpHref = '/auth/sign-in?mode=signup';

  if (!isModeReady) {
    return (
      <main className="relative overflow-hidden bg-[linear-gradient(180deg,#fffcf8_0%,#fffaf6_46%,#fffcf9_100%)] px-4 py-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_14%_6%,rgba(228,153,90,0.15),transparent_52%),radial-gradient(circle_at_84%_12%,rgba(154,122,87,0.1),transparent_48%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto mb-5 h-12 w-full max-w-5xl animate-pulse rounded-full border border-[#e8ccb3] bg-white/95" />
      </main>
    );
  }

  return (
    <main className="relative overflow-hidden bg-[linear-gradient(180deg,#fffcf8_0%,#fffaf6_46%,#fffcf9_100%)] px-4 py-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_14%_6%,rgba(228,153,90,0.15),transparent_52%),radial-gradient(circle_at_84%_12%,rgba(154,122,87,0.1),transparent_48%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto mb-5 flex w-full max-w-5xl items-center justify-center gap-2 rounded-full border border-[#e8ccb3] bg-white/95 p-1 shadow-premium">
        <Link
          href={signInHref}
          className={`inline-flex flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === 'signin'
              ? 'bg-[#fff1df] text-[#2d221a]'
              : 'text-[#6b6b6b] hover:bg-[#fff7f0]'
          }`}
        >
          Log in
        </Link>
        <Link
          href={signUpHref}
          className={`inline-flex flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === 'signup'
              ? 'bg-[#fff1df] text-[#2d221a]'
              : 'text-[#6b6b6b] hover:bg-[#fff7f0]'
          }`}
        >
          Sign up
        </Link>
      </div>

      <div className="relative">{mode === 'signup' ? <SignUpAuthPanel /> : <SignInFormPanel signUpHref={signUpHref} />}</div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="bg-[linear-gradient(180deg,#fffcf8_0%,#fffaf6_46%,#fffcf9_100%)] px-4 py-8" />}>
      <UnifiedAuthPageContent />
    </Suspense>
  );
}
