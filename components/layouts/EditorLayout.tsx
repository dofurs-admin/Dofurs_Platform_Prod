/**
 * EditorLayout
 * 
 * Multi-step guided editor experience with progress tracking.
 * Used for Pet Passport editor, booking wizards, and multi-step forms.
 */

'use client';

import { ReactNode } from 'react';

interface Step {
  id: string;
  title: string;
  description?: string;
}

interface EditorLayoutProps {
  steps: Step[];
  currentStep: number;
  title: string;
  subtitle?: string;
  avatar?: ReactNode;
  saveStatus?: 'saving' | 'saved' | 'error' | null;
  progress?: number;
  children: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  showStepIndicator?: boolean;
}

export default function EditorLayout({
  steps,
  currentStep,
  title,
  subtitle,
  avatar,
  saveStatus,
  progress,
  children,
  actions,
  onBack,
  onNext,
  nextLabel = 'Next',
  backLabel = 'Back',
  showStepIndicator = true,
}: EditorLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Header */}
      <div className="border-b border-neutral-200/60 bg-white">
        <div className="container-premium py-8">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            {avatar && (
              <div className="flex-shrink-0">
                {avatar}
              </div>
            )}

            {/* Title and Status */}
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <h1 className="text-page-title">{title}</h1>
                {subtitle && (
                  <p className="text-body text-neutral-600">{subtitle}</p>
                )}
              </div>

              {/* Save Status */}
              {saveStatus && (
                <div className="flex items-center gap-2 text-xs">
                  {saveStatus === 'saving' && (
                    <>
                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-neutral-600">Saving...</span>
                    </>
                  )}
                  {saveStatus === 'saved' && (
                    <>
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-neutral-600">Saved just now</span>
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <>
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-red-600">Failed to save</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Progress Ring (optional) */}
            {progress !== undefined && (
              <div className="flex-shrink-0">
                <ProgressRing progress={progress} size={64} />
              </div>
            )}
          </div>

          {/* Step Indicator */}
          {showStepIndicator && steps.length > 1 && (
            <div className="mt-8">
              <StepIndicator steps={steps} currentStep={currentStep} />
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="container-premium py-8">
        <div className="mx-auto max-w-4xl">
          {children}
        </div>
      </div>

      {/* Sticky Action Bar */}
      {(onBack || onNext || actions) && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-200/60 bg-white/80 backdrop-blur-md">
          <div className="container-premium py-4">
            <div className="flex items-center justify-between">
              <div>
                {onBack && (
                  <button
                    onClick={onBack}
                    className="btn-secondary"
                    type="button"
                  >
                    {backLabel}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {actions}
                {onNext && (
                  <button
                    onClick={onNext}
                    className="btn-primary"
                    type="button"
                  >
                    {nextLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Step Indicator Component
function StepIndicator({ steps, currentStep }: { steps: Step[]; currentStep: number }) {
  return (
    <nav aria-label="Progress" className="overflow-x-auto">
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isUpcoming = index > currentStep;

          return (
            <li key={step.id} className="flex items-center gap-2">
              {/* Step Circle */}
              <div className="flex items-center gap-3">
                <div
                  className={`
                    flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200
                    ${isActive ? 'bg-coral text-white shadow-md scale-110' : ''}
                    ${isCompleted ? 'bg-emerald-500 text-white' : ''}
                    ${isUpcoming ? 'bg-neutral-200 text-neutral-500' : ''}
                  `}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`
                    hidden sm:inline text-sm font-medium transition-all duration-200
                    ${isActive ? 'text-neutral-900' : ''}
                    ${isCompleted ? 'text-neutral-700' : ''}
                    ${isUpcoming ? 'text-neutral-500' : ''}
                  `}
                >
                  {step.title}
                </span>
              </div>

              {/* Separator Line */}
              {index < steps.length - 1 && (
                <div
                  className={`
                    h-px w-12 transition-all duration-200
                    ${isCompleted ? 'bg-emerald-500' : 'bg-neutral-200'}
                  `}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Progress Ring Component
function ProgressRing({ progress, size = 64 }: { progress: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-neutral-200"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-emerald-500 transition-all duration-300"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-neutral-900">{Math.round(progress)}%</span>
      </div>
    </div>
  );
}
