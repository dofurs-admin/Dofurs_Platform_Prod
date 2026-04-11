'use client';

export type ServiceCredit = {
  serviceType: string;
  remainingCredits: number;
  totalCredits: number;
  expiresAt?: string | null;
};

type CreditBalanceWidgetProps = {
  credits: ServiceCredit[];
  planName?: string | null;
  onManage?: () => void;
};

const SERVICE_ICONS: Record<string, string> = {
  grooming: '✂️',
  vet_consultation: '🏥',
  pet_sitting: '🏡',
  training: '🎓',
  default: '🐾',
};

function formatServiceType(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CreditBalanceWidget({
  credits,
  planName,
  onManage,
}: CreditBalanceWidgetProps) {
  if (credits.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⭐</span>
            <p className="text-sm font-semibold text-amber-900">No active credits</p>
          </div>
          {onManage && (
            <button
              type="button"
              onClick={onManage}
              className="text-xs font-semibold text-coral hover:underline"
            >
              View Plans →
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalRemaining = credits.reduce((sum, c) => sum + c.remainingCredits, 0);

  return (
    <div className="rounded-2xl border border-[#ead3bf] bg-[linear-gradient(135deg,#fffaf4_0%,#ffffff_100%)] p-4 shadow-[0_8px_20px_rgba(147,101,63,0.08)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {planName ?? 'Service Credits'}
            </p>
            <p className="text-xs text-neutral-500">{totalRemaining} credits remaining</p>
          </div>
        </div>
        {onManage && (
          <button
            type="button"
            onClick={onManage}
            className="text-xs font-semibold text-coral hover:underline"
          >
            Manage →
          </button>
        )}
      </div>

      {/* Credit bars */}
      <div className="mt-4 space-y-3">
        {credits.map((credit) => {
          const pct = credit.totalCredits > 0
            ? Math.round((credit.remainingCredits / credit.totalCredits) * 100)
            : 0;
          const icon = SERVICE_ICONS[credit.serviceType] ?? SERVICE_ICONS.default;

          return (
            <div key={credit.serviceType}>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-neutral-700">
                  <span>{icon}</span>
                  {formatServiceType(credit.serviceType)}
                </span>
                <span className="font-semibold text-neutral-900">
                  {credit.remainingCredits}/{credit.totalCredits}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#e49a57,#cf8347)] transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {credit.expiresAt && (
                <p className="mt-0.5 text-[10px] text-neutral-400">
                  Expires {credit.expiresAt}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
