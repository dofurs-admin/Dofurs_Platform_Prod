'use client';

export type BookingProgressStep = {
  id: string;
  label: string;
  sublabel?: string;
};

type BookingProgressBarProps = {
  steps: BookingProgressStep[];
  currentStepId: string;
  className?: string;
};

export default function BookingProgressBar({
  steps,
  currentStepId,
  className = '',
}: BookingProgressBarProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const totalSteps = steps.length;
  const progressPct = totalSteps > 1 ? (currentIndex / (totalSteps - 1)) * 100 : 0;

  return (
    <div
      className={`sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 border-b border-[#e8d5c0] bg-white/95 px-3 py-2 backdrop-blur-sm max-[380px]:px-2.5 max-[380px]:py-1.5 sm:top-20 sm:px-6 sm:py-3 ${className}`}
    >
      <div className="mx-auto max-w-3xl">
        {/* Step labels row */}
        <div className="mb-1.5 flex items-center justify-between sm:mb-2.5">
          {steps.map((step, idx) => {
            const isDone = idx < currentIndex;
            const isActive = idx === currentIndex;

            return (
              <div key={step.id} className="flex flex-col items-center gap-0.5">
                <div
                  className={`flex h-5.5 w-5.5 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-200 sm:h-6 sm:w-6 sm:text-xs ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isActive
                        ? 'bg-coral text-white ring-4 ring-coral/20'
                        : 'border-2 border-neutral-300 bg-white text-neutral-400'
                  }`}
                >
                  {isDone ? (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`hidden text-[10px] font-semibold sm:block ${
                    isActive ? 'text-coral' : isDone ? 'text-emerald-600' : 'text-neutral-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress track */}
        <div className="relative h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#e49a57,#cf8347)] transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Mobile: current step label */}
        <p className="mt-1 text-center text-[11px] font-semibold text-coral max-[380px]:hidden sm:hidden">
          Step {currentIndex + 1} of {totalSteps}: {steps[currentIndex]?.label}
        </p>
      </div>
    </div>
  );
}
