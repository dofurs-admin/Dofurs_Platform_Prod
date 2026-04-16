'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BellRing, Loader2, MailCheck, Scissors, ShieldPlus, Sparkles, Stethoscope } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useToast } from '@/components/ui/ToastProvider';
import type { FlowState } from '@/lib/flows/contracts';
import { extractIndianPhoneDigits, isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';

type SignUpStep = 'collect' | 'verify' | 'done';

const welcomeOfferBenefits = [
  {
    icon: Scissors,
    label: 'Grooming at Your Door step',
  },
  {
    icon: ShieldPlus,
    label: 'Lifetime Pet Health Passport',
  },
  {
    icon: BellRing,
    label: 'Smart Vaccination Reminders',
  },
  {
    icon: Stethoscope,
    label: 'Vet Care at Home or Clinic',
  },
] as const;

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

  if (message.includes('already registered') || message.includes('already exists')) {
    return 'Account already exists. Please use Log in.';
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

function formatOfferTimer(totalSeconds: number | null): string {
  if (totalSeconds === null) {
    return '00:00';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function SignUpAuthPanel() {
  const { showToast } = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = useState<SignUpStep>('collect');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offerCountdownSeconds, setOfferCountdownSeconds] = useState<number | null>(null);
  const [, setFlowState] = useState<FlowState>('collecting');
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  // Pre-fill referral code from URL ?ref= param
  useEffect(() => {
    const refParam = params.get('ref');
    if (refParam) {
      setReferralCode(refParam.trim().toUpperCase());
    }
  }, [params]);

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
    const randomSecondsUnderOneHour = Math.floor(Math.random() * 3599) + 1;
    setOfferCountdownSeconds(randomSecondsUnderOneHour);
  }, []);

  useEffect(() => {
    if (offerCountdownSeconds === null || offerCountdownSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setOfferCountdownSeconds((previous) => Math.max((previous ?? 0) - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [offerCountdownSeconds]);

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

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setFlowState('validating');
    setStatus('Validating your details...');

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = toIndianE164(phoneDigits);

    if (!normalizedName || !normalizedEmail || !normalizedPhone) {
      setStatus(null);
      setFlowState('collecting');
      setError('Please enter all required details.');
      return;
    }

    if (!/^[a-zA-Z\s.]+$/.test(normalizedName)) {
      setStatus(null);
      setFlowState('collecting');
      setError('Name can only contain letters, spaces, and periods');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setStatus(null);
      setFlowState('collecting');
      setError('Invalid email address');
      return;
    }

    if (!isValidIndianE164(normalizedPhone)) {
      setStatus(null);
      setFlowState('collecting');
      setError('Invalid phone number');
      return;
    }

    setIsPending(true);
    setFlowState('submitting');

    try {
      const precheckResponse = await fetch('/api/auth/pre-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
        }),
      });

      const precheckPayload = (await precheckResponse.json().catch(() => ({}))) as { error?: unknown };

      if (!precheckResponse.ok) {
        setStatus(null);
        setFlowState('error');
        setError(normalizeErrorMessage(precheckPayload.error));
        showToast('Sign up validation failed.', 'error');
        return;
      }

      // Validate referral code before sending OTP so the user gets immediate feedback
      if (referralCode.trim()) {
        setStatus('Validating referral code...');
        const refValidateResponse = await fetch('/api/referrals/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: referralCode.trim().toUpperCase() }),
        });
        if (!refValidateResponse.ok) {
          const refPayload = (await refValidateResponse.json().catch(() => ({}))) as { error?: unknown };
          setStatus(null);
          setFlowState('error');
          setError(normalizeErrorMessage(refPayload.error) || 'Invalid referral code. Please check and try again.');
          showToast('Invalid referral code.', 'error');
          return;
        }
      }

      setStatus('Sending 6-digit OTP...');

      const supabase = getSupabaseBrowserClient();
      const signUpRequest = supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          data: {
            name: normalizedName,
            full_name: normalizedName,
            phone: normalizedPhone,
            phone_number: normalizedPhone,
          },
        },
      });

      const timeoutRequest = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out while contacting Supabase. Please try again.')), 45000);
      });

      const { error: signUpError } = (await Promise.race([signUpRequest, timeoutRequest])) as Awaited<
        ReturnType<typeof supabase.auth.signInWithOtp>
      >;

      if (signUpError) {
        const resolvedMessage = normalizeErrorMessage(signUpError.message || signUpError);

        if (isRateLimitError(signUpError.message)) {
          setResendCooldownSeconds(getRetryAfterSeconds(signUpError.message) ?? 60);
        }

        setStatus(null);
        setFlowState('error');
        setError(getReadableAuthError(resolvedMessage));
        showToast('Sign up failed. Check error details.', 'error');
        return;
      }

      setResendCooldownSeconds(60);
      setStep('verify');
      setOtp('');
      setStatus(null);
      setFlowState('ready');
      setMessage('6-digit OTP sent to your email. Enter it below to complete signup.');
      showToast('Verification email sent successfully.', 'success');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : '';
      setStatus(null);
      setFlowState('error');
      setError(message || 'Unable to process sign up right now. Please try again in a moment.');
      showToast('Could not send verification email.', 'error');
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
      return;
    }

    setIsPending(true);
    setFlowState('submitting');
    setStatus('Verifying OTP...');

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedOtp,
        type: 'email',
      });

      if (verifyError) {
        setStatus(null);
        setFlowState('error');
        setError(getReadableAuthError(verifyError.message));
        showToast('OTP verification failed.', 'error');
        return;
      }

      const response = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          phone: toIndianE164(phoneDigits),
          referralCode: referralCode.trim().toUpperCase() || null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: unknown };

      if (!response.ok) {
        setStatus(null);
        setFlowState('error');
        setError(normalizeErrorMessage(payload.error));
        showToast('Profile creation failed.', 'error');
        return;
      }

      const bootstrapResponse = await fetch('/api/auth/bootstrap-profile', {
        method: 'POST',
      });

      if (!bootstrapResponse.ok) {
        const bootstrapPayload = (await bootstrapResponse.json().catch(() => ({}))) as { error?: unknown };
        setStatus(null);
        setFlowState('error');
        setError(normalizeErrorMessage(bootstrapPayload.error));
        showToast('Profile created, but session setup failed.', 'error');
        return;
      }

      setStatus(null);
      setFlowState('success');
      setMessage('Profile created successfully. Redirecting to your dashboard...');
      showToast('Sign up complete.', 'success');

      router.replace('/dashboard');
      router.refresh();
    } catch (err) { console.error(err);
      setStatus(null);
      setFlowState('error');
      setError('Unable to verify OTP right now. Please try again.');
      showToast('OTP verification failed.', 'error');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden rounded-3xl border border-[#e9c8ab] bg-[linear-gradient(150deg,#fffefc_0%,#fff7ef_42%,#fce9d7_100%)] p-8 shadow-soft-md lg:block">
        <div className="pointer-events-none absolute -left-14 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(253,196,146,0.55)_0%,rgba(253,196,146,0)_72%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-32 bottom-12 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(228,145,76,0.3)_0%,rgba(228,145,76,0)_72%)]" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-[430px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ecd1b8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#8e5630] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
            <Sparkles className="h-3.5 w-3.5" />
            Welcome Offer
          </div>
          <h2 className="mt-4 whitespace-nowrap text-[1.56rem] font-bold leading-tight text-ink">🎉 Add 2+ Years to Your Pet&apos;s Life 🐾</h2>
          <p className="mt-2 inline-flex rounded-full border border-[#efc8a8] bg-[#ffe8d2] px-3 py-1 text-sm font-bold text-[#c06120]">
            + Get ₹500 Free on Signup
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-[#67584a]">
            Never miss vaccinations. Prevent life-threatening diseases. Give your pet the care they deserve — at home.
          </p>
          <ul className="mt-3.5 space-y-2 text-sm text-[#45372b]">
            {welcomeOfferBenefits.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="rounded-xl border border-[#ecd4bf] bg-white/82 px-3 py-2 shadow-[0_6px_14px_rgba(147,90,47,0.1)]"
              >
                <span className="inline-flex items-center gap-2.5 text-[0.92rem] font-medium">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(160deg,#ffc998_0%,#e99244_100%)] text-white shadow-sm">
                    <Icon className="h-3 w-3" />
                  </span>
                  {label}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-xl border border-[#e5c7ab] bg-[#fff6ec] px-4 py-1.5 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#a46336]">
              Offer expires in {formatOfferTimer(offerCountdownSeconds)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-4 shadow-soft-md sm:p-5">
        <h1 className="text-2xl font-bold text-ink">Create your account</h1>

        {step === 'collect' && (
          <form onSubmit={handleSendOtp} className="mt-3 space-y-2.5">
            <div>
              <label htmlFor="name" className="mb-0.5 block text-sm font-medium text-ink">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-2 text-sm outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-0.5 block text-sm font-medium text-ink">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-2 text-sm outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-0.5 block text-sm font-medium text-ink">
                Phone Number
              </label>
              <div className="flex overflow-hidden rounded-xl border border-[#f2dfcf] focus-within:border-[#e89a5e] focus-within:ring-2 focus-within:ring-[#f7d8bd]">
                <span className="inline-flex items-center bg-[#fffaf6] px-2.5 text-sm font-semibold text-ink">+91</span>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phoneDigits}
                  onChange={(event) => setPhoneDigits(extractIndianPhoneDigits(event.target.value))}
                  placeholder="9876543210"
                  className="w-full px-3.5 py-2 text-sm outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="referral-code" className="mb-0.5 block text-sm font-medium text-ink">
                Referral Code <span className="font-normal text-[#9a9a9a]">(optional)</span>
              </label>
              <input
                id="referral-code"
                type="text"
                autoComplete="off"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.trim().toUpperCase())}
                placeholder="e.g. DOFR4X9K2"
                maxLength={9}
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-2 text-sm uppercase tracking-wider outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
              />
              <p className="mt-0.5 text-[11px] text-[#9a9a9a]">Have a friend&apos;s code? Enter it to earn ₹500 welcome credits.</p>
            </div>

            <button
              type="submit"
              disabled={isPending || resendCooldownSeconds > 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
              {isPending ? 'Sending OTP...' : resendCooldownSeconds > 0 ? `Retry in ${resendCooldownSeconds}s` : 'Send Email OTP'}
            </button>
            <p className="text-[11px] text-[#8a7b6f]">By continuing, you verify these details are accurate and belong to you.</p>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <div className="rounded-xl border border-[#f2dfcf] bg-[#fffaf6] px-3 py-2 text-xs text-[#6b6b6b]">
              OTP sent to: <span className="font-semibold text-ink">{email}</span>
            </div>

            <div>
              <label htmlFor="signup-otp" className="mb-1 block text-sm font-medium text-ink">
                Enter 6-digit OTP
              </label>
              <input
                ref={otpInputRef}
                id="signup-otp"
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
              {isPending ? 'Verifying OTP...' : 'Verify OTP & Create Account'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('collect');
                setOtp('');
                setMessage(null);
                setError(null);
                setStatus(null);
                setFlowState('collecting');
              }}
              className="inline-flex w-full items-center justify-center rounded-full border border-[#f2dfcf] bg-[#fffaf6] px-5 py-3 text-sm font-semibold text-[#6b6b6b] transition hover:bg-white"
            >
              Edit details / Resend OTP
            </button>
          </form>
        )}

        {status && (
          <p className="mt-4 rounded-xl border border-[#f2dfcf] bg-[#fffaf6] px-3 py-2 text-sm text-[#6b6b6b]" role="status" aria-live="polite">
            {status}
          </p>
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

        <p className="mt-4 text-center text-sm text-[#6b6b6b]">
          Already have an account?{' '}
          <Link href="/auth/sign-in?mode=signin" className="font-semibold text-coral hover:underline">
            Log in
          </Link>
        </p>
      </section>
    </div>
  );
}
