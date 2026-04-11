'use client';

import { useEffect } from 'react';

export default function FormsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Forms error boundary caught an error', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-[760px] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-ink">Booking flow encountered an error</h1>
      <p className="text-sm text-[#7b6f66]">Your progress may not be saved. Please retry.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-coral px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
      >
        Retry form
      </button>
    </main>
  );
}
