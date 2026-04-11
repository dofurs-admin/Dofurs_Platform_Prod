'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, Share2, CheckCircle2, Gift, Users, Wallet, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { MONTHLY_REFERRAL_LIMIT } from '@/lib/referrals/service';

type ReferralStats = {
  total: number;
  credited: number;
  pendingFirstBooking: number;
  creditsEarned: number;
  monthlyUsed: number;
  monthlyRemaining: number;
};

type CreditBalance = {
  available_inr: number;
  lifetime_earned_inr: number;
  lifetime_used_inr: number;
};

type ReferAndEarnData = {
  code: string | null;
  shareUrl: string | null;
  whatsappText: string | null;
  stats: ReferralStats;
  creditBalance: CreditBalance;
  monthlyRemaining: number;
};

const EMPTY_DATA: ReferAndEarnData = {
  code: null,
  shareUrl: null,
  whatsappText: null,
  stats: { total: 0, credited: 0, pendingFirstBooking: 0, creditsEarned: 0, monthlyUsed: 0, monthlyRemaining: MONTHLY_REFERRAL_LIMIT },
  creditBalance: { available_inr: 0, lifetime_earned_inr: 0, lifetime_used_inr: 0 },
  monthlyRemaining: MONTHLY_REFERRAL_LIMIT,
};

