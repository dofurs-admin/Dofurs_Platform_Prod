import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import SignOutButton from './SignOutButton';

export default async function SuspendedAccountPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Check if still suspended
  const { data: provider } = await supabase
    .from('providers')
    .select('account_status, business_name, name')
    .eq('user_id', user.id)
    .single();

  if (provider?.account_status === 'active') {
    redirect('/dashboard/provider');
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-[1.75rem] border border-[#ecd6c2] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f2_38%,#fbf3eb_100%)] p-6 shadow-[0_22px_48px_rgba(132,95,61,0.12)] md:p-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff2ea]">
            <svg
              className="h-8 w-8 text-[#e76f51]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Account Suspended</h1>
            {provider?.business_name && <p className="text-sm text-[#6b6b6b]">{provider.business_name}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[#6b6b6b]">
            Your provider account has been suspended and you cannot access your dashboard or
            accept bookings at this time.
          </p>

          {provider?.account_status === 'banned' ? (
            <div className="rounded-lg bg-[#fff2ea] p-4">
              <p className="text-sm font-semibold text-[#e76f51]">Account Status: Permanently Banned</p>
              <p className="mt-2 text-sm text-[#6b6b6b]">
                This account has been permanently disabled due to policy violations.
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-[#fffaf6] p-4">
              <p className="text-sm font-semibold text-ink">Account Status: Temporarily Suspended</p>
              <p className="mt-2 text-sm text-[#6b6b6b]">
                This may be due to pending verification, policy review, or administrative action.
              </p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <h2 className="font-semibold text-ink">Next Steps:</h2>
            <ul className="list-inside list-disc space-y-2 text-sm text-[#6b6b6b]">
              <li>Check your email for communication from the Dofurs team</li>
              <li>If you believe this is an error, contact support immediately</li>
              <li>Review our Terms of Service and Community Guidelines</li>
              <li>Complete any pending verification requirements</li>
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="/contact-us"
              className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-6 py-3 text-sm font-semibold text-white transition-all duration-300 ease-out hover:-translate-y-0.5"
            >
              Contact Support
            </a>
            <SignOutButton />
          </div>
        </div>
      </div>
    </section>
  );
}
