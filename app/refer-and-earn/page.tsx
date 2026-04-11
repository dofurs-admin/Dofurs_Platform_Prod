import Link from 'next/link';
import type { Metadata } from 'next';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import ContentPageLayout from '@/components/ContentPageLayout';
import ReferAndEarnSection from '@/components/dashboard/user/ReferAndEarnSection';

async function getIsAuthenticated() {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}

export const metadata: Metadata = {
  title: 'Refer & Earn | Dofurs',
  description: 'Invite friends to Dofurs and earn ₹500 Dofurs Credits for every successful referral.',
  openGraph: {
    title: 'Refer & Earn | Dofurs',
    description: 'Invite friends to Dofurs. Both of you earn ₹500 in Dofurs Credits — applicable on any service.',
    images: [
      {
        url: '/logo/brand-logo.png',
        width: 1200,
        height: 630,
        alt: 'Dofurs Refer & Earn — ₹500 Credits',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Refer & Earn | Dofurs',
    description: 'Invite friends to Dofurs. Both of you earn ₹500 in Dofurs Credits — applicable on any service.',
    images: ['/logo/brand-logo.png'],
  },
};

export default async function ReferAndEarnPage() {
  const isAuthenticated = await getIsAuthenticated();

  return (
    <ContentPageLayout
      title="Refer & Earn"
      description="Invite pet parents to Dofurs. You both earn ₹500 in Dofurs Credits — applicable on any service."
      heroImageSrc="/Birthday/partners-with-dofurs.png"
      heroImageAlt="Refer and earn with Dofurs"
      hideHero
    >
      {isAuthenticated ? (
        <ReferAndEarnSection />
      ) : (
        <GuestView />
      )}
    </ContentPageLayout>
  );
}

function GuestView() {
  return (
    <div className="space-y-6">
      {/* Reward highlight */}
      <div className="rounded-3xl border border-[#e7c9a8] bg-[linear-gradient(135deg,#fff8ef,#fff2e2)] p-6 text-center shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Referral Reward</p>
        <p className="mt-2 text-4xl font-bold text-neutral-950">₹500 Credits</p>
        <p className="mt-1 text-sm text-neutral-600">friend gets ₹500 on sign-up · you get ₹500 after their first booking</p>
      </div>

      {/* How it works */}
      <div className="rounded-3xl border border-[#f1e6da] bg-white p-7 shadow-soft">
        <h2 className="text-xl font-semibold text-ink">How it works</h2>
        <div className="mt-4 space-y-4">
          {[
            {
              step: '1',
              title: 'Share your referral link',
              body: 'Sign in to get your unique Dofurs referral code. Share it with friends and family who are pet parents.',
            },
            {
              step: '2',
              title: 'Friend signs up with your code',
              body: 'They enter your code when creating their account and receive ₹500 Dofurs Credits instantly.',
            },
            {
              step: '3',
              title: 'You earn ₹500 after their first booking',
              body: '₹500 credits are added to your wallet once your friend completes their first Dofurs service booking.',
            },
            {
              step: '4',
              title: 'Use credits on any booking',
              body: 'Apply your Dofurs Credits at checkout — grooming, vet visits, training, sitting, and more.',
            },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#fff2e2] text-sm font-bold text-[#9f5d2d]">
                {item.step}
              </span>
              <div>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="mt-0.5 text-sm text-ink/70">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-3xl border border-[#f1e6da] bg-[#fffdfb] p-6 text-center shadow-soft-sm">
        <p className="text-sm text-ink/70">Sign in to get your unique referral code and start earning.</p>
        <Link
          href="/auth/sign-in?mode=signin"
          className="mt-4 inline-flex rounded-full bg-coral px-7 py-3 text-sm font-semibold text-white shadow-soft-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-[0_14px_28px_rgba(227,154,93,0.32)]"
        >
          Sign In to Start Earning
        </Link>
        <p className="mt-3 text-xs text-ink/50">
          New to Dofurs?{' '}
          <Link href="/auth/sign-in?mode=signup" className="font-semibold text-coral hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-4 text-xs text-ink/40">Fair use: up to 5 referral rewards per account per month.</p>
      </div>
    </div>
  );
}
