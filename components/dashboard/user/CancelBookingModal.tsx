'use client';

import Button from '@/components/ui/Button';

type Props = {
  pendingCancellationBookingId: number | null;
  isCancellingBookingId: number | null;
  onClose: () => void;
  onConfirm: () => void;
};

export default function CancelBookingModal({
  pendingCancellationBookingId,
  isCancellingBookingId,
  onClose,
  onConfirm,
}: Props) {
  if (pendingCancellationBookingId === null) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-900/45 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e2c3a7] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f1_100%)] p-5 shadow-[0_22px_44px_rgba(94,61,35,0.28)]">
        <h3 className="text-lg font-semibold text-neutral-950">Cancel this booking?</h3>
        <p className="mt-2 text-sm text-neutral-600">
          This action will mark booking #{pendingCancellationBookingId} as cancelled and cannot be undone.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="premium"
            type="button"
            onClick={onClose}
            isLoading={isCancellingBookingId !== null}
          >
            Keep Booking
          </Button>
          <Button variant="danger" type="button" onClick={onConfirm}>
            Yes, Cancel Booking
          </Button>
        </div>
      </div>
    </div>
  );
}
