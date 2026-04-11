'use client';

import { useState, useTransition } from 'react';
import AdminAccessView from '@/components/dashboard/admin/views/AdminAccessView';
import { useToast } from '@/components/ui/ToastProvider';

type AccessTabProps = {
  canManageUserAccess: boolean;
};

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
  } | null;

  if (!response.ok) {
    const fieldErrors = payload?.details?.fieldErrors;
    const firstFieldError =
      fieldErrors && Object.keys(fieldErrors).length > 0
        ? `${Object.keys(fieldErrors)[0]}: ${Object.values(fieldErrors)[0]?.[0]}`
        : null;
    throw new Error(firstFieldError ?? payload?.error ?? 'Request failed');
  }

  return payload as T;
}

export default function AccessTab({ canManageUserAccess }: AccessTabProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [promoteEmail, setPromoteEmail] = useState('');

  function promoteUserToRole(role: 'admin' | 'provider' | 'staff') {
    const normalizedEmail = promoteEmail.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showToast('Enter a valid email address.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await adminRequest<{ success: true; user: { id: string; email: string | null; role: 'admin' | 'provider' | 'staff' } }>(
          '/api/admin/users/promote',
          {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail, role }),
          },
        );
        setPromoteEmail('');
        showToast(`User promoted to ${role}.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : `Unable to promote user to ${role}.`, 'error');
      }
    });
  }

  if (!canManageUserAccess) {
    return (
      <section className="rounded-2xl bg-white p-6">
        <p className="text-sm text-neutral-600">Admin access controls are available only to admin role users.</p>
      </section>
    );
  }

  return (
    <AdminAccessView
      promoteEmail={promoteEmail}
      onPromoteEmailChange={setPromoteEmail}
      onPromoteToRole={promoteUserToRole}
      isPending={isPending}
    />
  );
}
