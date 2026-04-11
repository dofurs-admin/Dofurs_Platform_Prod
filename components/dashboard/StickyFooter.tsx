'use client';

import Button from '@/components/ui/Button';

interface StickyFooterProps {
  stepNumber: number;
  totalSteps: number;
  onPrevious?: () => void;
  onNextOrSave?: () => void;
  onSaveDraft?: () => void;
  isEnabled?: boolean;
  isLoading?: boolean;
  isPreviousDisabled?: boolean;
  isNextDisabled?: boolean;
  draftSaved?: boolean;
  savingStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

export default function StickyFooter({
  stepNumber,
  totalSteps,
  onPrevious,
  onNextOrSave,
  onSaveDraft,
  isEnabled = true,
  isLoading = false,
  isPreviousDisabled = false,
  isNextDisabled = false,
  draftSaved = false,
  savingStatus = 'idle',
}: StickyFooterProps) {
  if (!isEnabled) return null;

  const isLastStep = stepNumber === totalSteps;
  const isSaving = savingStatus === 'saving';
  const isSaved = savingStatus === 'saved';

  return (
    <div className="fixed bottom-[calc(var(--dofurs-mobile-nav-height)+var(--dofurs-mobile-safe-bottom)+0.45rem)] left-0 right-0 border-t border-neutral-200/40 bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:bottom-0">
      <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          {/* Left: Previous button */}
          <Button
            variant="secondary"
            onClick={onPrevious}
            disabled={isPreviousDisabled || isLoading}
            className="w-full sm:w-auto"
          >
            ← Previous
          </Button>

          {/* Center: Status and Draft save */}
          <div className="order-first flex flex-col items-center gap-1 text-xs sm:order-none">
            <div className="text-neutral-600">
              Step <span className="font-semibold">{stepNumber}</span> of{' '}
              <span className="font-semibold">{totalSteps}</span>
            </div>

            {/* Save status indicator */}
            {draftSaved && !isLastStep && (
              <div className="flex items-center gap-1 text-neutral-500">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span>Draft saved</span>
              </div>
            )}

            {isSaving && (
              <div className="flex items-center gap-1 text-neutral-500">
                <div className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                <span>Saving...</span>
              </div>
            )}

            {isSaved && (
              <div className="flex items-center gap-1 text-emerald-600">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Saved successfully</span>
              </div>
            )}
          </div>

          {/* Right: Save and Next/Complete button */}
          <div className="flex w-full gap-2 sm:w-auto">
            {!isLastStep && onSaveDraft && (
              <Button
                variant="ghost"
                onClick={onSaveDraft}
                disabled={isLoading}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                💾 Save Draft
              </Button>
            )}

            <Button
              onClick={onNextOrSave}
              disabled={isNextDisabled || isLoading}
              isLoading={isLoading}
              className="flex-1 sm:flex-none"
            >
              {isLastStep ? 'Complete ✓' : 'Next →'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
