'use client';

import { useRef, useEffect, useState } from 'react';

interface PetStepperProps {
  steps: string[];
  currentStep: number;
  completedSteps: boolean[];
  onStepClick: (stepIndex: number) => void;
}

export default function PetStepper({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: PetStepperProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    const handleScroll = () => {
      if (!scrollContainer) return;

      const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 10);
    };

    handleScroll();
    scrollContainer?.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    return () => {
      scrollContainer?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 200;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-4">
      {/* Desktop: Horizontal stepper */}
      <div className="relative hidden sm:block">
        {/* Scroll buttons */}
        {showLeftScroll && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-2 shadow-md transition-all duration-150 ease-out hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
            aria-label="Scroll left"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {showRightScroll && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-2 shadow-md transition-all duration-150 ease-out hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
            aria-label="Scroll right"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Scrollable container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto px-12 py-4 scrollbar-hide"
          style={{ scrollBehavior: 'smooth' }}
        >
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = completedSteps[index];

            return (
              <div key={step} className="flex items-center gap-3 flex-shrink-0">
                {/* Step button */}
                <button
                  onClick={() => onStepClick(index)}
                  className={`flex min-w-fit items-center gap-2 rounded-xl px-4 py-2 font-semibold transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1 ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-md ring-2 ring-brand-500/30'
                      : isCompleted
                        ? 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
                        : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                      isActive ? 'bg-white text-brand-500' : isCompleted ? 'bg-green-500 text-white' : 'bg-neutral-300 text-neutral-600'
                    }`}
                  >
                    {isCompleted ? '✓' : index + 1}
                  </span>
                  <span className="hidden sm:inline text-sm">{step}</span>
                </button>

                {/* Connecting line */}
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 w-8 rounded-full transition-colors duration-200 ${
                      isCompleted ? 'bg-green-500' : 'bg-neutral-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: Horizontal scroll stepper */}
      <div className="sm:hidden">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-2 pr-2">
            {steps.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = completedSteps[index];

              return (
                <div key={step} className="flex items-center gap-2">
                  <button
                    onClick={() => onStepClick(index)}
                    className={`flex min-h-11 min-w-[150px] items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1 ${
                      isActive
                        ? 'bg-brand-500 text-white shadow-md'
                        : isCompleted
                          ? 'bg-neutral-100 text-neutral-900'
                          : 'border border-neutral-200 bg-white text-neutral-600'
                    }`}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        isActive ? 'bg-white text-brand-500' : isCompleted ? 'bg-green-500 text-white' : 'bg-neutral-300 text-neutral-600'
                      }`}
                    >
                      {isCompleted ? '✓' : index + 1}
                    </span>
                    <span className="truncate">{step}</span>
                  </button>

                  {index < steps.length - 1 ? <div className="h-1 w-4 rounded-full bg-neutral-200" aria-hidden="true" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <p className="text-xs text-neutral-500 text-center sm:text-right">
        Step {currentStep + 1} of {steps.length}
      </p>
    </div>
  );
}
