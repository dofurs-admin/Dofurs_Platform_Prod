'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import StatCard from '../premium/StatCard';
import BookingCard from '../premium/BookingCard';
import PetCard from '../premium/PetCard';
import EmptyState from '../premium/EmptyState';
import ActivityFeed from '../premium/ActivityFeed';
import SubscriptionSpotlightCard from './SubscriptionSpotlightCard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SectionCard from '../SectionCard';
import FormField from '../FormField';
import type { Booking, Pet, ReminderGroup, ReminderPreferences } from './types';
import { resolveBookingStatus, resolveProviderName } from './bookingUtils';
import { resolvePetAge } from './petUtils';

type ActivityItem = {
  id: string;
  icon: string;
  message: string;
  timestamp: string;
  type: 'warning' | 'success' | 'info';
};

type Props = {
  bookings: Booking[];
  filteredBookings: Booking[];
  overviewBookings: Booking[];
  pets: Pet[];
  petPhotoUrls: Record<number, string>;
  petCompletionById: Record<number, number>;
  bookingCounts: { active: number; total: number };
  activityItems: ActivityItem[];
  reminders: ReminderGroup[];
  reminderPreferences: ReminderPreferences;
  isVaccinationSectionOpen: boolean;
  isCancellingBookingId: number | null;
  onToggleVaccinationSection: () => void;
  onReminderPreferencesChange: (prefs: ReminderPreferences) => void;
  onSaveReminderPreferences: () => void;
  onCancelRequest: (bookingId: number) => void;
  onViewDetails: (bookingId: number) => void;
  onViewPassport: (petId: number) => void;
  onOpenPetManager: (selectedPetId?: number | null) => void;
};

