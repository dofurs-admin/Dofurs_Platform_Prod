import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found — Dofurs',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[720px] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl">🐾</p>
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="text-sm text-[#7b6f66]">
        Sorry, we couldn&apos;t find what you were looking for. It may have been moved or no longer exists.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-full bg-coral px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Go home
        </Link>
        <Link
          href="/services"
          className="rounded-full border border-coral px-5 py-2 text-sm font-medium text-coral transition hover:bg-coral/5"
        >
          Browse services
        </Link>
        <Link
          href="/contact-us"
          className="rounded-full border border-[#e7c4a7] px-5 py-2 text-sm font-medium text-ink transition hover:bg-[#fdf8f4]"
        >
          Contact support
        </Link>
      </div>
    </main>
  );
}
