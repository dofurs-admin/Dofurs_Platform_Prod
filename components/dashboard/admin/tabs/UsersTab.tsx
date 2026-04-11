'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminUsersView from '@/components/dashboard/admin/views/AdminUsersView';
import Modal from '@/components/ui/Modal';
import { Input } from '@/components/ui';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouter } from 'next/navigation';

type AdminUserCreateDraft = {
  name: string;
  email: string;
  phone: string;
  noEmailInvite: boolean;
};

type AdminUserSearchResult = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  age: number | null;
  gender: string | null;
  photo_url: string | null;
  created_at: string;
  role: string | null;
  profile_type: 'admin' | 'staff' | 'provider' | 'customer';
  pets: Array<{
    id: string;
    name: string;
    breed: string | null;
    age: number | null;
    gender: string | null;
    color: string | null;
    size_category: string | null;
    energy_level: string | null;
    created_at: string;
  }>;
};

export default function UsersTab() {
  const { showToast } = useToast();
  const router = useRouter();
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchDebounced, setUserSearchDebounced] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<AdminUserSearchResult[]>([]);
  const [isUserSearchLoading, setIsUserSearchLoading] = useState(false);

  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserDraft, setCreateUserDraft] = useState<AdminUserCreateDraft>({
    name: '',
    email: '',
    phone: '',
    noEmailInvite: false,
  });

  // Debounce search
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setUserSearchDebounced(userSearchQuery.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [userSearchQuery]);

  const fetchUsers = useCallback(async () => {
    if (!userSearchDebounced) {
      setUserSearchResults([]);
      setIsUserSearchLoading(false);
      return;
    }
    setIsUserSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('q', userSearchDebounced);
      params.set('limit', '25');
      const response = await fetch(`/api/admin/users/search?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as { users?: AdminUserSearchResult[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Unable to load users.');
      setUserSearchResults(payload?.users ?? []);
    } catch (error) {
      setUserSearchResults([]);
      showToast(error instanceof Error ? error.message : 'Unable to load users.', 'error');
    } finally {
      setIsUserSearchLoading(false);
    }
  }, [userSearchDebounced, showToast]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  function resetCreateUserDraft() {
    setCreateUserDraft({ name: '', email: '', phone: '', noEmailInvite: false });
  }

  async function createDirectoryUser(options?: { openBookingsAfterCreate?: boolean }) {
    const name = createUserDraft.name.trim();
    const email = createUserDraft.email.trim().toLowerCase();
    const phone = createUserDraft.phone.trim();
    const noEmailInvite = createUserDraft.noEmailInvite;

    if (name.length < 2) { showToast('Name should be at least 2 characters.', 'error'); return; }
    if (!noEmailInvite && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Enter a valid email address.', 'error'); return; }
    if (phone.replace(/\D/g, '').length < 10) { showToast('Enter a valid phone number.', 'error'); return; }

    setIsCreatingUser(true);
    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: noEmailInvite ? '' : email, phone, noEmailInvite }),
      });
      const payload = await response.json().catch(() => null) as {
        success?: boolean;
        error?: string;
        inviteSent?: boolean;
        user?: { id: string; name: string; email: string | null; phone: string };
      } | null;

      if (!response.ok || !payload?.success || !payload.user) {
        throw new Error(payload?.error ?? 'Unable to create user.');
      }

      setIsCreateUserModalOpen(false);
      resetCreateUserDraft();
      setUserSearchQuery(payload.user.email || payload.user.phone || payload.user.id);
      showToast(
        payload.inviteSent
          ? 'User added successfully. Invitation email sent.'
          : 'User added successfully without email invite.',
        'success',
      );

      if (options?.openBookingsAfterCreate) {
        router.push('/dashboard/admin/bookings');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create user.', 'error');
    } finally {
      setIsCreatingUser(false);
    }
  }

  return (
    <>
      <AdminUsersView
        userSearchQuery={userSearchQuery}
        onSearchChange={setUserSearchQuery}
        isLoading={isUserSearchLoading}
        searchDebounced={userSearchDebounced}
        searchResults={userSearchResults}
        onAddUser={() => setIsCreateUserModalOpen(true)}
      />

      <Modal
        isOpen={isCreateUserModalOpen}
        onClose={() => {
          if (isCreatingUser) return;
          setIsCreateUserModalOpen(false);
          resetCreateUserDraft();
        }}
        size="md"
        title="Add New Customer"
        description="Create a customer profile from admin dashboard, with optional no-email fallback."
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={createUserDraft.name}
            onChange={(e) => setCreateUserDraft((c) => ({ ...c, name: e.target.value }))}
            placeholder="Customer full name"
          />
          {!createUserDraft.noEmailInvite ? (
            <Input
              label="Email"
              type="email"
              value={createUserDraft.email}
              onChange={(e) => setCreateUserDraft((c) => ({ ...c, email: e.target.value }))}
              placeholder="customer@example.com"
            />
          ) : null}
          <Input
            label="Phone"
            value={createUserDraft.phone}
            onChange={(e) => setCreateUserDraft((c) => ({ ...c, phone: e.target.value }))}
            placeholder="9876543210 or +919876543210"
          />

          <label className="inline-flex items-start gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
            <input
              type="checkbox"
              checked={createUserDraft.noEmailInvite}
              onChange={(e) =>
                setCreateUserDraft((c) => ({
                  ...c,
                  noEmailInvite: e.target.checked,
                  email: e.target.checked ? '' : c.email,
                }))
              }
              className="mt-0.5"
            />
            <span>Customer has no email. Create a phone-only profile without sending invite.</span>
          </label>

          <div className="rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
            {createUserDraft.noEmailInvite
              ? 'No invite email will be sent. Continue to Bookings and search by phone.'
              : 'The user will receive an invitation email. Continue to Bookings and search by email or phone.'}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (isCreatingUser) return;
                setIsCreateUserModalOpen(false);
                resetCreateUserDraft();
              }}
              disabled={isCreatingUser}
              className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#ffefe0] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createDirectoryUser()}
              disabled={isCreatingUser}
              className="rounded-full border border-[#f2dfcf] bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#fff7f0] disabled:opacity-60"
            >
              {isCreatingUser ? 'Creating...' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={() => void createDirectoryUser({ openBookingsAfterCreate: true })}
              disabled={isCreatingUser}
              className="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingUser ? 'Creating...' : 'Create & Open Bookings'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
