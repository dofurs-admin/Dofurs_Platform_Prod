/**
 * BookingFlowLayout
 * 
 * Multi-step booking wizard with sticky summary sidebar.
 * Optimized for desktop (sidebar) and mobile (bottom summary).
 */

'use client';

import { ReactNode } from 'react';

interface BookingStep {
  id: string;
  title: string;
  description?: string;
}

interface BookingFlowLayoutProps {
  steps: BookingStep[];
  currentStep: number;
  summaryCard: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
}

export default function BookingFlowLayout({
  steps,
  currentStep,
  summaryCard,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  backLabel = 'Back',
  nextDisabled = false,
}: BookingFlowLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header with Step Indicator */}
      <div className="border-b border-neutral-200/60 bg-white">
        <div className="container-premium py-6">
          <BookingStepIndicator steps={steps} currentStep={currentStep} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container-premium py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
          {/* Left: Main Content */}
          <div className="space-y-6">
            {/* Current Step Info */}
            <div className="space-y-2">
              <h1 className="text-page-title">{steps[currentStep]?.title}</h1>
              {steps[currentStep]?.description && (
                <p className="text-body text-neutral-600">
                  {steps[currentStep].description}
                </p>
              )}
            </div>

            {/* Step Content */}
            <div className="fade-in">
              {children}
            </div>

            {/* Action Buttons (Mobile) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between lg:hidden">
              {onBack && (
                <button
                  onClick={onBack}
                  className="btn-secondary"
                  type="button"
                >
                  {backLabel}
                </button>
              )}
              {onNext && (
                <button
                  onClick={onNext}
                  className="btn-primary flex-1 sm:flex-none"
                  type="button"
                  disabled={nextDisabled}
                >
                  {nextLabel}
                </button>
              )}
            </div>
          </div>

          {/* Right: Sticky Summary Sidebar (Desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-6 space-y-6">
              {summaryCard}

              {/* Action Buttons (Desktop) */}
              <div className="space-y-3">
                {onNext && (
                  <button
                    onClick={onNext}
                    className="btn-primary w-full"
                    type="button"
                    disabled={nextDisabled}
                  >
                    {nextLabel}
                  </button>
                )}
                {onBack && (
                  <button
                    onClick={onBack}
                    className="btn-secondary w-full"
                    type="button"
                  >
                    {backLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Summary (Mobile) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-neutral-200/60 bg-white p-4 shadow-premium-lg">
        {summaryCard}
      </div>
    </div>
  );
}

// Booking Step Indicator
function BookingStepIndicator({ steps, currentStep }: { steps: BookingStep[]; currentStep: number }) {
  return (
    <nav aria-label="Booking progress">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isUpcoming = index > currentStep;

          return (
            <li key={step.id} className="flex items-center flex-1">
              {/* Step Content */}
              <div className="flex flex-col items-center flex-1 gap-2">
                {/* Step Number */}
                <div
                  className={`
                    relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-200
                    ${isActive ? 'bg-coral text-white shadow-lg scale-110' : ''}
                    ${isCompleted ? 'bg-emerald-500 text-white' : ''}
                    ${isUpcoming ? 'bg-neutral-200 text-neutral-400' : ''}
                  `}
                >
                  {isCompleted ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Step Title */}
                <span
                  className={`
                    hidden sm:block text-xs font-medium text-center transition-all duration-200
                    ${isActive ? 'text-neutral-900' : ''}
                    ${isCompleted ? 'text-neutral-700' : ''}
                    ${isUpcoming ? 'text-neutral-400' : ''}
                  `}
                >
                  {step.title}
                </span>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 max-w-[80px] h-px mx-2 -mt-8">
                  <div
                    className={`
                      h-full transition-all duration-300
                      ${isCompleted ? 'bg-emerald-500' : 'bg-neutral-200'}
                    `}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Booking Summary Card Component
interface BookingSummaryProps {
  title?: string;
  items: Array<{
    label: string;
    value: string | ReactNode;
  }>;
  total?: {
    label: string;
    value: string;
  };
  className?: string;
}

export function BookingSummary({ title = 'Booking Summary', items, total, className = '' }: BookingSummaryProps) {
  return (
    <div className={`card card-padding space-y-4 ${className}`}>
      <h3 className="text-card-title">{title}</h3>
      
      {/* Summary Items */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-start justify-between gap-4">
            <span className="text-sm text-neutral-600">{item.label}</span>
            <span className="text-sm font-medium text-neutral-900 text-right">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      {total && (
        <>
          <div className="border-t border-neutral-200/60 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-neutral-900">{total.label}</span>
              <span className="text-lg font-bold text-neutral-900">{total.value}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
