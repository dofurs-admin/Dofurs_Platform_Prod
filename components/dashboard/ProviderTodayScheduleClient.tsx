'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { normalizeDisplayImageUrl } from '@/components/dashboard/user/petUtils';
import {
  BOOKING_CARD_SURFACE_CLASS,
  BOOKING_CHIP_CLASS,
  BOOKING_PET_AVATAR_CLASS,
} from '@/components/dashboard/provider/bookingCardTokens';

export type TodayBooking = {
  id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  service_type: string | null;
  booking_mode: string;
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  price_at_booking: number;
  provider_notes: string | null;
  pet_name: string;
  pet_breed: string | null;
  pet_photo_url?: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_photo_url?: string | null;
};

type Props = {
  bookings: TodayBooking[];
  providerId?: number;
  date?: string;
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
  no_show: { label: 'No Show', className: 'bg-red-100 text-red-700 border-red-200' },
};

const MODE_LABELS: Record<string, string> = {
  home_visit: '🏡 Home Visit',
  clinic_visit: '🏥 Clinic',
  teleconsult: '📱 Teleconsult',
};

const SERVICE_LABELS: Record<string, string> = {
  grooming: 'Grooming',
  vet_consultation: 'Vet Consult',
  pet_sitting: 'Pet Sitting',
  training: 'Training',
};

