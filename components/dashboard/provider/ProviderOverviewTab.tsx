'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Badge, Button } from '@/components/ui';
import StatCard from '@/components/dashboard/premium/StatCard';
import StatusBadge from '@/components/dashboard/premium/StatusBadge';
import { formatProviderBookingDateTime } from './providerFormatters';
import type { PerformanceSummary, ProviderBooking } from './providerTypes';
import BookingIdentityRow from './BookingIdentityRow';
import BookingDetailsBlock from './BookingDetailsBlock';
import {
  BOOKING_CARD_SURFACE_CLASS,
} from './bookingCardTokens';

type Props = {
  performanceSummary: PerformanceSummary | null;
  providerBookings: ProviderBooking[];
  onBookingStatusChange: (
    bookingId: number,
    status: 'confirmed' | 'completed' | 'no_show' | 'cancelled',
  ) => void;
  onOpenCompletionEditor: (bookingId: number) => void;
  isPending: boolean;
};

function bookingStartDateTime(booking: ProviderBooking) {
  const parsed = new Date(`${booking.booking_date}T${booking.start_time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function ProviderOverviewTab({
  performanceSummary,
  providerBookings,
  onBookingStatusChange,
  onOpenCompletionEditor,
  isPending,
}: Props) {
  const router = useRouter();
  const now = new Date();
  const upcomingBooking = providerBookings
    .filter((booking) => booking.booking_status === 'pending' || booking.booking_status === 'confirmed')
    .map((booking) => ({ booking, startsAt: bookingStartDateTime(booking) }))
    .filter(
      (entry): entry is { booking: ProviderBooking; startsAt: Date } =>
        entry.startsAt !== null && entry.startsAt.getTime() >= now.getTime(),
    )
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())[0]?.booking;
  const upcomingBookingDateTimeLabel = upcomingBooking
    ? formatProviderBookingDateTime(upcomingBooking)
    : null;

  return (
    <>
      <section>
        <Card>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                  Upcoming Booking
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  Your next booking based on schedule time
                </p>
              </div>
              {upcomingBooking ? <StatusBadge status={upcomingBooking.booking_status} /> : null}
            </div>

            {upcomingBooking ? (
              <>
                <div className={`${BOOKING_CARD_SURFACE_CLASS} p-3.5 sm:p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <BookingIdentityRow
                      bookingId={upcomingBooking.id}
                      dateTimeLabel={upcomingBookingDateTimeLabel?.full ?? ''}
                      mobileDateTimeLabel={upcomingBookingDateTimeLabel?.compact ?? ''}
                      petName={upcomingBooking.pet_name}
                      ownerName={upcomingBooking.owner_full_name}
                      petPhotoUrl={upcomingBooking.pet_photo_url}
                      ownerPhotoUrl={upcomingBooking.owner_photo_url}
                      petImageSizes="44px"
                      ownerImageSizes="40px"
                    />
                  </div>

                  <BookingDetailsBlock
                    serviceType={upcomingBooking.service_type}
                    bookingMode={upcomingBooking.booking_mode}
                    customerName={upcomingBooking.owner_full_name}
                    petName={upcomingBooking.pet_name}
                    ownerPhone={upcomingBooking.owner_phone}
                    locationAddress={upcomingBooking.location_address}
                    latitude={upcomingBooking.latitude}
                    longitude={upcomingBooking.longitude}
                    showAcceptedPill={upcomingBooking.booking_status === 'confirmed'}
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-0.5 [&>button]:w-full sm:[&>button]:w-auto">
                  {upcomingBooking.booking_status === 'pending' ? (
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => onBookingStatusChange(upcomingBooking.id, 'confirmed')}
                    >
                      Accept
                    </Button>
                  ) : null}

                  {upcomingBooking.booking_status === 'confirmed' ? (
                    <>
                      {upcomingBooking.requires_completion_feedback ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isPending}
                          onClick={() => onOpenCompletionEditor(upcomingBooking.id)}
                        >
                          Complete With Feedback
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="success"
                          disabled={isPending}
                          onClick={() => onBookingStatusChange(upcomingBooking.id, 'completed')}
                        >
                          Complete
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => onBookingStatusChange(upcomingBooking.id, 'no_show')}
                      >
                        No-show
                      </Button>
                    </>
                  ) : null}

                  <Button
                    size="sm"
                    variant="danger"
                    disabled={isPending}
                    onClick={() => onBookingStatusChange(upcomingBooking.id, 'cancelled')}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => router.push('/dashboard/provider?view=operations')}
                  >
                    Open Queue
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/70 p-4 text-sm text-neutral-600">
                No upcoming pending or accepted bookings found.
              </div>
            )}
          </div>
        </Card>
      </section>

      <section>
        <Link
          href="/dashboard/provider/today"
          className="flex items-center justify-between rounded-2xl border border-[#e7c4a7] bg-[linear-gradient(135deg,#fff8f0,#fdf3e8)] px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <p className="font-semibold text-neutral-950">Today&apos;s Schedule</p>
              <p className="text-xs text-neutral-500">View and manage today&apos;s bookings</p>
            </div>
          </div>
          <span className="text-sm font-semibold text-coral">Open →</span>
        </Link>
      </section>

      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Performance Overview</h2>
          <p className="text-muted">Track your provider metrics and account health</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Average Rating"
            value={`${performanceSummary?.avgRating ?? 0}/5`}
            icon="star"
          />
          <StatCard
            label="Total Bookings"
            value={performanceSummary?.totalBookings ?? 0}
            icon="calendar"
          />
          <StatCard
            label="Cancellation Rate"
            value={`${performanceSummary?.cancellationRate ?? 0}%`}
            icon="x-circle"
          />
          <StatCard
            label="No-Show Count"
            value={performanceSummary?.noShowCount ?? 0}
            icon="alert-circle"
          />
          <StatCard
            label="Performance Score"
            value={`${performanceSummary?.performanceScore ?? 0}%`}
            icon="trending-up"
          />
          <StatCard
            label="Ranking Score"
            value={`${performanceSummary?.rankingScore ?? 0}`}
            icon="award"
          />
        </div>

        <Card>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium text-neutral-700">Account Status:</span>
              <Badge
                variant={
                  performanceSummary?.accountStatus === 'active'
                    ? 'success'
                    : performanceSummary?.accountStatus === 'suspended'
                      ? 'error'
                      : 'warning'
                }
              >
                {performanceSummary?.accountStatus ?? 'unknown'}
              </Badge>
            </div>
          </div>
        </Card>
      </section>
    </>
  );
}
