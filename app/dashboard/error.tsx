'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error boundary caught an error', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-[760px] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-ink">Dashboard failed to load</h1>
      <p className="text-sm text-[#7b6f66]">Try again or return to your dashboard home.</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-coral px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-full border border-[#e7c4a7] px-5 py-2 text-sm font-medium text-ink transition hover:bg-[#fff8f0]"
        >
          Dashboard home
        </a>
      </div>
    </main>
  );
}
