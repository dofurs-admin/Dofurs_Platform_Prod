import Link from 'next/link';
import { requireAuthenticatedUser } from '@/lib/auth/session';

type ConfirmationPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function SubscriptionConfirmationPage({ searchParams }: ConfirmationPageProps) {
  await requireAuthenticatedUser();

  const params = await searchParams;
  const status = params?.status === 'pending' ? 'pending' : 'success';

  const isPending = status === 'pending';

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-[#e7c4a7] bg-[linear-gradient(155deg,#fffaf6_0%,#fff3e7_100%)] p-6 shadow-premium sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-coral">Subscription Purchase</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">
          {isPending ? 'Payment Received. Activation In Progress.' : 'Subscription Activated Successfully'}
        </h1>
        <p className="mt-3 text-sm text-[#6b5443] sm:text-base">
          {isPending
            ? 'Your Razorpay payment was successful. We are finalizing your subscription and credits now. This usually completes within a minute.'
            : 'Your payment is confirmed and your subscription credits are now available in your account.'}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard/user/subscriptions"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-6 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(199,119,59,0.25)] transition hover:brightness-95"
          >
            View Subscriptions and Credits
          </Link>
          <Link
            href="/forms/customer-booking"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[#e0c4a8] bg-white px-6 text-sm font-semibold text-[#7c5335] transition hover:border-[#c7773b] hover:text-[#c7773b]"
          >
            Continue Booking
          </Link>
        </div>

        {isPending ? (
          <div className="mt-5 rounded-2xl border border-[#f0d9c5] bg-white/70 p-4 text-xs text-[#6e4d35] sm:text-sm">
            If credits do not appear after a minute, refresh once from the subscriptions page. If the issue continues, contact support with your payment timestamp.
          </div>
        ) : null}
      </section>
    </main>
  );
}
