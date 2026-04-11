'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useBookingRealtime, useOptimisticUpdate } from '@/lib/hooks/useRealtime';
import { calculateLightweightPetCompletion } from '@/lib/utils/pet-completion';
import Button from '@/components/ui/Button';
import PetPassportViewModal, { type PetPassportData } from './PetPassportViewModal';

// Subcomponents
import DashboardTabBar from './user/DashboardTabBar';
import HomeTab from './user/HomeTab';
import BookingsTab from './user/BookingsTab';
import PetsTab from './user/PetsTab';
import AccountTab from './user/AccountTab';
import BookingDetailsModal from './user/BookingDetailsModal';
import CancelBookingModal from './user/CancelBookingModal';
import PetManagerModal from './user/PetManagerModal';

// Types and utilities
import type { Booking, Pet, UserDashboardView, ReminderGroup, ReminderPreferences } from './user/types';
import { resolveBookingStatus, normalizeBookingRecord } from './user/bookingUtils';
import { normalizeDisplayImageUrl, normalizeStorageObjectPath } from './user/petUtils';

export default function UserDashboardClient({
  userId,
  userName,
  initialPets,
  initialBookings,
  view = 'home',
  highlightedBookingId,
}: {
  userId: string;
  userName: string;
  initialPets: Pet[];
  initialBookings: Booking[];
  view?: UserDashboardView;
  highlightedBookingId?: number | null;
}) {
  const [pets, setPets] = useState(initialPets);
  const [bookings, setBookings] = useState(initialBookings.map(normalizeBookingRecord));
  const [petPhotoUrls, setPetPhotoUrls] = useState<Record<number, string>>({});
  const [bookingFilter, setBookingFilter] = useState<'all' | 'active' | 'history'>('all');
  const [, startTransition] = useTransition();
  const { showToast } = useToast();
  const { performUpdate } = useOptimisticUpdate(bookings, setBookings);
  const [reminders, setReminders] = useState<ReminderGroup[]>([]);
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreferences>({
    daysAhead: 7,
    inAppEnabled: true,
    emailEnabled: false,
    whatsappEnabled: false,
  });
  const [pendingCancellationBookingId, setPendingCancellationBookingId] = useState<number | null>(null);
  const [isCancellingBookingId, setIsCancellingBookingId] = useState<number | null>(null);
  const [activePassportPetId, setActivePassportPetId] = useState<number | null>(null);
  const [activePassportData, setActivePassportData] = useState<PetPassportData | null>(null);
  const [isPassportModalOpen, setIsPassportModalOpen] = useState(false);
  const [isPassportModalLoading, setIsPassportModalLoading] = useState(false);
  const [isPetManagerModalOpen, setIsPetManagerModalOpen] = useState(false);
  const [petManagerSelectedPetId, setPetManagerSelectedPetId] = useState<number | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<number | null>(null);
  const [isVaccinationSectionOpen, setIsVaccinationSectionOpen] = useState(false);

  const bookingCounts = useMemo(() => ({
    total: bookings.length,
    active: bookings.filter((b) => {
      const s = resolveBookingStatus(b);
      return s === 'pending' || s === 'confirmed';
    }).length,
  }), [bookings]);

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (bookingFilter === 'active') {
      list = bookings.filter((b) => {
        const s = resolveBookingStatus(b);
        return s === 'pending' || s === 'confirmed';
      });
    } else if (bookingFilter === 'history') {
      list = bookings.filter((b) => {
        const s = resolveBookingStatus(b);
        return s !== 'pending' && s !== 'confirmed';
      });
    }
    // Sort: active bookings (pending/confirmed) first, then by date descending
    return [...list].sort((a, b) => {
      const sa = resolveBookingStatus(a);
      const sb = resolveBookingStatus(b);
      const aActive = sa === 'pending' || sa === 'confirmed' ? 1 : 0;
      const bActive = sb === 'pending' || sb === 'confirmed' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const dateA = a.booking_date || a.booking_start || '';
      const dateB = b.booking_date || b.booking_start || '';
      return dateB.localeCompare(dateA);
    });
  }, [bookings, bookingFilter]);

  const activeBooking = useMemo(
    () => (activeBookingId ? (bookings.find((b) => b.id === activeBookingId) ?? null) : null),
    [activeBookingId, bookings],
  );

  const userAlerts = useMemo(() => {
    const alerts: Array<{ level: 'info' | 'warning' | 'success'; message: string }> = [];
    const pending = bookings.filter((b) => resolveBookingStatus(b) === 'pending').length;
    const confirmed = bookings.filter((b) => resolveBookingStatus(b) === 'confirmed').length;
    const completed = bookings.filter((b) => resolveBookingStatus(b) === 'completed').length;
    const activeCount = pending + confirmed;

    if (activeCount > 0) alerts.push({ level: 'info', message: `${activeCount} confirmed booking(s) coming up soon.` });
    if (completed > 0) alerts.push({ level: 'success', message: `${completed} completed booking(s). Rebook your favorite service in one tap.` });
    if (alerts.length === 0) alerts.push({ level: 'info', message: 'No active notifications. Start your next booking when ready.' });

    return alerts;
  }, [bookings]);

  const petCompletionById = useMemo(
    () =>
      Object.fromEntries(
        pets.map((pet) => [
          pet.id,
          typeof pet.completion_percent === 'number'
            ? Math.max(0, Math.min(100, Math.round(pet.completion_percent)))
            : calculateLightweightPetCompletion(pet),
        ]),
      ) as Record<number, number>,
    [pets],
  );

  const petExperienceSummary = useMemo(() => {
    const completionValues = Object.values(petCompletionById);
    const avgCompletion = completionValues.length > 0
      ? Math.round(completionValues.reduce((sum, v) => sum + v, 0) / completionValues.length)
      : 0;
    return { totalPets: pets.length, avgCompletion, upcomingReminderGroups: reminders.length };
  }, [petCompletionById, pets.length, reminders.length]);

  const activityItems = userAlerts.map((alert, index) => ({
    id: `${alert.level}-${index}`,
    icon: alert.level === 'warning' ? '⚠️' : alert.level === 'success' ? '✅' : 'ℹ️',
    message: alert.message,
    timestamp: 'Just now',
    type: alert.level === 'warning' ? ('warning' as const) : alert.level === 'success' ? ('success' as const) : ('info' as const),
  }));

  const overviewBookings = filteredBookings.slice(0, 2);

  const bookingSummaryText =
    bookingFilter === 'all'
      ? `${bookingCounts.active} active • ${bookingCounts.total} total`
      : bookingFilter === 'active'
        ? `${filteredBookings.length} active booking${filteredBookings.length === 1 ? '' : 's'}`
        : `${filteredBookings.length} past booking${filteredBookings.length === 1 ? '' : 's'}`;

  // Realtime subscription for booking updates
  const refreshBookings = useCallback(async () => {
    try {
      const response = await fetch('/api/user/bookings');
      if (response.ok) {
        const data = await response.json();
        const nextBookings = Array.isArray(data.bookings) ? (data.bookings as Booking[]) : [];
        setBookings(nextBookings.map(normalizeBookingRecord));
      }
    } catch (error) {
      console.error('Failed to refresh bookings:', error);
    }
  }, []);

  useBookingRealtime(userId, refreshBookings);

  useEffect(() => {
    if (view !== 'bookings' || !highlightedBookingId) return;
    const target = document.querySelector<HTMLElement>(`[data-booking-id="${highlightedBookingId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [view, highlightedBookingId, filteredBookings]);

  useEffect(() => {
    let active = true;

    async function hydratePetPhotoUrls() {
      const entries = await Promise.all(
        pets.map(async (pet): Promise<[number, string]> => {
          if (!pet.photo_url) return [pet.id, ''];

          const isStorageReference = /\/storage\/v1\/object\//.test(pet.photo_url);
          const isDirectlyUsableStorageUrl = /\/storage\/v1\/object\/(public|sign)\//.test(pet.photo_url) || pet.photo_url.includes('token=');
          const directUrl = !isStorageReference ? normalizeDisplayImageUrl(pet.photo_url) : '';
          if (isDirectlyUsableStorageUrl) return [pet.id, normalizeDisplayImageUrl(pet.photo_url)];
          if (directUrl) return [pet.id, directUrl];

          try {
            const response = await fetch('/api/storage/signed-read-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bucket: 'pet-photos', path: normalizeStorageObjectPath(pet.photo_url), expiresIn: 3600 }),
            });
            if (!response.ok) return [pet.id, ''];
            const payload = (await response.json().catch(() => null)) as { signedUrl?: string } | null;
            return [pet.id, normalizeDisplayImageUrl(payload?.signedUrl)];
          } catch (err) {
            console.error(err);
            return [pet.id, ''];
          }
        }),
      );

      if (!active) return;

      const nextMap: Record<number, string> = {};
      entries.forEach(([id, url]) => { if (url) nextMap[id] = url; });
      setPetPhotoUrls(nextMap);
    }

    hydratePetPhotoUrls();
    return () => { active = false; };
  }, [pets]);

  useEffect(() => {
    let active = true;

    async function loadReminderPreferences() {
      const response = await fetch('/api/user/pets/reminder-preferences');
      if (!response.ok || !active) return;
      const payload = (await response.json().catch(() => null)) as { preferences?: ReminderPreferences } | null;
      if (payload?.preferences && active) setReminderPreferences(payload.preferences);
    }

    loadReminderPreferences();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadReminders() {
      const remindersResponse = await fetch(`/api/user/pets/upcoming-vaccinations?daysAhead=${reminderPreferences.daysAhead}`);
      if (remindersResponse.ok && active) {
        const payload = (await remindersResponse.json().catch(() => null)) as { reminders?: ReminderGroup[] } | null;
        if (payload?.reminders) setReminders(payload.reminders);
      }
    }

    loadReminders();
    return () => { active = false; };
  }, [reminderPreferences.daysAhead]);

  function saveReminderPreferences() {
    startTransition(async () => {
      const response = await fetch('/api/user/pets/reminder-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminderPreferences),
      });

      if (!response.ok) {
        showToast('Unable to save reminder preferences.', 'error');
        return;
      }

      const remindersResponse = await fetch(`/api/user/pets/upcoming-vaccinations?daysAhead=${reminderPreferences.daysAhead}`);
      if (remindersResponse.ok) {
        const payload = (await remindersResponse.json().catch(() => null)) as { reminders?: ReminderGroup[] } | null;
        if (payload?.reminders) setReminders(payload.reminders);
      }

      showToast('Reminder preferences saved.', 'success');
    });
  }

  function requestBookingCancellation(bookingId: number) {
    if (isCancellingBookingId !== null) return;
    setPendingCancellationBookingId(bookingId);
  }

  function closeCancellationModal() {
    if (isCancellingBookingId !== null) return;
    setPendingCancellationBookingId(null);
  }

  function confirmBookingCancellation() {
    if (!pendingCancellationBookingId || isCancellingBookingId !== null) return;

    const bookingId = pendingCancellationBookingId;
    setPendingCancellationBookingId(null);
    setIsCancellingBookingId(bookingId);

    performUpdate(
      (current) => current.map((b) => b.id === bookingId ? { ...b, status: 'cancelled', booking_status: 'cancelled' } : b),
      async () => {
        try {
          const response = await fetch(`/api/bookings/${bookingId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled', cancellationReason: 'cancelled_by_user_from_dashboard' }),
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error ?? 'Cancellation failed');
          }
        } finally {
          setIsCancellingBookingId((current) => (current === bookingId ? null : current));
        }
      },
      () => showToast('Booking cancelled.', 'success'),
      (error) => showToast(error.message || 'Cancellation failed.', 'error'),
    );
  }

  async function openPetPassportModal(petId: number) {
    setActivePassportPetId(petId);
    setIsPassportModalOpen(true);
    setIsPassportModalLoading(true);
    setActivePassportData(null);

    try {
      const response = await fetch(`/api/user/pets/${petId}/passport`);
      if (!response.ok) {
        showToast('Unable to load pet passport.', 'error');
        return;
      }

      const payload = (await response.json().catch(() => null)) as { profile?: PetPassportData } | null;
      if (!payload?.profile) {
        showToast('No passport data found for this pet.', 'error');
        return;
      }

      setActivePassportData(payload.profile);
    } catch (err) {
      console.error(err);
      showToast('Unable to load pet passport.', 'error');
    } finally {
      setIsPassportModalLoading(false);
    }
  }

  function openPetPassportEditor() {
    const targetPetId = activePassportPetId;
    if (!targetPetId) return;
    setIsPassportModalOpen(false);
    setPetManagerSelectedPetId(targetPetId);
    setIsPetManagerModalOpen(true);
  }

  function openPetManagerModal(selectedPetId?: number | null) {
    setPetManagerSelectedPetId(selectedPetId ?? null);
    setIsPetManagerModalOpen(true);
  }

  async function closePetManagerModal() {
    setIsPetManagerModalOpen(false);

    try {
      const response = await fetch('/api/user/pets');
      if (!response.ok) return;
      const payload = (await response.json().catch(() => null)) as { pets?: Pet[] } | null;
      if (Array.isArray(payload?.pets)) setPets(payload.pets);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-10 lg:space-y-14">
      {/* ===== HERO SECTION ===== */}
      <div className="space-y-4 rounded-2xl border border-brand-100/80 bg-[radial-gradient(circle_at_top_left,_#fff7f0_0%,_#ffffff_55%,_#f8f2ec_100%)] p-4 shadow-sm sm:space-y-6 sm:rounded-3xl sm:p-8">
        <div className="space-y-2 sm:space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-700 sm:text-xs sm:tracking-[0.16em]">Dofurs Customer Dashboard</p>
          <h1 className="text-2xl font-semibold text-neutral-950 sm:text-page-title sm:mb-2">Welcome back, {userName}</h1>
          <p className="text-sm leading-relaxed text-neutral-600 sm:text-body sm:max-w-2xl">Plan care, track services, and keep pet passports complete.</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
          <Link href="/forms/customer-booking" className="block">
            <Button variant="premium" className="h-11 w-full px-4 text-sm tracking-[0.01em] sm:w-auto sm:px-6">Book a Service</Button>
          </Link>
          <Button
            variant="premium"
            className="h-11 px-4 text-sm tracking-[0.01em] sm:px-6"
            type="button"
            onClick={() => openPetManagerModal(null)}
          >
            Pet Profiles
          </Button>
        </div>
      </div>

      <DashboardTabBar view={view} />

      {/* ===== ONBOARDING NUDGE ===== */}
      {pets.length === 0 && bookings.length === 0 && view === 'home' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <h3 className="text-base font-semibold text-amber-900">Complete your profile to get started</h3>
          <p className="mt-1 text-sm text-amber-800/80">Add your pets and book your first service to unlock the full Dofurs experience.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="premium" size="sm" type="button" onClick={() => openPetManagerModal(null)}>Add Your First Pet</Button>
            <Link href="/forms/customer-booking">
              <Button variant="premium" size="sm" type="button">Book a Service</Button>
            </Link>
            <Link href="/dashboard/user/profile">
              <Button variant="premium" size="sm" type="button">Complete Profile</Button>
            </Link>
          </div>
        </div>
      )}

      {/* ===== HOME VIEW ===== */}
      {view === 'home' && (
        <HomeTab
          bookings={bookings}
          filteredBookings={filteredBookings}
          overviewBookings={overviewBookings}
          pets={pets}
          petPhotoUrls={petPhotoUrls}
          petCompletionById={petCompletionById}
          bookingCounts={bookingCounts}
          activityItems={activityItems}
          reminders={reminders}
          reminderPreferences={reminderPreferences}
          isVaccinationSectionOpen={isVaccinationSectionOpen}
          isCancellingBookingId={isCancellingBookingId}
          onToggleVaccinationSection={() => setIsVaccinationSectionOpen((open) => !open)}
          onReminderPreferencesChange={setReminderPreferences}
          onSaveReminderPreferences={saveReminderPreferences}
          onCancelRequest={requestBookingCancellation}
          onViewDetails={(bookingId) => setActiveBookingId(bookingId)}
          onViewPassport={openPetPassportModal}
          onOpenPetManager={openPetManagerModal}
        />
      )}

      {/* ===== BOOKINGS VIEW ===== */}
      {view === 'bookings' && (
        <BookingsTab
          filteredBookings={filteredBookings}
          pets={pets}
          bookingFilter={bookingFilter}
          bookingCounts={bookingCounts}
          bookingSummaryText={bookingSummaryText}
          isCancellingBookingId={isCancellingBookingId}
          highlightedBookingId={highlightedBookingId}
          onFilterChange={setBookingFilter}
          onCancelRequest={requestBookingCancellation}
          onViewDetails={(bookingId) => setActiveBookingId(bookingId)}
        />
      )}

      {/* ===== PETS VIEW ===== */}
      {view === 'pets' && (
        <PetsTab
          pets={pets}
          petPhotoUrls={petPhotoUrls}
          petCompletionById={petCompletionById}
          onViewPassport={openPetPassportModal}
          onOpenPetManager={openPetManagerModal}
        />
      )}

      {/* ===== ACCOUNT VIEW ===== */}
      {view === 'account' && <AccountTab />}

      {/* ===== MODALS ===== */}
      <CancelBookingModal
        pendingCancellationBookingId={pendingCancellationBookingId}
        isCancellingBookingId={isCancellingBookingId}
        onClose={closeCancellationModal}
        onConfirm={confirmBookingCancellation}
      />

      <PetPassportViewModal
        isOpen={isPassportModalOpen}
        onClose={() => setIsPassportModalOpen(false)}
        data={activePassportData}
        photoUrl={activePassportData?.pet?.photo_url ?? (activePassportPetId ? (petPhotoUrls[activePassportPetId] ?? null) : null)}
        isLoading={isPassportModalLoading}
        onEdit={openPetPassportEditor}
      />

      <BookingDetailsModal
        activeBooking={activeBooking}
        isCancellingBookingId={isCancellingBookingId}
        onClose={() => setActiveBookingId(null)}
        onCancelRequest={requestBookingCancellation}
      />

      <PetManagerModal
        isOpen={isPetManagerModalOpen}
        pets={pets}
        petManagerSelectedPetId={petManagerSelectedPetId}
        petExperienceSummary={petExperienceSummary}
        onClose={closePetManagerModal}
      />
    </div>
  );
}
