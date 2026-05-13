'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { Booking } from './types';
import BookingAddonManager, { type BookingAddonItem } from '@/components/dashboard/shared/BookingAddonManager';
import { getGroomingPackageByServiceType } from '@/lib/service-catalog/grooming-packages';
import { ACTIVE_BOOKING_ADDON_STATUSES } from '@/lib/bookings/addon-items';
import { resolveIncludedServicesForBooking } from '@/lib/bookings/included-services';
import { buildIncludedServicesLabel } from '@/lib/bookings/included-services';
import {
  resolveBookingStatus,
  userDisplayStatus,
  bookingStatusMeta,
  formatBookingDate,
  formatBookingTimeRange,
  formatBookingMode,
  formatPaymentMode,
  formatBookingAmount,
  resolveProviderName,
} from './bookingUtils';

type Props = {
  activeBooking: Booking | null;
  isCancellingBookingId: number | null;
  onClose: () => void;
  onCancelRequest: (bookingId: number) => void;
  onPaymentSuccess?: () => void;
  onBookingUpdated?: () => void;
};

type BookingReview = {
  id: string;
  rating: number;
  review_text: string | null;
  provider_response: string | null;
  created_at: string;
};

function resolveAddonTotal(item: BookingAddonItem) {
  return Math.max(0, Number(item.total_price_inr ?? item.total_price_snapshot ?? 0));
}

function resolveAddonUnitPrice(item: BookingAddonItem) {
  const quantity = Math.max(1, Number(item.quantity ?? 1));
  return resolveAddonTotal(item) / quantity;
}

type BookingPricingSummary = {
  serviceLines: Array<{ name: string; priceInr: number; isEstimated: boolean }>;
  serviceLabel: string;
  isBundledServices: boolean;
  addOnLines: Array<{ id: string; name: string; quantity: number; unitPriceInr: number; totalPriceInr: number }>;
  serviceSubtotalInr: number;
  addonSubtotalInr: number;
  grossSubtotalInr: number;
  discountAmountInr: number;
  walletCreditsInr: number;
  finalPriceBeforeWalletInr: number;
  netPayableInr: number;
  paidOrCollectedInr: number;
  pendingPayableInr: number;
  discountCode: string | null;
};

