'use client';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'under_review';
type AccountStatus = 'active' | 'suspended' | 'banned';

interface AdminQuickActionRowProps {
  providerId: number;
  providerName: string;
  adminApprovalStatus: ApprovalStatus;
  accountStatus: AccountStatus;
  disabled?: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onSuspend: (id: number) => void;
  onEnable: (id: number) => void;
}

export default function AdminQuickActionRow({
  providerId,
  providerName,
  adminApprovalStatus,
  accountStatus,
  disabled = false,
  onApprove,
  onReject,
  onSuspend,
  onEnable,
}: AdminQuickActionRowProps) {
  const isPending = adminApprovalStatus === 'pending' || adminApprovalStatus === 'under_review';
  const isRejected = adminApprovalStatus === 'rejected';
  const isApproved = adminApprovalStatus === 'approved';
  const isSuspended = accountStatus === 'suspended';
  const isBanned = accountStatus === 'banned';

  if (!isPending && !isRejected && !(isApproved && !isSuspended) && !isBanned) return null;

  return (
    <div
      className={[
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5',
        isPending
          ? 'border-amber-200 bg-amber-50'
          : isRejected
            ? 'border-red-200 bg-red-50'
            : 'border-neutral-200 bg-neutral-50',
      ].join(' ')}
    >
      {/* Status label */}
      <div className="flex items-center gap-2">
        {isPending && (
          <>
            <span className="text-base">⏳</span>
            <span className="text-xs font-semibold text-amber-700">
              Pending Approval — {providerName}
            </span>
          </>
        )}
        {isRejected && (
          <>
            <span className="text-base">✗</span>
            <span className="text-xs font-semibold text-red-700">
              Rejected — {providerName}
            </span>
          </>
        )}
        {isApproved && !isSuspended && (
          <>
            <span className="text-base">✓</span>
            <span className="text-xs font-semibold text-green-700">
              Active — {providerName}
            </span>
          </>
        )}
        {isBanned && (
          <>
            <span className="text-base">🗃️</span>
            <span className="text-xs font-semibold text-red-700">
              Deleted (history retained) — {providerName}
            </span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {isPending && (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onApprove(providerId)}
              className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onReject(providerId)}
              className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
        {isRejected && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApprove(providerId)}
            className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Re-approve
          </button>
        )}
        {isApproved && !isSuspended && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSuspend(providerId)}
            className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Suspend
          </button>
        )}
        {isSuspended && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEnable(providerId)}
            className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Re-enable
          </button>
        )}
      </div>
    </div>
  );
}
