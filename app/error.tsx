'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error boundary caught an error', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[720px] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="text-sm text-[#7b6f66]">Please try again. If this continues, contact support.</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-full border border-coral px-5 py-2 text-sm font-medium text-coral transition hover:bg-coral/5"
        >
          Go back
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-coral px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-[#e7c4a7] px-5 py-2 text-sm font-medium text-ink transition hover:bg-[#fdf8f4]"
        >
          Go home
        </Link>
      </div>
      <Link href="/contact-us" className="mt-2 text-xs text-[#7b6f66] underline hover:text-coral">
        Contact support
      </Link>
    </main>
  );
}
