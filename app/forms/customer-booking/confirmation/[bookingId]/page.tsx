import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  PackagePlus,
  PawPrint,
  RefreshCcw,
  WalletCards,
} from 'lucide-react';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import { premiumPrimaryCtaClass, premiumSecondaryCtaClass } from '@/lib/styles/premium-cta';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { loadBookingConfirmationData, type BookingConfirmationData } from '@/lib/bookings/confirmation';
import { isBookingConversionTrackingConfigured } from '@/lib/analytics/google-ads';
import { isMetaBookingConversionTrackingConfigured } from '@/lib/analytics/meta-ads';
import BookingConfirmationTracker from './BookingConfirmationTracker';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Booking Confirmation',
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  params: Promise<{ bookingId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatCurrency(value: number | null | undefined) {
  return currencyFormatter.format(Math.max(0, Number(value ?? 0)));
}

function parseBookingId(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readSearchParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatBookingDate(data: BookingConfirmationData) {
  const candidate = data.schedule.date ?? data.schedule.bookingStart;
  const parsed = new Date(data.schedule.date ? `${data.schedule.date}T00:00:00` : candidate);
  return Number.isNaN(parsed.getTime()) ? candidate : dateFormatter.format(parsed);
}

function formatTimeValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`1970-01-01T${value}`);
  return Number.isNaN(parsed.getTime()) ? value : timeFormatter.format(parsed);
}

function formatBookingTime(data: BookingConfirmationData) {
  const start = formatTimeValue(data.schedule.startTime);
  const end = formatTimeValue(data.schedule.endTime);

  if (start) {
    return end ? `${start} - ${end}` : start;
  }

  const parsed = new Date(data.schedule.bookingStart);
  return Number.isNaN(parsed.getTime()) ? data.schedule.bookingStart : timeFormatter.format(parsed);
}

function statusTone(status: BookingConfirmationData['booking']['displayStatus']) {
  if (status === 'completed') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'cancelled') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'no_show') return 'border-neutral-200 bg-neutral-50 text-neutral-700';
  if (status === 'in_progress') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function buildDateFromParts(date: string | null, time: string | null, fallback: string) {
  const parsed = date && time ? new Date(`${date}T${time}`) : new Date(fallback);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIcsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildCalendarHref(data: BookingConfirmationData) {
  const start = buildDateFromParts(data.schedule.date, data.schedule.startTime, data.schedule.bookingStart);
  if (!start) {
    return null;
  }

  const end = buildDateFromParts(data.schedule.date, data.schedule.endTime, data.schedule.bookingEnd ?? data.schedule.bookingStart)
    ?? new Date(start.getTime() + Math.max(30, data.schedule.estimatedDurationMinutes ?? 60) * 60_000);
  const title = `Dofurs booking #${data.booking.id} - ${data.booking.serviceLabel}`;
  const details = `Booking #${data.booking.id} for ${data.booking.serviceLabel}.`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dofurs//Booking Confirmation//EN',
    'BEGIN:VEVENT',
    `UID:dofurs-booking-${data.booking.id}@dofurs.in`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${details}`,
    data.visit.address ? `LOCATION:${data.visit.address}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#efd9c6] bg-white/85 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <div className="mt-1 text-sm font-semibold text-neutral-950">{value}</div>
    </div>
  );
}

function MoneyRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? 'pt-3 text-base font-bold text-neutral-950' : 'text-sm text-neutral-700'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Panel({ title, children, icon }: { title: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#ead3bf] bg-white/92 p-5 shadow-[0_18px_42px_rgba(132,95,61,0.10)] sm:p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#eed7c0] bg-[#fff5ea] text-[#a96533]">
          {icon}
        </span>
        <h2 className="text-lg font-bold text-neutral-950">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function BookingConfirmationPage({ params, searchParams }: PageProps) {
  const { bookingId: bookingIdParam } = await params;
  const bookingId = parseBookingId(bookingIdParam);

  if (!bookingId) {
    notFound();
  }

  const nextPath = `/forms/customer-booking/confirmation/${bookingId}`;
  const { user } = await requireAuthenticatedUser(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const admin = getSupabaseAdminClient();
  const data = await loadBookingConfirmationData(admin, bookingId, user.id);

  if (!data) {
    notFound();
  }

  const dashboardHref = `/dashboard/user?view=bookings&booking=${data.booking.id}`;
  const calendarHref = buildCalendarHref(data);
  const shouldTrackConversion =
    readSearchParam(resolvedSearchParams, 'conversion') === 'booking' &&
    data.conversion.eligible;
  const conversionProviders = shouldTrackConversion
    ? [
        isBookingConversionTrackingConfigured() ? 'google_ads' : null,
        isMetaBookingConversionTrackingConfigured() ? 'meta_ads' : null,
      ].filter((provider): provider is 'google_ads' | 'meta_ads' => provider !== null)
    : [];
  const whatsappHref = `https://wa.me/917008365175?text=${encodeURIComponent(`Hi Dofurs, I need help with booking #${data.booking.id}.`)}`;
  const petNames = data.pets.length > 0 ? data.pets.map((pet) => pet.name).join(', ') : 'Selected pet';
  const statusClass = statusTone(data.booking.displayStatus);

  return (
    <>
      <BookingConfirmationTracker bookingId={data.booking.id} providers={conversionProviders} />
      <Navbar />
      <div className="min-h-screen bg-[linear-gradient(180deg,#fffcf8_0%,#fff7ef_42%,#fffcf9_100%)] px-4 pb-20 pt-28 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1200px] space-y-6">
          <section className="overflow-hidden rounded-[28px] border border-[#e6c8ad] bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_48%,#fff1e1_100%)] shadow-premium-xl">
            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-8">
              <div>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {data.booking.statusLabel}
                </span>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6c48]">Booking #{data.booking.id}</p>
                <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight text-neutral-950 sm:text-4xl">
                  Your booking is confirmed
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 sm:text-base">
                  We are ready to take care of {petNames}. Your service time, address, payment details, and Dofurs support are all saved here for a smooth visit.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailItem label="Service" value={data.booking.serviceLabel} />
                  <DetailItem label="Date" value={formatBookingDate(data)} />
                  <DetailItem label="Time" value={formatBookingTime(data)} />
                  <DetailItem label="Payment" value={data.payment.label} />
                </div>
              </div>

              <aside className="rounded-[24px] border border-[#ead3bf] bg-white/88 p-4 shadow-[0_12px_28px_rgba(132,95,61,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Next action</p>
                <Link href={dashboardHref} className={premiumPrimaryCtaClass('mt-3 w-full justify-center gap-2 px-5 py-3 text-sm font-semibold')}>
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  View/manage booking
                </Link>
                <div className="mt-3 grid gap-2">
                  {calendarHref ? (
                    <a href={calendarHref} download={`dofurs-booking-${data.booking.id}.ics`} className={premiumSecondaryCtaClass('justify-center gap-2 px-4 py-2.5 text-sm font-semibold')}>
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      Add to calendar
                    </a>
                  ) : null}
                  {data.actions.canPayPendingOnline ? (
                    <Link href={dashboardHref} className={premiumSecondaryCtaClass('justify-center gap-2 px-4 py-2.5 text-sm font-semibold')}>
                      <CreditCard className="h-4 w-4" aria-hidden="true" />
                      Pay pending amount
                    </Link>
                  ) : null}
                  {data.actions.canReschedule ? (
                    <Link href={`/forms/customer-booking?reschedule=${data.booking.id}`} className={premiumSecondaryCtaClass('justify-center gap-2 px-4 py-2.5 text-sm font-semibold')}>
                      <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                      Reschedule
                    </Link>
                  ) : null}
                  {data.actions.canManageAddOns ? (
                    <Link href={dashboardHref} className={premiumSecondaryCtaClass('justify-center gap-2 px-4 py-2.5 text-sm font-semibold')}>
                      <PackagePlus className="h-4 w-4" aria-hidden="true" />
                      Manage add-ons
                    </Link>
                  ) : null}
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className={premiumSecondaryCtaClass('justify-center gap-2 px-4 py-2.5 text-sm font-semibold')}>
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Contact support
                  </a>
                </div>
              </aside>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <Panel title="Booking summary" icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}>
                {data.pets.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.pets.map((pet) => (
                      <div key={pet.id} className="rounded-2xl border border-[#efd9c6] bg-[#fffaf5] px-4 py-3">
                        <p className="text-sm font-bold text-neutral-950">{pet.name}</p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600">
                          {[pet.breed, pet.gender, pet.age != null ? `${pet.age} yrs` : null, pet.sizeCategory]
                            .filter(Boolean)
                            .join(' • ') || 'Pet details saved'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <DetailItem label="Pet" value={petNames} />
                )}
              </Panel>

              <Panel title="Visit details" icon={<MapPin className="h-5 w-5" aria-hidden="true" />}>
                <div className="space-y-3">
                  <DetailItem
                    label={data.booking.bookingMode === 'teleconsult' ? 'Consultation' : 'Address'}
                    value={data.visit.address ?? (data.booking.bookingMode === 'teleconsult' ? 'Teleconsult details will be shared before the slot.' : 'Address not specified')}
                  />
                  {data.visit.pincode ? <DetailItem label="Pincode" value={data.visit.pincode} /> : null}
                  {data.visit.customerNotes ? <DetailItem label="Notes" value={data.visit.customerNotes} /> : null}
                </div>
              </Panel>

              <Panel title="Services and add-ons" icon={<PawPrint className="h-5 w-5" aria-hidden="true" />}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#efd9c6] bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-neutral-950">{data.booking.serviceLabel}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {data.booking.includedServices.length > 1
                          ? `Includes ${data.booking.includedServices.join(', ')}`
                          : 'Main service'}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-neutral-950">{formatCurrency(data.payment.serviceSubtotalInr)}</span>
                  </div>
                  {data.addOns.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {data.addOns.map((addOn) => (
                        <div key={addOn.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[#efd9c6] bg-[#fffaf5] px-4 py-3 text-sm">
                          <span className="font-semibold text-neutral-900">{addOn.name} x {addOn.quantity}</span>
                          <span className="font-bold text-neutral-950">{formatCurrency(addOn.totalPriceInr)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-[#e7cdb7] bg-[#fffaf5] px-4 py-3 text-sm text-neutral-600">
                      No add-ons are attached to this booking yet.
                    </p>
                  )}
                  {data.schedule.estimatedDurationMinutes ? (
                    <p className="text-xs font-medium text-neutral-500">Estimated service time: {data.schedule.estimatedDurationMinutes} minutes</p>
                  ) : null}
                </div>
              </Panel>
            </div>

            <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
              <Panel title="Payment summary" icon={<WalletCards className="h-5 w-5" aria-hidden="true" />}>
                <div className="space-y-3">
                  <MoneyRow label="Service subtotal" value={formatCurrency(data.payment.serviceSubtotalInr)} />
                  {data.payment.addonSubtotalInr > 0 ? <MoneyRow label="Add-ons" value={formatCurrency(data.payment.addonSubtotalInr)} /> : null}
                  {data.payment.discountAmountInr > 0 ? <MoneyRow label={data.payment.discountCode ? `Discount (${data.payment.discountCode})` : 'Discount'} value={`-${formatCurrency(data.payment.discountAmountInr)}`} /> : null}
                  {data.payment.walletCreditsInr > 0 ? <MoneyRow label="Dofurs Credits" value={`-${formatCurrency(data.payment.walletCreditsInr)}`} /> : null}
                  <div className="border-t border-[#ead3bf]" />
                  <MoneyRow label="Booking value" value={formatCurrency(data.payment.netPayableInr)} strong />
                  <MoneyRow label="Paid/covered" value={formatCurrency(data.payment.paidOrCollectedInr)} />
                  {data.payment.pendingPayableInr > 0 ? (
                    <MoneyRow label="Pending payable" value={formatCurrency(data.payment.pendingPayableInr)} strong />
                  ) : null}
                  <p className="rounded-2xl border border-[#e9d4c1] bg-[#fff8f1] px-4 py-3 text-xs font-semibold text-[#7a5437]">
                    {data.payment.label}
                  </p>
                </div>
              </Panel>

              <Panel title="What happens next" icon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}>
                <div className="space-y-3 text-sm leading-6 text-neutral-600">
                  <p>Your booking is available in your dashboard with live status and payment details.</p>
                  <p>The Dofurs team can use booking #{data.booking.id} to locate this service quickly.</p>
                  {data.invoice ? (
                    <p>Invoice {data.invoice.number ?? data.invoice.id} is {data.invoice.status ?? 'saved'}.</p>
                  ) : null}
                </div>
                <div className="mt-5 grid gap-2">
                  <Link href="/forms/customer-booking" className={premiumSecondaryCtaClass('justify-center gap-2 px-4 py-2.5 text-sm font-semibold')}>
                    <PackagePlus className="h-4 w-4" aria-hidden="true" />
                    Book another service
                  </Link>
                </div>
              </Panel>
            </aside>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}