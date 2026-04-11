'use client';

type SubscriptionUpsellBannerProps = {
  bookingAmount: number;
  planName?: string;
  savingsAmount?: number;
  onUpgrade?: () => void;
  onDismiss?: () => void;
  className?: string;
};

export default function SubscriptionUpsellBanner({
  bookingAmount,
  planName = 'Care Plan',
  savingsAmount,
  onUpgrade,
  onDismiss,
  className = '',
}: SubscriptionUpsellBannerProps) {
  const displaySavings = savingsAmount ?? Math.round(bookingAmount * 0.15);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,#fffbf0_0%,#fff8e7_50%,#fff4d6_100%)] p-4 shadow-sm ${className}`}>
      {/* Decorative blob */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-100/60" aria-hidden="true" />

      <div className="relative flex items-start gap-3">
        <span className="shrink-0 text-2xl">⭐</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            Save ₹{displaySavings} with {planName}
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            Subscribers pay less on every service + get priority slots and perks.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Upgrade &amp; Save
              </button>
            )}
            <span className="text-xs text-amber-600">
              Plans from ₹299/month
            </span>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-full p-1 text-amber-600 transition-colors hover:bg-amber-100"
            aria-label="Dismiss"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