function formatTime(timeStr: string) {
  const parsed = new Date(`1970-01-01T${timeStr}`);
  if (Number.isNaN(parsed.getTime())) return timeStr;
  return parsed.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ─── Feedback Modal ───────────────────────────────────────────────────────────
function CompletionFeedbackModal({
  onConfirm,
  onCancel,
  isLoading,
}: {
  onConfirm: (feedback: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [text, setText] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <h3 className="mb-1 text-base font-bold text-neutral-950">Complete Booking</h3>
        <p className="mb-4 text-sm text-neutral-600">
          Add a brief note about the session before marking it complete.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Full bath, nail trim done. Pet was calm and cooperative."
          className="h-28 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coral/30"
          maxLength={2000}
        />
        <p className="mb-4 text-right text-[10px] text-neutral-400">{text.length}/2000</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(text.trim())}
            disabled={isLoading || text.trim().length < 5}
            className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
          >
            {isLoading ? 'Saving…' : 'Mark Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── No-Show Confirm Modal ────────────────────────────────────────────────────
function NoShowModal({
  onConfirm,
  onCancel,
  isLoading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <h3 className="mb-1 text-base font-bold text-neutral-950">Mark as No Show?</h3>
        <p className="mb-6 text-sm text-neutral-600">
          This will mark the booking as no-show and notify the platform.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving…' : 'Confirm No Show'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Booking Card with Swipe ─────────────────────────────────────────────────
const SWIPE_THRESHOLD = 72;
const SWIPE_MAX = 110;

function BookingCard({
  booking,
  onStatusChange,
}: {
  booking: TodayBooking;
  onStatusChange: (
    id: number,
    action: 'confirm' | 'complete' | 'no_show',
    feedback?: string,
  ) => Promise<void>;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const touchStartX = useRef(0);

  const isActionable =
    booking.booking_status === 'pending' || booking.booking_status === 'confirmed';

  const primaryAction = booking.booking_status === 'pending' ? 'confirm' : 'complete';
  const primaryLabel = booking.booking_status === 'pending' ? '✓ Confirm' : '✓ Complete';

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isActionable) return;
    touchStartX.current = e.touches[0].clientX;
    setDragging(true);
  }, [isActionable]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const diff = e.touches[0].clientX - touchStartX.current;
    setOffsetX(Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, diff)));
  }, [dragging]);

  const handleTouchEnd = useCallback(async () => {
    setDragging(false);
    const snap = offsetX;
    setOffsetX(0);

    if (snap > SWIPE_THRESHOLD) {
      if (primaryAction === 'confirm') {
        setActionLoading('confirm');
        await onStatusChange(booking.id, 'confirm').finally(() => setActionLoading(null));
      } else {
        setShowCompleteModal(true);
      }
    } else if (snap < -SWIPE_THRESHOLD) {
      setShowNoShowModal(true);
    }
  }, [offsetX, primaryAction, booking.id, onStatusChange]);

  const handleComplete = useCallback(
    async (feedback: string) => {
      setActionLoading('complete');
      await onStatusChange(booking.id, 'complete', feedback).finally(() => {
        setActionLoading(null);
        setShowCompleteModal(false);
      });
    },
    [booking.id, onStatusChange],
  );

  const handleNoShow = useCallback(async () => {
    setActionLoading('no_show');
    await onStatusChange(booking.id, 'no_show').finally(() => {
      setActionLoading(null);
      setShowNoShowModal(false);
    });
  }, [booking.id, onStatusChange]);

  const statusCfg = STATUS_CONFIG[booking.booking_status];
  const swipeRatio = Math.abs(offsetX) / SWIPE_MAX;
  const isSwipingRight = offsetX > 0;
  const isSwipingLeft = offsetX < 0;
  const petPhotoUrl = normalizeDisplayImageUrl(booking.pet_photo_url);
  const ownerPhotoUrl = normalizeDisplayImageUrl(booking.owner_photo_url);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl">
        {/* Swipe hint — right side (green action) */}
        {isActionable && (
          <div
            className="absolute inset-y-0 left-0 flex items-center bg-green-500 px-5 transition-opacity"
            style={{ opacity: isSwipingRight ? swipeRatio : 0 }}
          >
            <span className="text-sm font-bold text-white">{primaryLabel}</span>
          </div>
        )}

        {/* Swipe hint — left side (red action) */}
        {isActionable && (
          <div
            className="absolute inset-y-0 right-0 flex items-center bg-red-500 px-5 transition-opacity"
            style={{ opacity: isSwipingLeft ? swipeRatio : 0 }}
          >
            <span className="text-sm font-bold text-white">No Show ✗</span>
          </div>
        )}

        {/* Card */}
        <div
          style={{
            transform: `translateX(${offsetX}px)`,
            transition: dragging ? 'none' : 'transform 0.25s ease',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative z-10 p-3.5 sm:p-4 shadow-sm ${BOOKING_CARD_SURFACE_CLASS}`}
        >
          {/* Top row: time + status */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-base font-bold text-neutral-950">
                {formatTime(booking.start_time)}
                <span className="mx-1 font-normal text-neutral-400">–</span>
                {formatTime(booking.end_time)}
              </p>
              <p className="text-xs text-neutral-500">
                {MODE_LABELS[booking.booking_mode] ?? booking.booking_mode}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusCfg.className}`}
            >
              {statusCfg.label}
            </span>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <span className={BOOKING_CHIP_CLASS}>
              {booking.service_type
                ? (SERVICE_LABELS[booking.service_type] ?? booking.service_type)
                : 'Service'}
            </span>
            <span className={BOOKING_CHIP_CLASS}>
              {MODE_LABELS[booking.booking_mode] ?? booking.booking_mode}
            </span>
          </div>

          {/* Pet + owner */}
          <div className="mb-3 flex items-center gap-3">
            <div className={`${BOOKING_PET_AVATAR_CLASS} bg-[#fdf0e4]`}>
              {petPhotoUrl ? (
                <Image
                  src={petPhotoUrl}
                  alt={`${booking.pet_name} photo`}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <span className="grid h-full w-full place-items-center text-lg">🐾</span>
              )}
              <div className="absolute -bottom-1 -right-1 h-5 w-5 overflow-hidden rounded-full border border-white bg-neutral-100 shadow-sm sm:h-6 sm:w-6">
                {ownerPhotoUrl ? (
                  <Image
                    src={ownerPhotoUrl}
                    alt={`${booking.owner_name ?? 'Owner'} photo`}
                    fill
                    sizes="20px"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-[10px]">👤</span>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-950">{booking.pet_name}</p>
              {booking.pet_breed && (
                <p className="truncate text-xs text-neutral-500">{booking.pet_breed}</p>
              )}
              {booking.owner_name && (
                <p className="text-xs text-neutral-700">Customer: {booking.owner_name}</p>
              )}
              {booking.owner_phone && (
                <p className="text-xs text-neutral-700">Phone: {booking.owner_phone}</p>
              )}
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-xs ring-1 ring-[#eed8c4]">
            <span className="font-medium text-neutral-700">Booking Amount</span>
            <span className="text-sm font-bold text-[#b25f27]">₹{booking.price_at_booking}</span>
          </div>

          {/* Address + Directions */}
          {booking.location_address && (
            <div className="mb-3 rounded-lg bg-white/80 px-3 py-1.5 ring-1 ring-[#eed8c4]">
              <p className="text-xs leading-5 text-neutral-700">
                📍 {booking.location_address}
              </p>
              {booking.booking_mode === 'home_visit' && (
                <a
                  href={
                    booking.latitude != null && booking.longitude != null
                      ? `https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`
                      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(booking.location_address)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[#e7c4a7] bg-[#fff8f0] px-3 py-1 text-[11px] font-semibold text-[#b25f27] transition-colors hover:bg-[#fdf0e4]"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-3 w-3 shrink-0"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.083 3.602-5.017 3.602-8.532 0-4.636-3.664-8.101-8-8.101S4 4.715 4 9.335c0 3.515 1.658 6.449 3.602 8.532a19.58 19.58 0 002.683 2.282 16.975 16.975 0 001.144.742l.07.04.028.016zM12 13.085a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Get Directions
                </a>
              )}
            </div>
          )}

          {/* Action buttons */}
          {isActionable && (
            <div className="flex flex-col gap-2 pt-1.5 sm:flex-row">
              {booking.booking_status === 'pending' && (
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={async () => {
                    setActionLoading('confirm');
                    await onStatusChange(booking.id, 'confirm').finally(() =>
                      setActionLoading(null),
                    );
                  }}
                  className="w-full rounded-xl bg-[#3a9c65] py-2 text-sm font-semibold text-white hover:bg-[#2e8054] disabled:opacity-50 sm:flex-1"
                >
                  {actionLoading === 'confirm' ? 'Confirming…' : '✓ Confirm'}
                </button>
              )}
              {booking.booking_status === 'confirmed' && (
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={() => setShowCompleteModal(true)}
                  className="w-full rounded-xl bg-[#3a9c65] py-2 text-sm font-semibold text-white hover:bg-[#2e8054] disabled:opacity-50 sm:flex-1"
                >
                  {actionLoading === 'complete' ? 'Saving…' : '✓ Mark Complete'}
                </button>
              )}
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={() => setShowNoShowModal(true)}
                className="w-full rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 sm:w-auto"
              >
                {actionLoading === 'no_show' ? '…' : 'No Show'}
              </button>
            </div>
          )}

          {/* Swipe hint (mobile) */}
          {isActionable && (
            <p className="mt-3 text-center text-[10px] text-neutral-400 sm:hidden">
              ← Swipe to act →
            </p>
          )}
        </div>
      </div>

      {showCompleteModal && (
        <CompletionFeedbackModal
          onConfirm={handleComplete}
          onCancel={() => setShowCompleteModal(false)}
          isLoading={actionLoading === 'complete'}
        />
      )}
      {showNoShowModal && (
        <NoShowModal
          onConfirm={handleNoShow}
          onCancel={() => setShowNoShowModal(false)}
          isLoading={actionLoading === 'no_show'}
        />
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProviderTodayScheduleClient({ bookings }: Props) {
  const router = useRouter();
  const [localBookings, setLocalBookings] = useState<TodayBooking[]>(bookings);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleStatusChange = useCallback(
    async (id: number, action: 'confirm' | 'complete' | 'no_show', feedback?: string) => {
      setGlobalError(null);

      const statusMap = { confirm: 'confirmed', complete: 'completed', no_show: 'no_show' } as const;
      const newStatus = statusMap[action];

      const body: Record<string, string> = { status: newStatus };
      if (action === 'complete' && feedback) {
        body.completionFeedback = feedback;
      }

      const res = await fetch(`/api/provider/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGlobalError((data as { error?: string }).error ?? 'Could not update booking. Try again.');
        return;
      }

      // Optimistic update
      setLocalBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, booking_status: newStatus } : b)),
      );

      // Refresh server data silently
      router.refresh();
    },
    [router],
  );

  const activeBookings = localBookings.filter(
    (b) => b.booking_status === 'pending' || b.booking_status === 'confirmed',
  );
  const doneBookings = localBookings.filter(
    (b) =>
      b.booking_status === 'completed' ||
      b.booking_status === 'cancelled' ||
      b.booking_status === 'no_show',
  );

  if (localBookings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-neutral-200 bg-white py-16 text-center shadow-sm">
        <span className="text-5xl">🌅</span>
        <div>
          <p className="font-semibold text-neutral-800">No bookings today</p>
          <p className="mt-1 text-sm text-neutral-500">Enjoy your day off!</p>
        </div>
        <a
          href="/dashboard/provider"
          className="mt-2 rounded-xl border border-neutral-200 px-5 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
        >
          Back to Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {globalError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {globalError}
        </div>
      )}

      {activeBookings.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-coral">
            Active · {activeBookings.length}
          </p>
          {activeBookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}

      {doneBookings.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Done · {doneBookings.length}
          </p>
          {doneBookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}

      {/* Summary bar */}
      <div className="rounded-2xl border border-[#e7c4a7] bg-white p-4 shadow-sm">
        <div className="flex justify-around text-center">
          {Object.entries(
            localBookings.reduce(
              (acc, b) => ({ ...acc, [b.booking_status]: (acc[b.booking_status] ?? 0) + 1 }),
              {} as Record<string, number>,
            ),
          ).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
            return (
              <div key={status}>
                <p className="text-xl font-bold text-neutral-950">{count}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {cfg?.label ?? status}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