export default function ReferAndEarnSection() {
  const { showToast } = useToast();
  const [data, setData] = useState<ReferAndEarnData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    fetch('/api/referrals/my-code')
      .then((r) => r.json())
      .then((d: ReferAndEarnData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function copyCode() {
    if (!data.code) return;
    await navigator.clipboard.writeText(data.code);
    setCodeCopied(true);
    showToast('Referral code copied!', 'success');
    setTimeout(() => setCodeCopied(false), 2500);
  }

  async function copyLink() {
    if (!data.shareUrl) return;
    await navigator.clipboard.writeText(data.shareUrl);
    setLinkCopied(true);
    showToast('Share link copied!', 'success');
    setTimeout(() => setLinkCopied(false), 2500);
  }

  function shareWhatsApp() {
    if (!data.whatsappText) return;
    const url = `https://wa.me/?text=${encodeURIComponent(data.whatsappText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 rounded-3xl bg-[#f5ebe0]" />
        <div className="h-24 rounded-3xl bg-[#f5ebe0]" />
        <div className="h-20 rounded-3xl bg-[#f5ebe0]" />
      </div>
    );
  }

  const monthlyUsed = data.stats.monthlyUsed;
  const monthlyRemaining = data.monthlyRemaining ?? data.stats.monthlyRemaining;
  const limitReached = monthlyRemaining === 0;

  return (
    <div className="space-y-5">
      {/* Reward highlight */}
      <div className="relative overflow-hidden rounded-3xl border border-[#e7c4a7] bg-[linear-gradient(135deg,#fff8ef_0%,#fff2e2_100%)] p-5 sm:p-6 shadow-soft">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(228,153,90,0.18),transparent_50%)]"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-4 justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a05a2c]">Refer &amp; Earn</p>
            <h2 className="mt-1.5 text-xl sm:text-2xl font-bold text-ink">Invite friends. Both of you earn ₹500.</h2>
            <p className="mt-1 text-sm text-ink/70">
              Your friend gets ₹500 on sign-up. You get ₹500 when they complete their first booking.
            </p>
          </div>
          <div className="flex h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0 items-center justify-center rounded-full bg-coral text-2xl sm:text-3xl shadow-soft">
            🎁
          </div>
        </div>
      </div>

      {/* Monthly usage indicator */}
      <div className={`rounded-2xl border px-5 py-4 ${limitReached ? 'border-amber-200 bg-amber-50' : 'border-[#e7c4a7] bg-white'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">This Month&apos;s Slots</p>
            <p className="mt-0.5 text-sm text-ink">
              {limitReached ? (
                <span className="font-semibold text-amber-700">Monthly limit reached — resets on the 1st</span>
              ) : (
                <>
                  <span className="font-bold text-ink">{monthlyRemaining}</span> of {MONTHLY_REFERRAL_LIMIT} referral slots remaining
                </>
              )}
            </p>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: MONTHLY_REFERRAL_LIMIT }).map((_, i) => (
              <span
                key={i}
                className={`block h-2.5 w-2.5 rounded-full ${i < monthlyUsed ? 'bg-coral' : 'bg-[#f5e6d8]'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Your referral code */}
      {data.code ? (
        <div className="rounded-3xl border border-[#e7c4a7] bg-white p-5 sm:p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Your Referral Code</p>
          <div className="mt-3 flex items-center gap-2 sm:gap-3">
            <div className="flex-1 min-w-0 rounded-2xl border-2 border-dashed border-[#e7c4a7] bg-[#fffaf6] px-3 sm:px-5 py-3 sm:py-4 text-center">
              <span className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.12em] sm:tracking-[0.18em] text-coral">{data.code}</span>
            </div>
            <button
              onClick={copyCode}
              className="flex h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-[#e7c4a7] bg-[#fffaf6] text-ink transition hover:bg-coral hover:text-white hover:border-coral"
              title="Copy code"
            >
              {codeCopied ? <CheckCircle2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>

          {/* Share actions */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={shareWhatsApp}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
            >
              <Share2 className="h-4 w-4" />
              Share on WhatsApp
            </button>
            <button
              onClick={copyLink}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#e7c4a7] bg-[#fffaf6] px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-white"
            >
              {linkCopied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {linkCopied ? 'Link copied!' : 'Copy invite link'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-[#e7c4a7] bg-[#fffaf6] p-6 text-center shadow-soft">
          <p className="text-sm text-ink/60">Your referral code is being generated. Check back shortly.</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#e7c4a7] bg-white p-4 text-center shadow-sm">
          <Users className="mx-auto h-5 w-5 text-coral" />
          <p className="mt-2 text-2xl font-bold text-ink">{data.stats.total}</p>
          <p className="mt-0.5 text-xs text-ink/50">Referred</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center shadow-sm">
          <Clock className="mx-auto h-5 w-5 text-amber-600" />
          <p className="mt-2 text-2xl font-bold text-ink">{data.stats.pendingFirstBooking}</p>
          <p className="mt-0.5 text-xs text-amber-700">Awaiting booking</p>
        </div>
        <div className="rounded-2xl border border-[#e7c4a7] bg-white p-4 text-center shadow-sm">
          <Gift className="mx-auto h-5 w-5 text-coral" />
          <p className="mt-2 text-2xl font-bold text-ink">{data.stats.credited}</p>
          <p className="mt-0.5 text-xs text-ink/50">Rewarded</p>
        </div>
        <div className="rounded-2xl border border-[#e7c4a7] bg-white p-4 text-center shadow-sm">
          <Wallet className="mx-auto h-5 w-5 text-coral" />
          <p className="mt-2 text-2xl font-bold text-ink">₹{data.stats.creditsEarned}</p>
          <p className="mt-0.5 text-xs text-ink/50">Earned</p>
        </div>
      </div>

      {/* Pending explanation */}
      {data.stats.pendingFirstBooking > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{data.stats.pendingFirstBooking} friend{data.stats.pendingFirstBooking > 1 ? 's have' : ' has'} signed up</span> using your code
            — your ₹{500 * data.stats.pendingFirstBooking} reward will be credited once{' '}
            {data.stats.pendingFirstBooking > 1 ? 'they complete' : 'they complete'} their first Dofurs booking.
          </p>
        </div>
      )}

      {/* Credit wallet balance */}
      <div className="rounded-3xl border border-[#e7c4a7] bg-[linear-gradient(135deg,#fff8ef,#fff2e2)] p-4 sm:p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a05a2c]">Dofurs Credits</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold text-ink">₹{data.creditBalance.available_inr}</p>
            <p className="mt-0.5 text-sm text-ink/60">available to use at checkout</p>
          </div>
          <div className="flex gap-4 sm:flex-col sm:gap-0 sm:text-right">
            <div>
              <p className="text-xs text-ink/50">Lifetime earned</p>
              <p className="font-semibold text-ink">₹{data.creditBalance.lifetime_earned_inr}</p>
            </div>
            <div className="sm:mt-1">
              <p className="text-xs text-ink/50">Lifetime used</p>
              <p className="font-semibold text-ink">₹{data.creditBalance.lifetime_used_inr}</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink/50">
          Credits can be applied at checkout for any Dofurs service booking.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-3xl border border-[#f1e6da] bg-white p-6 shadow-soft">
        <h3 className="text-base font-semibold text-ink">How it works</h3>
        <div className="mt-4 space-y-4">
          {[
            {
              step: '1',
              title: 'Share your unique code',
              body: 'Send your referral code or invite link to friends who have pets.',
            },
            {
              step: '2',
              title: 'Friend signs up & gets ₹500',
              body: 'They enter your code when creating their account and get ₹500 Dofurs Credits instantly at sign-up.',
            },
            {
              step: '3',
              title: 'You earn ₹500 after their first booking',
              body: 'Once your friend completes their first Dofurs service booking, ₹500 is credited to your wallet.',
            },
            {
              step: '4',
              title: 'Use credits on any booking',
              body: 'Apply your credits at checkout for grooming, vet visits, training, or any other service.',
            },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#fff2e2] text-xs font-bold text-[#9f5d2d]">
                {item.step}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-0.5 text-xs text-ink/60">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 rounded-xl border border-[#f1e6da] bg-[#fffaf6] px-4 py-2.5 text-xs text-ink/60">
          Fair use: referral rewards are capped at {MONTHLY_REFERRAL_LIMIT} new referrals per calendar month per account.
        </p>
      </div>

      {/* Book a service CTA */}
      <div className="rounded-3xl border border-[#f1e6da] bg-[#fffdfb] p-5 text-center shadow-soft-sm">
        <p className="text-sm text-ink/70">Ready to use your credits?</p>
        <Link
          href="/forms/customer-booking"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-coral px-7 py-3 text-sm font-semibold text-white shadow-soft-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-[0_14px_28px_rgba(227,154,93,0.32)]"
        >
          Book a Service
        </Link>
      </div>
    </div>
  );
}
