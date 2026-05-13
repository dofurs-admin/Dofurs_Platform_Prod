'use client';

import { useState } from 'react';
import { Card, Alert, Badge, Button } from '@/components/ui';
import StatusBadge from '@/components/dashboard/premium/StatusBadge';
import { bookingTimelineLabel } from '@/lib/bookings/timeline';
import type { ProviderDashboard } from '@/lib/provider-management/types';
import {
  formatProviderBookingDateTime,
  formatProviderDate,
  formatProviderTime,
  formatProviderAmount,
  formatProviderDateTime,
} from './providerFormatters';
import {
  BOOKING_CARD_SURFACE_CLASS,
} from './bookingCardTokens';
import BookingIdentityRow from './BookingIdentityRow';
import BookingDetailsBlock from './BookingDetailsBlock';
import { WEEK_DAYS } from './providerTypes';
import type {
  ProviderBooking,
  ProviderBlockedDate,
  ReviewsPageResponse,
  ResponseHistoryEntry,
} from './providerTypes';
import SendMessageModal from '@/components/dashboard/SendMessageModal';
import { ACTIVE_BOOKING_ADDON_STATUSES } from '@/lib/bookings/addon-items';
import { resolveIncludedServicesForBooking } from '@/lib/bookings/included-services';
import { buildIncludedServicesLabel } from '@/lib/bookings/included-services';