function resolveServiceLinePriceInr(serviceName: string): number | null {
  const matchedPackage = getGroomingPackageByServiceType(serviceName);

  if (!matchedPackage) {
    return null;
  }

  if (typeof matchedPackage.price === 'number' && Number.isFinite(matchedPackage.price)) {
    return Math.max(0, Math.round(matchedPackage.price));
  }

  if (typeof matchedPackage.price === 'string') {
    const match = matchedPackage.price.match(/(\d[\d,]*)/);
    if (!match?.[1]) {
      return null;
    }

    const parsed = Number.parseInt(match[1].replace(/,/g, ''), 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function reconcileServiceLineTotals(
  lines: Array<{ name: string; priceInr: number; isEstimated: boolean }>,
  targetTotalInr: number,
) {
  const target = Math.max(0, Math.round(targetTotalInr));
  const current = lines.reduce((sum, line) => sum + line.priceInr, 0);
  const delta = target - current;

  if (delta === 0 || lines.length === 0) {
    return;
  }

  if (delta > 0) {
    const lastIndex = lines.length - 1;
    lines[lastIndex].priceInr += delta;
    lines[lastIndex].isEstimated = true;
    return;
  }

  let remainingReduction = Math.abs(delta);

  for (let index = lines.length - 1; index >= 0 && remainingReduction > 0; index -= 1) {
    const reducible = Math.min(lines[index].priceInr, remainingReduction);
    if (reducible <= 0) {
      continue;
    }

    lines[index].priceInr -= reducible;
    lines[index].isEstimated = true;
    remainingReduction -= reducible;
  }
}

function buildServiceLineBreakdown(
  normalizedServices: string[],
  serviceSubtotalInr: number,
): Array<{ name: string; priceInr: number; isEstimated: boolean }> {
  const serviceLines = normalizedServices.map((name) => ({
    name,
    priceInr: resolveServiceLinePriceInr(name),
    isEstimated: false,
  }));

  const resolvedLines = serviceLines.map((line) => ({
    name: line.name,
    priceInr: line.priceInr ?? 0,
    isEstimated: line.priceInr == null,
  }));

  const unknownIndices = serviceLines
    .map((line, index) => (line.priceInr == null ? index : -1))
    .filter((index) => index >= 0);

  if (unknownIndices.length > 0) {
    const knownTotal = serviceLines.reduce((sum, line) => sum + (line.priceInr ?? 0), 0);
    const remainingForUnknown = Math.max(0, Math.round(serviceSubtotalInr - knownTotal));
    const evenShare = Math.floor(remainingForUnknown / unknownIndices.length);
    let remainder = remainingForUnknown - evenShare * unknownIndices.length;

    for (const index of unknownIndices) {
      const extra = remainder > 0 ? 1 : 0;
      resolvedLines[index].priceInr = evenShare + extra;
      resolvedLines[index].isEstimated = true;
      remainder -= extra;
    }
  }

  reconcileServiceLineTotals(resolvedLines, serviceSubtotalInr);
  return resolvedLines;
}

export function buildBookingPricingSummary(
  booking: Booking,
  bookedServices: string[],
  addonItems: BookingAddonItem[],
): BookingPricingSummary {
  const pendingPayableInr = Math.max(0, Number(booking.pending_payable_inr ?? 0));
  const serviceCandidates = [
    Number(booking.admin_price_reference ?? NaN),
    Number(booking.price_at_booking ?? NaN),
    Number(booking.amount ?? NaN),
    Number(booking.final_price ?? NaN),
  ].filter((value) => Number.isFinite(value) && value >= 0);

  const serviceSubtotalInr = serviceCandidates.find((value) => value > 0) ?? serviceCandidates[0] ?? 0;

  const addOnLines = addonItems
    .filter((item) => ACTIVE_BOOKING_ADDON_STATUSES.has(item.status))
    .map((item) => ({
      id: item.id,
      name: item.name_snapshot,
      quantity: Math.max(1, Number(item.quantity ?? 1)),
      unitPriceInr: resolveAddonUnitPrice(item),
      totalPriceInr: resolveAddonTotal(item),
    }));

  const addonSubtotalInr = addOnLines.reduce((sum, item) => sum + item.totalPriceInr, 0);
  const grossSubtotalInr = Math.max(0, serviceSubtotalInr + addonSubtotalInr);
  const discountAmountInr = Math.max(0, Number(booking.discount_amount ?? 0));
  const walletCreditsInr = Math.max(0, Number(booking.wallet_credits_applied_inr ?? 0));
  const fallbackFinalBeforeWalletInr = Math.max(0, grossSubtotalInr - discountAmountInr);
  const finalPriceBeforeWalletInr = Math.max(
    0,
    Number(booking.final_price ?? booking.amount ?? fallbackFinalBeforeWalletInr),
  );
  const netPayableInr = Math.max(0, finalPriceBeforeWalletInr - walletCreditsInr);
  const paidOrCollectedInr = Math.max(0, netPayableInr - pendingPayableInr);

  const normalizedServices =
    bookedServices.length > 0
      ? bookedServices
      : booking.service_type
        ? [booking.service_type]
        : [];

  const isBundledServices = normalizedServices.length > 1;
  const serviceLines = buildServiceLineBreakdown(normalizedServices, serviceSubtotalInr);
  const serviceLabel = isBundledServices
    ? `Bundled services (${normalizedServices.length})`
    : (normalizedServices[0] ?? 'Service');

  return {
    serviceLines,
    serviceLabel,
    isBundledServices,
    addOnLines,
    serviceSubtotalInr,
    addonSubtotalInr,
    grossSubtotalInr,
    discountAmountInr,
    walletCreditsInr,
    finalPriceBeforeWalletInr,
    netPayableInr,
    paidOrCollectedInr,
    pendingPayableInr,
    discountCode: booking.discount_code?.trim() || null,
  };
}

export function extractBookedServices(booking: Booking) {
  return resolveIncludedServicesForBooking(booking);
}

export default function BookingDetailsModal({
  activeBooking,
  isCancellingBookingId,
  onClose,
  onCancelRequest,
  onPaymentSuccess,
  onBookingUpdated,
}: Props) {
  const [review, setReview] = useState<BookingReview | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [isSubmittingReview, startReviewTransition] = useTransition();
  const [isPayingPendingAmount, setIsPayingPendingAmount] = useState(false);
  const [addonItems, setAddonItems] = useState<BookingAddonItem[]>([]);
  const [isAddonManagerOpen, setIsAddonManagerOpen] = useState(false);

  const isCompletedBooking = useMemo(() => {
    if (!activeBooking) return false;
    return resolveBookingStatus(activeBooking) === 'completed';
  }, [activeBooking]);

  const bookedServices = useMemo(() => {
    if (!activeBooking) {
      return [] as string[];
    }

    return extractBookedServices(activeBooking);
  }, [activeBooking]);

  const pricingSummary = useMemo(() => {
    if (!activeBooking) {
      return null;
    }

    return buildBookingPricingSummary(activeBooking, bookedServices, addonItems);
  }, [activeBooking, addonItems, bookedServices]);

  const bookingServiceLabel = useMemo(() => {
    if (!activeBooking) {
      return 'Service';
    }

    return buildIncludedServicesLabel(bookedServices, activeBooking.service_type);
  }, [activeBooking, bookedServices]);

  const providerName = useMemo(() => {
    if (!activeBooking) {
      return null;
    }

    const resolved = resolveProviderName(activeBooking.providers);
    if (!resolved) {
      return null;
    }

    const trimmed = resolved.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [activeBooking]);

  const pendingPayableInr = Math.max(0, Number(activeBooking?.pending_payable_inr ?? 0));

  useEffect(() => {
    setIsAddonManagerOpen(false);

    if (!activeBooking) {
      setAddonItems([]);
    }
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

  async function ensureRazorpayCheckoutLoaded() {
    if (typeof window === 'undefined') {
      throw new Error('Browser is unavailable.');
    }

    if ('Razorpay' in window) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Unable to load Razorpay checkout.'));
      document.body.appendChild(script);
    });
  }

  async function payPendingAmountOnline() {
    if (!activeBooking || isPayingPendingAmount) {
      return;
    }

    const pendingPayableInr = Math.max(0, Number(activeBooking.pending_payable_inr ?? 0));
    if (pendingPayableInr <= 0) {
      return;
    }

    setReviewError(null);
    setIsPayingPendingAmount(true);

    try {
      await ensureRazorpayCheckoutLoaded();

      const orderResponse = await fetch(`/api/payments/bookings/${activeBooking.id}/due-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const orderPayload = await orderResponse.json().catch(() => null) as {
        error?: string;
        razorpay?: {
          keyId: string;
          amount: number;
          currency: string;
          orderId: string;
          name: string;
          description: string;
          prefill?: { email?: string };
          notes?: Record<string, string>;
        };
      } | null;

      if (!orderResponse.ok || !orderPayload?.razorpay) {
        throw new Error(orderPayload?.error ?? 'Unable to start online payment.');
      }

      const checkout = new (window as unknown as Window & {
        Razorpay: new (options: Record<string, unknown>) => {
          open: () => void;
          on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void;
        };
      }).Razorpay({
        key: orderPayload.razorpay.keyId,
        amount: orderPayload.razorpay.amount,
        currency: orderPayload.razorpay.currency,
        name: orderPayload.razorpay.name,
        description: orderPayload.razorpay.description,
        order_id: orderPayload.razorpay.orderId,
        prefill: orderPayload.razorpay.prefill,
        notes: orderPayload.razorpay.notes,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyResponse = await fetch(`/api/payments/bookings/${activeBooking.id}/due-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              providerOrderId: response.razorpay_order_id,
              providerPaymentId: response.razorpay_payment_id,
              providerSignature: response.razorpay_signature,
            }),
          });

          const verifyPayload = await verifyResponse.json().catch(() => null) as { error?: string } | null;

          if (!verifyResponse.ok) {
            throw new Error(verifyPayload?.error ?? 'Unable to verify payment.');
          }

          onPaymentSuccess?.();
        },
      });

      checkout.on('payment.failed', (response) => {
        setReviewError(response?.error?.description ?? 'Online payment failed. Please try again.');
      });

      checkout.open();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Unable to process online payment.');
    } finally {
      setIsPayingPendingAmount(false);
    }
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
                <h3 className="mt-1 text-lg font-bold text-neutral-950">{bookingServiceLabel}</h3>
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
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Pending Payable</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {formatBookingAmount(Math.max(0, Number(activeBooking.pending_payable_inr ?? 0)))}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Provider Reference</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {providerName
                  ? (activeBooking.provider_id ? `${providerName} (Provider ${activeBooking.provider_id})` : providerName)
                  : activeBooking.provider_id
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

          {pricingSummary ? (
            <div className="rounded-xl border border-[#ead3bf] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Pricing Summary</p>

              {pricingSummary.serviceLines.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Services</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-700">{pricingSummary.serviceLabel}</span>
                    <span className="font-medium text-neutral-900">{formatBookingAmount(pricingSummary.serviceSubtotalInr)}</span>
                  </div>
                  {pricingSummary.isBundledServices ? (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Included packages</p>
                      <ul className="mt-1 space-y-1">
                        {pricingSummary.serviceLines.map((serviceLine, index) => (
                          <li key={`${serviceLine.name}-${index}`} className="flex items-center justify-between gap-3 text-sm text-neutral-700">
                            <span>{serviceLine.name}</span>
                            <span className="font-medium text-neutral-900">{formatBookingAmount(serviceLine.priceInr)}</span>
                          </li>
                        ))}
                      </ul>
                      {pricingSummary.serviceLines.some((serviceLine) => serviceLine.isEstimated) ? (
                        <p className="mt-1 text-[11px] text-neutral-500">
                          Some package prices are proportionally allocated to match the booking subtotal.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {pricingSummary.addOnLines.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Add-ons</p>
                  {pricingSummary.addOnLines.map((addOn) => (
                    <div key={addOn.id} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-700">
                        {addOn.name} x{addOn.quantity} ({formatBookingAmount(addOn.unitPriceInr)} each)
                      </span>
                      <span className="font-medium text-neutral-900">{formatBookingAmount(addOn.totalPriceInr)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 space-y-2 border-t border-neutral-200 pt-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Service Subtotal</span>
                  <span className="font-medium text-neutral-900">{formatBookingAmount(pricingSummary.serviceSubtotalInr)}</span>
                </div>
                {pricingSummary.addonSubtotalInr > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Add-on Subtotal</span>
                    <span className="font-medium text-neutral-900">{formatBookingAmount(pricingSummary.addonSubtotalInr)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Gross Subtotal</span>
                  <span className="font-medium text-neutral-900">{formatBookingAmount(pricingSummary.grossSubtotalInr)}</span>
                </div>
                {pricingSummary.discountAmountInr > 0 ? (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>
                      Discount Applied
                      {pricingSummary.discountCode ? ` (${pricingSummary.discountCode})` : ''}
                    </span>
                    <span className="font-semibold">- {formatBookingAmount(pricingSummary.discountAmountInr)}</span>
                  </div>
                ) : null}
                {pricingSummary.walletCreditsInr > 0 ? (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>Wallet Credits Applied</span>
                    <span className="font-semibold">- {formatBookingAmount(pricingSummary.walletCreditsInr)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                  <span className="font-semibold text-neutral-800">Final Price</span>
                  <span className="font-bold text-neutral-900">{formatBookingAmount(pricingSummary.netPayableInr)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Paid / Collected</span>
                  <span className="font-medium text-neutral-900">{formatBookingAmount(pricingSummary.paidOrCollectedInr)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Pending Payable</span>
                  <span className="font-semibold text-neutral-900">{formatBookingAmount(pricingSummary.pendingPayableInr)}</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-1 border-t border-neutral-200 pt-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {pendingPayableInr > 0 ? (
                <Button type="button" variant="premium" isLoading={isPayingPendingAmount} onClick={payPendingAmountOnline}>
                  Pay Pending Amount Online
                </Button>
              ) : null}
              <Button
                type="button"
                variant="premium"
                onClick={() => {
                  setIsAddonManagerOpen((isOpen) => !isOpen);
                }}
              >
                {isAddonManagerOpen ? 'Hide Add-on Options' : 'Manage Add-ons'}
              </Button>
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
            {pendingPayableInr > 0 ? (
              <p className="text-right text-[11px] text-neutral-500">Or pay cash to your provider during the visit.</p>
            ) : null}

            <div className={isAddonManagerOpen ? 'pt-2' : 'hidden'}>
              <BookingAddonManager
                bookingId={activeBooking.id}
                source="pre_service"
                title="Add-ons"
                interactionMode="add-only"
                addButtonLabel="Add Another Add-on"
                onItemsChange={setAddonItems}
                onUpdated={() => {
                  onBookingUpdated?.();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
