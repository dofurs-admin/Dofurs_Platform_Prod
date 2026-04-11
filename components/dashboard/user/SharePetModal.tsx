'use client';

import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FormField from '@/components/dashboard/FormField';
import type { PetShareRecord } from './types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  shareInviteEmail: string;
  shareInviteRole: 'manager' | 'viewer';
  petShares: PetShareRecord[];
  isLoadingShares: boolean;
  isMutatingShares: boolean;
  onShareInviteEmailChange: (email: string) => void;
  onShareInviteRoleChange: (role: 'manager' | 'viewer') => void;
  onInvite: () => void;
  onUpdateRole: (shareId: string, role: 'manager' | 'viewer') => void;
  onRevoke: (shareId: string) => void;
};

export default function SharePetModal({
  isOpen,
  onClose,
  shareInviteEmail,
  shareInviteRole,
  petShares,
  isLoadingShares,
  isMutatingShares,
  onShareInviteEmailChange,
  onShareInviteRoleChange,
  onInvite,
  onUpdateRole,
  onRevoke,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Pet Access"
      description="Invite family members by email so they can access this pet profile in their account."
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <FormField
            label="Invite by email"
            value={shareInviteEmail}
            onChange={(event) => onShareInviteEmailChange(event.target.value)}
            placeholder="person@example.com"
          />
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-900">Role</label>
            <select
              value={shareInviteRole}
              onChange={(event) => onShareInviteRoleChange(event.target.value as 'manager' | 'viewer')}
              className="w-full rounded-xl border border-[#e8cfb7] bg-white px-3 py-2 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={onInvite} disabled={isMutatingShares} className="w-full sm:w-auto">
              Invite
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-[#ead3bf] bg-[#fffaf4] p-3 text-xs text-neutral-600">
          <p><span className="font-semibold text-neutral-900">Manager:</span> can edit passport details.</p>
          <p><span className="font-semibold text-neutral-900">Viewer:</span> read-only access.</p>
        </div>

        {isLoadingShares ? (
          <p className="text-sm text-neutral-600">Loading shared users...</p>
        ) : petShares.length === 0 ? (
          <p className="text-sm text-neutral-600">No shared users yet.</p>
        ) : (
          <div className="space-y-2">
            {petShares.map((share) => (
              <div key={share.id} className="rounded-xl border border-[#ead3bf] bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{share.invited_email}</p>
                    <p className="text-xs text-neutral-600">
                      {share.status === 'active' ? 'Active' : 'Pending'} &bull; invited {new Date(share.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={share.role}
                      onChange={(event) => onUpdateRole(share.id, event.target.value as 'manager' | 'viewer')}
                      disabled={isMutatingShares}
                      className="rounded-lg border border-[#e8cfb7] bg-white px-2 py-1 text-xs"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onRevoke(share.id)}
                      disabled={isMutatingShares}
                      className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
