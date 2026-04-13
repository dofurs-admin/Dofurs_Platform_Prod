'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
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

type BookingReview = {
  id: string;
  rating: number;
  review_text: string | null;
  provider_response: string | null;
  created_at: string;
};

export default function BookingDetailsModal({
  activeBooking,
  isCancellingBookingId,
  onClose,
  onCancelRequest,
}: Props) {
  const [review, setReview] = useState<BookingReview | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [isSubmittingReview, startReviewTransition] = useTransition();

  const isCompletedBooking = useMemo(() => {
    if (!activeBooking) return false;
    return resolveBookingStatus(activeBooking) === 'completed';
  }, [activeBooking]);

  useEffect(() => {
    let active = true;

    setReview(null);
    setCanReview(false);
    setReviewError(null);
    setReviewText('');
    setReviewRating(5);

    if (!activeBooking || !isCompletedBooking) {
      return () => {
        active = false;
      };
    }

    const bookingId = activeBooking.id;

    async function loadReview() {
      setIsReviewLoading(true);
      try {
        const response = await fetch(`/api/user/bookings/${bookingId}/review`, {
          cache: 'no-store',
        });

        const payload = (await response.json().catch(() => null)) as {
          canReview?: boolean;
          review?: BookingReview | null;
          error?: string;
        } | null;

        if (!active) return;

        if (!response.ok) {
          setReviewError(payload?.error ?? 'Unable to load review details.');
          return;
        }

        setCanReview(Boolean(payload?.canReview));
        setReview(payload?.review ?? null);
      } catch {
        if (!active) return;
        setReviewError('Unable to load review details.');
      } finally {
        if (active) {
          setIsReviewLoading(false);
        }
      }
    }

    void loadReview();

    return () => {
      active = false;
    };
  }, [activeBooking, isCompletedBooking]);

  function submitReview() {
    if (!activeBooking || !canReview || review || isSubmittingReview) {
      return;
    }

    const bookingId = activeBooking.id;

    setReviewError(null);

    startReviewTransition(async () => {
      try {
        const response = await fetch(`/api/user/bookings/${bookingId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: reviewRating,
            reviewText: reviewText.trim() || undefined,
          }),
        });

        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          review?: BookingReview;
          error?: string;
        } | null;

        if (!response.ok || !payload?.review) {
          setReviewError(payload?.error ?? 'Unable to submit review.');
          return;
        }

        setReview(payload.review);
        setReviewText('');
      } catch {
        setReviewError('Unable to submit review.');
      }
    });
  }

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

          {isCompletedBooking && (
            <div className="rounded-xl border border-[#ead3bf] bg-white p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Service Review
              </p>

              {isReviewLoading ? (
                <p className="text-sm text-neutral-500">Loading review details...</p>
              ) : review ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-neutral-900">
                    Your rating: {'★'.repeat(review.rating)}
                  </p>
                  {review.review_text ? (
                    <p className="text-sm text-neutral-700">{review.review_text}</p>
                  ) : (
                    <p className="text-sm text-neutral-500">No written feedback provided.</p>
                  )}
                  {review.provider_response ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Provider Response
                      </p>
                      <p className="mt-1 text-sm text-emerald-900">{review.provider_response}</p>
                    </div>
                  ) : null}
                </div>
              ) : canReview ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setReviewRating(value)}
                        className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                          reviewRating === value
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-neutral-200 bg-white text-neutral-500'
                        }`}
                      >
                        {value}★
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    placeholder="Share what went well or what could improve (optional)"
                    className="w-full rounded-xl border border-[#ead3bf] px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#e6c3a4]"
                    rows={3}
                    maxLength={3000}
                  />

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-neutral-500">{reviewText.length}/3000</p>
                    <Button type="button" onClick={submitReview} isLoading={isSubmittingReview}>
                      Submit Review
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">
                  Review will be available after service completion.
                </p>
              )}

              {reviewError ? <p className="text-xs text-red-600">{reviewError}</p> : null}
            </div>
          )}

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
