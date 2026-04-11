/**
 * Modal Component
 * 
 * Accessible modal dialog with overlay and animations.
 */

'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/design-system';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  autoFocusInteractive?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  autoFocusInteractive = true,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to first interactive element when modal opens
  useEffect(() => {
    if (!isOpen || !autoFocusInteractive) return;

    const raf = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        const container = contentRef.current;
        if (!container) return;
        const target = container.querySelector<HTMLElement>(
          '[data-autofocus], [aria-invalid="true"], input:not([type="hidden"]):not([aria-hidden="true"]), select, textarea, [role="combobox"]'
        );
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (target.matches('input, select, textarea')) {
            target.focus({ preventScroll: true });
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    });

    return () => cancelAnimationFrame(raf);
  }, [isOpen, autoFocusInteractive]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const modalContent = (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[58] bg-black/55 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 pointer-events-none sm:items-center">
        <div
          className={cn(
            'card card-padding relative w-full max-h-[calc(100dvh-2rem)] overflow-y-auto animate-scale-in pointer-events-auto border border-neutral-200/70 shadow-2xl shadow-black/20',
            sizes[size]
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          {showCloseButton && (
            <button
              onClick={onClose}
              className="absolute right-3 top-3 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Close modal"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          {/* Header */}
          {(title || description) && (
            <div className="mb-6 space-y-2 border-b border-neutral-200/70 pb-4">
              {title && (
                <h2 id="modal-title" className="text-card-title pr-8">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-neutral-600">{description}</p>
              )}
            </div>
          )}

          {/* Content */}
          <div ref={contentRef}>{children}</div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}

// Modal Footer for action buttons
interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end',
        className
      )}
    >
      {children}
    </div>
  );
}
