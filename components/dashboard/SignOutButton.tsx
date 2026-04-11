'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

export default function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  function handleSignOut() {
    startTransition(async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (!response.ok) {
        showToast('Unable to sign out right now.', 'error');
        return;
      }

      showToast('Signed out successfully.', 'success');
      router.replace('/auth/sign-in');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="inline-flex items-center justify-center rounded-full border border-[#e8ccb3] bg-white px-4 py-2 text-xs font-semibold text-ink transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[#fff4e6] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? 'Signing out...' : 'Sign out'}
    </button>
  );
}
