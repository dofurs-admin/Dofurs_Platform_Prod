/**
 * ConfirmActionModal
 *
 * Reusable confirmation dialog for destructive and irreversible admin actions.
 * Supports optional text input (replaces window.prompt) and type-to-confirm patterns.
 */

'use client';

import { useEffect, useState } from 'react';
import Modal, { ModalFooter } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export type ConfirmActionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the user confirms. Receives input value when an input field is shown. */
  onConfirm: (inputValue?: string) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
  /** Show a text input field (replaces window.prompt usage). */
  inputLabel?: string;
  inputPlaceholder?: string;
  inputDefaultValue?: string;
  /** Disable confirm until user enters a non-empty value. */
  inputRequired?: boolean;
  /** Force user to type this exact value before confirm is enabled (e.g. "DELETE"). */
  requiredInputValue?: string;
};

const CONFIRM_BUTTON_CLASS: Record<'danger' | 'warning' | 'default', string> = {
  danger:
    'inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  warning:
    'inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  default:
    'inline-flex items-center justify-center gap-2 rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#cf8448] focus:outline-none focus:ring-2 focus:ring-coral/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
};

export default function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  isLoading = false,
  inputLabel,
  inputPlaceholder,
  inputDefaultValue = '',
  inputRequired = false,
  requiredInputValue,
}: ConfirmActionModalProps) {
  const [inputValue, setInputValue] = useState(inputDefaultValue);

  // Reset input whenever modal opens
  useEffect(() => {
    if (isOpen) setInputValue(inputDefaultValue);
  }, [isOpen, inputDefaultValue]);

  const showInput = Boolean(inputLabel ?? requiredInputValue);

  const inputMismatch = requiredInputValue
    ? inputValue !== requiredInputValue
    : false;

  const canConfirm =
    !isLoading &&
    !inputMismatch &&
    (!inputRequired || inputValue.trim().length > 0);

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm(showInput ? inputValue : undefined);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">{description}</p>

        {showInput && (
          <Input
            label={
              requiredInputValue
                ? `Type "${requiredInputValue}" to confirm`
                : (inputLabel ?? undefined)
            }
            placeholder={inputPlaceholder ?? requiredInputValue}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
            }}
          />
        )}

        {requiredInputValue && inputValue.length > 0 && inputMismatch && (
          <p className="text-xs text-red-600">
            Value does not match. Type &ldquo;{requiredInputValue}&rdquo; exactly.
          </p>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className={CONFIRM_BUTTON_CLASS[confirmVariant]}
        >
          {isLoading && (
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
