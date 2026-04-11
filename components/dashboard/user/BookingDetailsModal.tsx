'use client';

import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { Booking } from './types';
import {
  resolveBookingStatus,
  userDisplayStatus,
  bookingStatusMeta,
  formatBookingDate,
  formatBookingTimeRange,
  formatBookingMode,
  formatPaymentMode,
  formatBookingAmount,
} from './bookingUtils';

type Props = {
  activeBooking: Booking | null;
  isCancellingBookingId: number | null;
  onClose: () => void;
  onCancelRequest: (bookingId: number) => void;
};

export default function BookingDetailsModal({
  activeBooking,
  isCancellingBookingId,
  onClose,
  onCancelRequest,
}: Props) {
  return (
    <Modal
      isOpen={activeBooking !== null}
      onClose={onClose}
      title={activeBooking ? `Booking #${activeBooking.id}` : 'Booking Details'}
      description="Review booking details and take action without leaving the dashboard."
      size="lg"
    >
      {activeBooking ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#ead3bf] bg-[linear-gradient(135deg,#fffaf4_0%,#ffffff_45%,#fff3e7_100%)] p-5 shadow-[0_14px_30px_rgba(147,101,63,0.10)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Service Booking</p>
                <h3 className="mt-1 text-lg font-bold text-neutral-950">{activeBooking.service_type ?? 'Service'}</h3>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${bookingStatusMeta(userDisplayStatus(resolveBookingStatus(activeBooking))).toneClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${bookingStatusMeta(userDisplayStatus(resolveBookingStatus(activeBooking))).dotClass}`} />
                {bookingStatusMeta(userDisplayStatus(resolveBookingStatus(activeBooking))).label}
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-[#ead3bf] bg-white/85 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Date</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {formatBookingDate(activeBooking.booking_date ?? activeBooking.booking_start)}
                </p>
              </div>
              <div className="rounded-xl border border-[#ead3bf] bg-white/85 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Time Slot</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {formatBookingTimeRange(activeBooking.start_time, activeBooking.end_time, activeBooking.booking_start)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-[#ead3bf] bg-[#fffaf4] p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Mode</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{formatBookingMode(activeBooking.booking_mode)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Payment</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {formatPaymentMode(activeBooking.payment_mode, {
                  walletCreditsAppliedInr: activeBooking.wallet_credits_applied_inr,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Amount</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{formatBookingAmount(activeBooking.amount)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Provider Reference</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {activeBooking.provider_id
                  ? `Provider ${activeBooking.provider_id}`
                  : 'Provider will be assigned after confirmation'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#ead3bf] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Progress</p>
            <div className="mt-3 flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${bookingStatusMeta(userDisplayStatus(resolveBookingStatus(activeBooking))).dotClass}`} />
              <p className="text-sm font-medium text-neutral-700">
                Booking is currently{' '}
                <span className="font-semibold text-neutral-900">
                  {bookingStatusMeta(userDisplayStatus(resolveBookingStatus(activeBooking))).label.toLowerCase()}
                </span>
                .
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-3">
            <Link href="/forms/customer-booking">
              <Button type="button" variant="premium">
                Book Another Service
              </Button>
            </Link>
            {(resolveBookingStatus(activeBooking) === 'pending' ||
              resolveBookingStatus(activeBooking) === 'confirmed') && (
              <>
                <Link href={`/forms/customer-booking?reschedule=${activeBooking.id}`}>
                  <Button type="button" variant="premium">
                    Reschedule
                  </Button>
                </Link>
                <Button
                  variant="danger"
                  type="button"
                  isLoading={isCancellingBookingId === activeBooking.id}
                  onClick={() => {
                    onClose();
                    onCancelRequest(activeBooking.id);
                  }}
                >
                  Cancel Booking
                </Button>
              </>
            )}
            <Button type="button" variant="premium" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