export default function HomeTab({
  bookings,
  filteredBookings,
  overviewBookings,
  pets,
  petPhotoUrls,
  petCompletionById,
  bookingCounts,
  activityItems,
  reminders,
  reminderPreferences,
  isVaccinationSectionOpen,
  isCancellingBookingId,
  onToggleVaccinationSection,
  onReminderPreferencesChange,
  onSaveReminderPreferences,
  onCancelRequest,
  onViewDetails,
  onViewPassport,
  onOpenPetManager,
}: Props) {
  return (
    <>
      {/* STATS SUMMARY ROW */}
      <section className="space-y-3 sm:space-y-6">
        <h2 className="text-section-title">Your Bookings at a Glance</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon="📊"
            label="Active Bookings"
            value={bookingCounts.active}
            trend={bookingCounts.active > 0 ? 'up' : 'neutral'}
            highlight={bookingCounts.active > 0}
          />
          <StatCard
            icon="✓"
            label="Completed"
            value={bookings.filter((booking) => resolveBookingStatus(booking) === 'completed').length}
            trend="neutral"
          />
          <StatCard
            icon="⚠"
            label="No Shows"
            value={bookings.filter((booking) => resolveBookingStatus(booking) === 'no_show').length}
            trend={
              bookings.filter((booking) => resolveBookingStatus(booking) === 'no_show').length > 0 ? 'down' : 'neutral'
            }
          />
          <StatCard icon="📅" label="Total Bookings" value={bookingCounts.total} trend="neutral" />
        </div>
      </section>

      {/* REFER & EARN BANNER */}
      <Link
        href="/refer-and-earn"
        className="flex items-center justify-between rounded-3xl border border-[#f1dcbd] bg-[linear-gradient(135deg,#fff8ef,#fff2e2)] p-5 shadow-soft transition-all duration-200 hover:shadow-premium"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#a05a2c]">Refer &amp; Earn</p>
          <p className="mt-1 text-base font-bold text-ink">Invite friends. Both of you earn ₹500.</p>
          <p className="mt-0.5 text-sm text-ink/60">Share your unique code and earn Dofurs Credits on any service.</p>
        </div>
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-coral text-xl text-white shadow-soft">
          🎁
        </div>
      </Link>

      <SubscriptionSpotlightCard />

      {/* ACTIVITY FEED */}
      <section className="space-y-3 sm:space-y-6">
        <h2 className="text-section-title">Recent Activity</h2>
        <Card className="border-[#ead3bf] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_100%)] p-3 shadow-[0_10px_22px_rgba(147,101,63,0.1)] sm:p-5 sm:shadow-[0_16px_30px_rgba(147,101,63,0.12)]">
          <ActivityFeed items={activityItems} emptyMessage="No recent notifications" />
        </Card>
      </section>

      {/* TWO COLUMN LAYOUT: BOOKINGS + PETS */}
      <div className="grid grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-2">
        {/* LEFT: Bookings Overview */}
        <section className="space-y-3 sm:space-y-6">
          <h2 className="text-section-title">Your Bookings</h2>
          {filteredBookings.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No Bookings Yet"
              description="Start by booking a service for your pet. Your provider will confirm and manage the appointment."
              ctaLabel="Book Your First Service"
              ctaHref="/forms/customer-booking"
            />
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {overviewBookings.map((booking) => (
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
                />
              ))}
              {bookings.length > 2 && (
                <Link
                  href="/dashboard/user?view=bookings"
                  className="block py-1.5 text-center text-sm font-semibold tracking-[0.01em] text-orange-600 hover:text-orange-700"
                >
                  View All Bookings →
                </Link>
              )}
            </div>
          )}
        </section>

        {/* RIGHT: Pet Profiles Overview */}
        <section id="pets-section" className="space-y-3 sm:space-y-6">
          <h2 className="text-section-title">Your Pets</h2>
          {pets.length === 0 ? (
            <EmptyState
              icon="🐾"
              title="No Pets Yet"
              description="Add your first pet to get started. Create a complete passport with medical and behavioral info."
              ctaLabel="Add Your First Pet"
              ctaOnClick={() => onOpenPetManager(null)}
            />
          ) : (
            <div className="relative">
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-brand-200 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0">
                {pets.slice(0, 2).map((pet) => (
                  <PetCard
                    key={pet.id}
                    id={pet.id}
                    name={pet.name}
                    breed={pet.breed ?? undefined}
                    age={resolvePetAge(pet)}
                    photo={petPhotoUrls[pet.id]}
                    hasDisability={pet.has_disability}
                    accessRole={pet.access_role}
                    ownerName={pet.owner_name}
                    completionPercent={petCompletionById[pet.id]}
                    className="min-w-[220px] flex-shrink-0 snap-start sm:min-w-0"
                    onViewPassport={onViewPassport}
                  />
                ))}
                {pets.length > 2 && (
                  <Card className="flex min-w-[220px] flex-shrink-0 snap-start items-center justify-center border-[#ead3bf] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_100%)] p-4 shadow-[0_10px_22px_rgba(147,101,63,0.1)] sm:min-w-0 sm:p-6 sm:shadow-[0_16px_30px_rgba(147,101,63,0.12)]">
                    <Button variant="premium" type="button" onClick={() => onOpenPetManager(null)}>
                      Manage All Pets
                    </Button>
                  </Card>
                )}
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/80 to-transparent sm:hidden"
                aria-hidden="true"
              />
            </div>
          )}
        </section>
      </div>

      {/* UPCOMING VACCINE REMINDERS - Collapsible */}
      <section className="space-y-3 sm:space-y-6">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={onToggleVaccinationSection}
          aria-expanded={isVaccinationSectionOpen}
        >
          <div>
            <h2 className="text-section-title">Vaccination Reminders</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {reminders.length > 0
                ? `${reminders.length} pet(s) with upcoming vaccinations`
                : 'No upcoming reminders'}
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-neutral-400 transition-transform duration-300 ${isVaccinationSectionOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <div
          className={`grid transition-all duration-300 ${isVaccinationSectionOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="overflow-hidden">
            <SectionCard
              title={`Reminder Preferences (${reminderPreferences.daysAhead} days window)`}
              description="Choose channels and reminder window."
            >
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_auto] xl:items-end">
                <FormField
                  label="Window (days)"
                  type="number"
                  min={1}
                  max={90}
                  value={String(reminderPreferences.daysAhead)}
                  onChange={(event) =>
                    onReminderPreferencesChange({
                      ...reminderPreferences,
                      daysAhead: Math.max(1, Math.min(90, Number.parseInt(event.target.value || '7', 10))),
                    })
                  }
                  className="xl:col-span-1"
                />
                <div className="flex items-stretch xl:justify-end">
                  <Button
                    type="button"
                    variant="premium"
                    onClick={onSaveReminderPreferences}
                    className="w-full xl:w-auto xl:min-w-[190px]"
                  >
                    Save Preferences
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex min-h-[52px] w-full cursor-pointer items-center gap-2 rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-3 text-sm font-medium text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md">
                  <input
                    type="checkbox"
                    checked={reminderPreferences.inAppEnabled}
                    onChange={(event) =>
                      onReminderPreferencesChange({ ...reminderPreferences, inAppEnabled: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500/30"
                  />
                  In-App
                </label>
                <label className="flex min-h-[52px] w-full cursor-pointer items-center gap-2 rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-3 text-sm font-medium text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md">
                  <input
                    type="checkbox"
                    checked={reminderPreferences.emailEnabled}
                    onChange={(event) =>
                      onReminderPreferencesChange({ ...reminderPreferences, emailEnabled: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500/30"
                  />
                  Email
                </label>
                <label className="flex min-h-[52px] w-full cursor-pointer items-center gap-2 rounded-xl border border-[#ead3bf] bg-[#fffaf4] px-3 py-3 text-sm font-medium text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md">
                  <input
                    type="checkbox"
                    checked={reminderPreferences.whatsappEnabled}
                    onChange={(event) =>
                      onReminderPreferencesChange({ ...reminderPreferences, whatsappEnabled: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500/30"
                  />
                  WhatsApp
                </label>
              </div>

              {reminders.length === 0 ? (
                <div className="rounded-2xl border border-[#ead3bf] bg-[linear-gradient(180deg,#fffdf9_0%,#fff5eb_100%)] p-6 text-center shadow-[0_10px_24px_rgba(147,101,63,0.10)]">
                  <p className="text-sm text-neutral-600">
                    No upcoming reminders. Your due vaccinations will appear here when dates are within the selected
                    window.
                  </p>
                </div>
              ) : (
                <ul className="grid gap-3">
                  {reminders.map((group) => (
                    <li
                      key={group.petId}
                      className="rounded-2xl border border-[#ead3bf] bg-[linear-gradient(180deg,#ffffff_0%,#fff8ef_100%)] p-4 shadow-[0_12px_26px_rgba(147,101,63,0.10)] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(147,101,63,0.14)]"
                    >
                      <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-[15px] font-semibold text-neutral-900">{group.petName}</div>
                            <span className="rounded-full border border-brand-200 bg-brand-100/70 px-2 py-0.5 text-xs font-semibold text-brand-700">
                              {group.vaccinations.length} due
                            </span>
                          </div>
                          <div className="mt-1 text-sm leading-relaxed text-neutral-600">
                            {group.vaccinations
                              .map((vax) => `${vax.vaccineName} (${new Date(vax.nextDueDate).toLocaleDateString()})`)
                              .join(' • ')}
                          </div>
                        </div>
                        <div className="w-full md:w-auto">
                          <Button
                            variant="premium"
                            size="sm"
                            fullWidth
                            onClick={() => onViewPassport(group.petId)}
                          >
                            View Pet Passport
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      </section>
    </>
  );
}
