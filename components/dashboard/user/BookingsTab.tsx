'use client';

import SubscriptionCheckoutPanel from '@/components/payments/SubscriptionCheckoutPanel';
import Card from '@/components/ui/Card';
import BookingCard from '../premium/BookingCard';
import EmptyState from '../premium/EmptyState';
import type { Booking, Pet } from './types';
import { resolveBookingStatus, resolveProviderName } from './bookingUtils';

type Props = {
  filteredBookings: Booking[];
  pets: Pet[];
  bookingFilter: 'all' | 'active' | 'history';
  bookingCounts: { active: number; total: number };
  bookingSummaryText: string;
  isCancellingBookingId: number | null;
  highlightedBookingId?: number | null;
  onFilterChange: (filter: 'all' | 'active' | 'history') => void;
  onCancelRequest: (bookingId: number) => void;
  onViewDetails: (bookingId: number) => void;
};

export default function BookingsTab({
  filteredBookings,
  pets,
  bookingFilter,
  bookingCounts,
  bookingSummaryText,
  isCancellingBookingId,
  highlightedBookingId,
  onFilterChange,
  onCancelRequest,
  onViewDetails,
}: Props) {
  return (
    <>
      <h2 className="mb-3 text-2xl font-semibold text-neutral-950 sm:mb-6 sm:text-page-title">Manage Bookings</h2>
      <SubscriptionCheckoutPanel />

      {/* Filter */}
      <Card className="border-[#ead3bf] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_100%)] p-3 shadow-[0_10px_22px_rgba(147,101,63,0.1)] sm:p-6 sm:shadow-[0_16px_30px_rgba(147,101,63,0.12)]">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-neutral-900 sm:text-sm">
              {bookingFilter === 'all' ? (
                <>
                  <span className="text-emerald-600">{bookingCounts.active}</span> active &bull;{' '}
                  <span className="text-neutral-600">{bookingCounts.total}</span> total
                </>
              ) : (
                <span className="text-neutral-700">{bookingSummaryText}</span>
              )}
            </p>
          </div>
          <select
            value={bookingFilter}
            onChange={(event) => onFilterChange(event.target.value as 'all' | 'active' | 'history')}
            className="input-field min-h-10 w-full py-2 text-sm sm:w-auto sm:py-3"
          >
            <option value="all">All Bookings</option>
            <option value="active">Active Only</option>
            <option value="history">History</option>
          </select>
        </div>
      </Card>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          icon="📅"
          title={bookingFilter === 'active' ? 'No Active Bookings' : 'No Bookings'}
          description={
            bookingFilter === 'active'
              ? 'You are all caught up. Create a new booking when you are ready.'
              : 'Start by booking a service for your pet.'
          }
          ctaLabel={bookingFilter === 'active' ? undefined : 'Book a Service'}
          ctaHref={bookingFilter === 'active' ? undefined : '/forms/customer-booking'}
        />
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              id={booking.id}
              bookingDate={booking.booking_date ?? undefined}
              startTime={booking.start_time ?? undefined}
              endTime={booking.end_time ?? undefined}
              bookingStart={booking.booking_start}
              serviceName={booking.service_type ?? 'Service'}
              petName={booking.pet_id ? pets.find((p) => p.id === booking.pet_id)?.name : undefined}
              providerName={resolveProviderName(booking.providers)}
              bookingMode={booking.booking_mode ?? undefined}
              status={resolveBookingStatus(booking)}
              viewerRole="user"
              onCancel={onCancelRequest}
              onViewDetails={onViewDetails}
              isCancelling={isCancellingBookingId === booking.id}
              isHighlighted={highlightedBookingId === booking.id}
            />
          ))}
        </div>
      )}
    </>
  );
}