type Props = {
  dashboard: ProviderDashboard;
  providerBookings: ProviderBooking[];
  bookingFilter: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  onBookingFilterChange: (filter: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show') => void;
  onBookingStatusChange: (
    bookingId: number,
    status: 'confirmed' | 'completed' | 'no_show' | 'cancelled',
  ) => void;
  onManageAddons: (bookingId: number) => void;
  onMarkCashCollected: (bookingId: number, collectionMode?: 'cash' | 'upi' | 'other') => void;
  onOpenCompletionEditor: (bookingId: number) => void;
  onOpenCustomerFeedbackEditor: (bookingId: number) => void;
  blockedDates: ProviderBlockedDate[];
  onManageBlockedDates: () => void;
  onManageAvailability: () => void;
  reviewsPage: ReviewsPageResponse;
  reviewFilter: 'all' | '1' | '2' | '3' | '4' | '5';
  onReviewFilterChange: (filter: 'all' | '1' | '2' | '3' | '4' | '5') => void;
  reviewResponses: Record<string, string>;
  onReviewResponseChange: (reviewId: string, value: string) => void;
  onOpenReviewEditor: (reviewId: string) => void;
  onLoadResponseHistory: (reviewId: string) => void;
  onFetchReviews: (page: number, filter: 'all' | '1' | '2' | '3' | '4' | '5') => void;
  responseHistory: Record<string, ResponseHistoryEntry[]>;
  isPending: boolean;
};

export default function ProviderOperationsTab({
  dashboard,
  providerBookings,
  bookingFilter,
  onBookingFilterChange,
  onBookingStatusChange,
  onManageAddons,
  onMarkCashCollected,
  onOpenCompletionEditor,
  onOpenCustomerFeedbackEditor,
  blockedDates,
  onManageBlockedDates,
  onManageAvailability,
  reviewsPage,
  reviewFilter,
  onReviewFilterChange,
  reviewResponses,
  onReviewResponseChange,
  onOpenReviewEditor,
  onLoadResponseHistory,
  onFetchReviews,
  responseHistory,
  isPending,
}: Props) {
  const [messageTarget, setMessageTarget] = useState<{
    recipientId: string;
    recipientName: string;
    bookingId?: number;
  } | null>(null);
  const [expandedSummaryBookingIds, setExpandedSummaryBookingIds] = useState<number[]>([]);

  function toggleBookingSummary(bookingId: number) {
    setExpandedSummaryBookingIds((current) =>
      current.includes(bookingId)
        ? current.filter((id) => id !== bookingId)
        : [...current, bookingId],
    );
  }

  return (
    <>
      {/* Booking Command Center */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-section-title">Booking Command Center</h2>
          <select
            value={bookingFilter}
            onChange={(event) =>
              onBookingFilterChange(
                event.target.value as 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show',
              )
            }
            className="input-field h-[46px] w-full sm:w-auto"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>

        <Card>
          <div className="space-y-2">
            {providerBookings.length === 0 ? (
              <p className="text-body text-neutral-500 text-center py-6">No bookings in queue</p>
            ) : (
              <>
                {providerBookings.slice(0, 20).map((booking) => {
                  const isCashBooking = booking.payment_mode === 'direct_to_provider' || booking.payment_mode === 'mixed';
                  const cashPending = isCashBooking && !booking.cash_collected;
                  const cashReceived = isCashBooking && booking.cash_collected === true;
                  const receivedBadgeLabel = booking.payment_mode === 'mixed' ? 'Payable Settled' : 'Cash Received';
                  const pendingBadgeLabel = booking.payment_mode === 'mixed' ? 'Pending Payable' : 'Awaiting Cash';
                  const walletCreditsAppliedInr = Math.max(0, Number(booking.wallet_credits_applied_inr ?? 0));
                  const pendingPayableInr = Math.max(0, Number(booking.pending_payable_inr ?? 0));
                  const bookingDateTimeLabel = formatProviderBookingDateTime(booking);
                  const normalizedPetNames = (booking.pet_names ?? [])
                    .map((name) => name.trim())
                    .filter((name) => name.length > 0);
                  const petPrimaryName = normalizedPetNames[0] ?? booking.pet_name ?? null;
                  const petNameLabel = normalizedPetNames.length > 0
                    ? normalizedPetNames.join(', ')
                    : booking.pet_name ?? null;
                  const allAddonItems = booking.addon_items ?? [];
                  const addonItems = allAddonItems.filter((item) => ACTIVE_BOOKING_ADDON_STATUSES.has(item.status));
                  const addonSubtotalInr = addonItems.reduce(
                    (sum, item) => sum + Math.max(0, Number(item.total_price_inr ?? 0)),
                    0,
                  );
                  const referenceServiceSubtotalInr = Math.max(
                    0,
                    Number(booking.admin_price_reference ?? booking.price_at_booking ?? 0),
                  );
                  const discountInr = Math.max(0, Number(booking.discount_amount ?? 0));
                  const finalAmountFromBookingInr = Math.max(0, Number(booking.final_price ?? 0));
                  const fallbackFinalAmountInr = Math.max(
                    0,
                    referenceServiceSubtotalInr + addonSubtotalInr - discountInr - walletCreditsAppliedInr,
                  );
                  const finalAmountInr = finalAmountFromBookingInr > 0
                    ? finalAmountFromBookingInr
                    : fallbackFinalAmountInr;
                  const impliedGrossSubtotalInr = Math.max(0, finalAmountInr + discountInr + walletCreditsAppliedInr);
                  const hasReferenceServiceSubtotal = referenceServiceSubtotalInr > 0;
                  const serviceSubtotalInr = hasReferenceServiceSubtotal
                    ? referenceServiceSubtotalInr
                    : Math.max(0, impliedGrossSubtotalInr - addonSubtotalInr);
                  const reconciliationAdjustmentInr = hasReferenceServiceSubtotal
                    ? Math.round(impliedGrossSubtotalInr - (referenceServiceSubtotalInr + addonSubtotalInr))
                    : 0;
                  const grossSubtotalInr = Math.max(
                    0,
                    serviceSubtotalInr + addonSubtotalInr + reconciliationAdjustmentInr,
                  );
                  const collectibleAmountInr = pendingPayableInr > 0
                    ? pendingPayableInr
                    : Math.max(0, finalAmountInr - walletCreditsAppliedInr);
                  const includedServices =
                    booking.included_services && booking.included_services.length > 0
                      ? booking.included_services
                      : resolveIncludedServicesForBooking(booking);
                  const serviceLabel = buildIncludedServicesLabel(
                    includedServices,
                    booking.service_type,
                  );
                  const isSummaryExpanded = expandedSummaryBookingIds.includes(booking.id);

                  return (
                    <div
                      key={booking.id}
                      className={`mb-3 p-3.5 sm:p-4 last:mb-0 ${BOOKING_CARD_SURFACE_CLASS}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-3">
                          <BookingIdentityRow
                            bookingId={booking.id}
                            dateTimeLabel={bookingDateTimeLabel.full}
                            mobileDateTimeLabel={bookingDateTimeLabel.compact}
                            petName={petPrimaryName}
                            ownerName={booking.owner_full_name}
                            petPhotoUrl={booking.pet_photo_url}
                            ownerPhotoUrl={booking.owner_photo_url}
                            petImageSizes="40px"
                            ownerImageSizes="36px"
                          />

                          <BookingDetailsBlock
                            serviceType={serviceLabel}
                            bookingMode={booking.booking_mode}
                            customerName={booking.owner_full_name}
                            petName={petNameLabel}
                            ownerPhone={booking.owner_phone}
                            locationAddress={booking.location_address}
                            latitude={booking.latitude}
                            longitude={booking.longitude}
                          />
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {booking.booking_status === 'pending' && (
                            <Alert variant="warning" className="!p-2">
                              Action Needed
                            </Alert>
                          )}
                          <StatusBadge status={booking.booking_status} />
                          {/* Payment mode badge */}
                          {booking.payment_mode === 'platform' && (
                            <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Paid Online
                            </span>
                          )}
                          {booking.payment_mode === 'mixed' && (
                            <span className="inline-flex items-center rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                              Mixed Payment
                            </span>
                          )}
                          {cashReceived && (
                            <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              {receivedBadgeLabel}
                            </span>
                          )}
                          {cashPending && (
                            booking.booking_status === 'confirmed' || booking.booking_status === 'pending'
                          ) && (
                            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              {pendingBadgeLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-neutral-500">
                        {bookingTimelineLabel(booking.booking_status)}
                      </p>

                      {finalAmountInr > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-700">
                            Pending Payable: {formatProviderAmount(collectibleAmountInr)}
                          </span>
                          {walletCreditsAppliedInr > 0 && (
                            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                              Credits Applied: {formatProviderAmount(walletCreditsAppliedInr)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2 pt-0.5 [&>button]:w-full sm:[&>button]:w-auto">
                        {booking.booking_status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => onBookingStatusChange(booking.id, 'confirmed')}
                          >
                            Confirm
                          </Button>
                        )}
                        {booking.booking_status === 'confirmed' && (
                          <>
                            {/* Cash collection button — only for direct_to_provider before cash is received */}
                            {cashPending && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => onMarkCashCollected(booking.id, 'cash')}
                              >
                                {booking.payment_mode === 'mixed' ? 'Collect Pending Payable' : 'Mark Cash Received'}
                              </Button>
                            )}

                            {/* Complete button — gated behind cash collection for cash bookings */}
                            {booking.requires_completion_feedback ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={cashPending}
                                title={cashPending ? 'Mark cash as received first' : undefined}
                                onClick={() => !cashPending && onOpenCompletionEditor(booking.id)}
                              >
                                Complete With Feedback
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="success"
                                disabled={cashPending}
                                title={cashPending ? 'Mark cash as received first' : undefined}
                                onClick={() => !cashPending && onBookingStatusChange(booking.id, 'completed')}
                              >
                                Complete
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onBookingStatusChange(booking.id, 'no_show')}
                            >
                              No-show
                            </Button>
                          </>
                        )}
                        {(booking.booking_status === 'pending' || booking.booking_status === 'confirmed') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onManageAddons(booking.id)}
                          >
                            Manage Add-ons
                          </Button>
                        )}
                        {(booking.booking_status === 'pending' ||
                          booking.booking_status === 'confirmed') && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => onBookingStatusChange(booking.id, 'cancelled')}
                          >
                            Cancel
                          </Button>
                        )}
                        {booking.booking_status === 'completed' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onOpenCustomerFeedbackEditor(booking.id)}
                          >
                            {booking.provider_customer_rating
                              ? `Edit Customer Rating (${booking.provider_customer_rating}★)`
                              : 'Rate Customer'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-expanded={isSummaryExpanded}
                          aria-controls={`provider-booking-summary-${booking.id}`}
                          onClick={() => toggleBookingSummary(booking.id)}
                        >
                          {isSummaryExpanded ? 'Hide Summary' : 'View Summary'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setMessageTarget({
                            recipientId: booking.user_id,
                            recipientName: booking.owner_full_name || 'Pet Parent',
                            bookingId: booking.id,
                          })}
                        >
                          Message
                        </Button>
                      </div>

                      {isSummaryExpanded ? (
                        <div
                          id={`provider-booking-summary-${booking.id}`}
                          className="mt-3 space-y-3 rounded-lg border border-[#ecd8c7] bg-[#fffaf4] px-3 py-3"
                        >
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a6549]">
                              Price Breakup
                            </p>
                            <div className="mt-1 space-y-1 text-[11px] text-[#6f4b32] sm:text-xs">
                              {serviceSubtotalInr > 0 ? (
                                <div className="flex items-center justify-between">
                                  <span>Service Subtotal</span>
                                  <span>{formatProviderAmount(serviceSubtotalInr)}</span>
                                </div>
                              ) : null}
                              {addonSubtotalInr > 0 ? (
                                <div className="flex items-center justify-between">
                                  <span>Add-on Subtotal</span>
                                  <span>{formatProviderAmount(addonSubtotalInr)}</span>
                                </div>
                              ) : null}
                              {reconciliationAdjustmentInr !== 0 ? (
                                <div className="flex items-center justify-between">
                                  <span>Price Adjustment</span>
                                  <span>
                                    {reconciliationAdjustmentInr > 0 ? '+ ' : '- '}
                                    {formatProviderAmount(Math.abs(reconciliationAdjustmentInr))}
                                  </span>
                                </div>
                              ) : null}
                              {grossSubtotalInr > 0 ? (
                                <div className="flex items-center justify-between">
                                  <span>Gross Subtotal</span>
                                  <span>{formatProviderAmount(grossSubtotalInr)}</span>
                                </div>
                              ) : null}
                              {discountInr > 0 ? (
                                <div className="flex items-center justify-between">
                                  <span>Discount Applied</span>
                                  <span>- {formatProviderAmount(discountInr)}</span>
                                </div>
                              ) : null}
                              {walletCreditsAppliedInr > 0 ? (
                                <div className="flex items-center justify-between">
                                  <span>Dofurs Credits Applied</span>
                                  <span>- {formatProviderAmount(walletCreditsAppliedInr)}</span>
                                </div>
                              ) : null}
                              <div className="flex items-center justify-between border-t border-[#e7c4a7]/70 pt-1 font-semibold text-[#5d3e2b]">
                                <span>Final Amount</span>
                                <span>{formatProviderAmount(finalAmountInr)}</span>
                              </div>
                              {collectibleAmountInr > 0 ? (
                                <div className="flex items-center justify-between font-semibold text-[#5d3e2b]">
                                  <span>Pending Payable</span>
                                  <span>{formatProviderAmount(collectibleAmountInr)}</span>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a6549]">
                                Included Services
                              </p>
                              {includedServices.length > 0 ? (
                                <ul className="mt-1 space-y-1">
                                  {includedServices.map((serviceName, index) => (
                                    <li
                                      key={`${booking.id}-service-${index}-${serviceName}`}
                                      className="text-[11px] text-[#6f4b32] sm:text-xs"
                                    >
                                      {serviceName}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-[11px] text-[#7c5b43] sm:text-xs">
                                  No bundled service lines found.
                                </p>
                              )}
                            </div>

                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a6549]">
                                Add-on Summary
                              </p>
                              {addonItems.length > 0 ? (
                                <ul className="mt-1 space-y-1">
                                  {addonItems.map((item, index) => {
                                    const totalPriceInr = Math.max(0, Number(item.total_price_inr ?? 0));
                                    const unitPriceInr =
                                      item.quantity > 0
                                        ? Math.max(0, Math.round(totalPriceInr / item.quantity))
                                        : null;

                                    return (
                                      <li
                                        key={`${item.id}-${index}`}
                                        className="text-[11px] text-[#6f4b32] sm:text-xs"
                                      >
                                        {item.name_snapshot} x{item.quantity}
                                        {unitPriceInr != null
                                          ? ` (${formatProviderAmount(unitPriceInr)} each)`
                                          : ''}{' '}
                                        • {formatProviderAmount(totalPriceInr)}
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="mt-1 text-[11px] text-[#7c5b43] sm:text-xs">
                                  No active add-ons selected.
                                </p>
                              )}
                              {allAddonItems.length > addonItems.length ? (
                                <p className="mt-1 text-[10px] text-[#8a6549] sm:text-[11px]">
                                  Only active add-ons are included in totals.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </Card>
      </section>

      {/* Blocked Dates */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-section-title">Blocked Dates &amp; Time</h2>
          <Button size="sm" variant="secondary" onClick={onManageBlockedDates}>
            Manage
          </Button>
        </div>
        <Card>
          <div className="space-y-4">
            {blockedDates.length === 0 ? (
              <p className="text-body text-neutral-500 text-center py-6">No blocked dates set</p>
            ) : (
              <div className="space-y-3">
                {blockedDates.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-neutral-200/60 bg-neutral-50/50"
                  >
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {formatProviderDate(item.blocked_date)}
                        {item.block_start_time && item.block_end_time ? (
                          <span className="font-normal text-neutral-600">
                            {' · '}
                            {formatProviderTime(item.block_start_time)} –{' '}
                            {formatProviderTime(item.block_end_time)}
                          </span>
                        ) : (
                          <span className="ml-2 text-xs font-normal text-neutral-400">All day</span>
                        )}
                      </p>
                      <p className="text-sm text-neutral-600 mt-1">
                        {item.reason ?? 'No reason provided'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* Availability */}
      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-section-title">Availability</h2>
            <p className="text-muted">Set and maintain your appointment slots.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onManageAvailability}>
            Manage Availability
          </Button>
        </div>

        <Card>
          {dashboard.availability.length === 0 ? (
            <p className="text-body text-neutral-500 text-center py-6">
              No availability slots configured
            </p>
          ) : (
            <div className="space-y-3">
              {dashboard.availability.map((slot) => (
                <div
                  key={slot.id}
                  className="border-b border-neutral-200/60 pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {WEEK_DAYS.find((day) => day.day === slot.day_of_week)?.label ?? 'Day'}
                      </p>
                      <p className="text-sm text-neutral-600">
                        {slot.start_time} - {slot.end_time}
                      </p>
                    </div>
                    <Badge variant={slot.is_available ? 'success' : 'warning'}>
                      {slot.is_available ? 'Available' : 'Unavailable'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Reviews & Feedback */}
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Reviews &amp; Feedback</h2>
          <p className="text-muted">Manage customer reviews and build your reputation</p>
        </div>

        <Card>
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
              <p className="text-sm font-medium text-neutral-700">Filter by Rating</p>
              <select
                value={reviewFilter}
                onChange={(event) =>
                  onReviewFilterChange(event.target.value as 'all' | '1' | '2' | '3' | '4' | '5')
                }
                className="input-field h-[46px] w-full"
              >
                <option value="all">All ratings</option>
                <option value="5">5 stars</option>
                <option value="4">4 stars</option>
                <option value="3">3 stars</option>
                <option value="2">2 stars</option>
                <option value="1">1 star</option>
              </select>
            </div>

            {reviewsPage.reviews.length === 0 ? (
              <p className="text-body text-neutral-500 text-center py-6">No reviews found</p>
            ) : (
              <div className="space-y-4">
                {reviewsPage.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border-b border-neutral-200/60 pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="space-y-1">
                        <Badge
                          variant={
                            review.rating >= 4 ? 'success' : review.rating >= 3 ? 'warning' : 'error'
                          }
                        >
                          {`${review.rating}/5 stars`}
                        </Badge>
                        <p className="text-sm text-neutral-600">
                          {formatProviderDate(review.created_at)}
                        </p>
                      </div>
                    </div>

                    <p className="text-body mb-3">{review.review_text ?? 'No written feedback'}</p>

                    <div className="space-y-3 p-3 bg-neutral-50/50 rounded-lg mb-3">
                      <p className="text-sm text-neutral-600">
                        <span className="font-medium">Current Response:</span>{' '}
                        {review.provider_response ?? 'No response yet'}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          if (reviewResponses[review.id] === undefined) {
                            onReviewResponseChange(review.id, review.provider_response ?? '');
                          }
                          onOpenReviewEditor(review.id);
                        }}
                      >
                        {review.provider_response ? 'Edit Response' : 'Respond'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onLoadResponseHistory(review.id)}
                      >
                        View History
                      </Button>
                    </div>

                    {(responseHistory[review.id] ?? []).length > 0 ? (
                      <div className="mt-3 space-y-2 text-xs text-neutral-500">
                        {responseHistory[review.id].map((entry) => (
                          <div key={entry.id} className="p-2 bg-neutral-50/50 rounded">
                            {formatProviderDateTime(entry.created_at)} • Previous: &quot;
                            {entry.previous_response ?? 'None'}&quot; → New: &quot;
                            {entry.new_response}&quot;
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-neutral-200/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending || reviewsPage.page <= 1}
                onClick={() => onFetchReviews(reviewsPage.page - 1, reviewFilter)}
              >
                ← Previous
              </Button>
              <span className="text-center text-sm text-neutral-600">
                Page {reviewsPage.page} of {Math.ceil(reviewsPage.total / reviewsPage.pageSize)} •{' '}
                {reviewsPage.total} total
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending || !reviewsPage.hasMore}
                onClick={() => onFetchReviews(reviewsPage.page + 1, reviewFilter)}
              >
                Next →
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* Pricing Catalog */}
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Pricing Catalog</h2>
          <p className="text-muted">Your service pricing (managed by administrators)</p>
        </div>

        <Card>
          {dashboard.services.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-body text-neutral-500">No pricing configured yet</p>
              <p className="text-muted text-sm mt-1">
                Administrators will set up your service pricing
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard.services.map((service) => (
                <div
                  key={service.id}
                  className="border-b border-neutral-200/60 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-neutral-900">{service.service_type}</p>
                      <div className="mt-2 grid gap-1 text-sm text-neutral-600 sm:flex sm:flex-wrap sm:gap-4">
                        <span>
                          Base:{' '}
                          <span className="font-medium text-neutral-900">
                            {formatProviderAmount(service.base_price)}
                          </span>
                        </span>
                        <span>
                          Surge:{' '}
                          <span className="font-medium text-neutral-900">
                            {typeof service.surge_price === 'number'
                              ? formatProviderAmount(service.surge_price)
                              : 'Not set'}
                          </span>
                        </span>
                        <span>
                          Commission:{' '}
                          <span className="font-medium text-neutral-900">
                            {service.commission_percentage ?? 'N/A'}%
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <SendMessageModal
        isOpen={messageTarget !== null}
        onClose={() => setMessageTarget(null)}
        recipientId={messageTarget?.recipientId ?? ''}
        recipientName={messageTarget?.recipientName ?? ''}
        bookingId={messageTarget?.bookingId}
        senderRole="provider"
      />
    </>
  );
}
