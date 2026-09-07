'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Modal from '@/components/ui/Modal';
import { Button, Alert } from '@/components/ui';
import BookingAddonManager from '@/components/dashboard/shared/BookingAddonManager';
import { ACTIVE_BOOKING_ADDON_STATUSES } from '@/lib/bookings/addon-items';
import { resolveIncludedServicesForBooking } from '@/lib/bookings/included-services';
import { buildIncludedServicesLabel } from '@/lib/bookings/included-services';

type BookingNote = {
  id: string;
  booking_id: number;
  admin_user_id: string;
  note: string;
  created_at: string;
};

type BookingInvoice = {
  id: string;
  invoice_number: string;
  status: string;
  total_inr: number;
  wallet_credits_applied_inr?: number | null;
  issued_at: string | null;
  paid_at: string | null;
};

type BookingAddonItem = {
  id: string;
  name_snapshot: string;
  quantity: number;
  total_price_inr?: number | null;
  total_price_snapshot?: number | null;
  status: string;
};

type StatusEvent = {
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
};

type CustomerFeedbackEntry = {
  id: string;
  booking_id: number;
  user_id: string;
  provider_id: number;
  rating: number;
  notes: string | null;
  created_by_user_id: string;
  created_by_role: 'provider' | 'admin' | 'staff';
  created_at: string;
  updated_at: string;
};

type BookingDetail = {
  id: number;
  user_id: string;
  provider_id: number;
  booking_start: string;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  booking_status: string | null;
  booking_mode: string | null;
  payment_mode: string | null;
  service_type: string | null;
  provider_service_id: string | null;
  address: string | null;
  pincode: string | null;
  notes: string | null;
  internal_notes?: string | null;
  provider_notes?: string | null;
  admin_price_reference?: number | null;
  included_services?: string[];
  subtotal_inr: number | null;
  discount_inr: number | null;
  total_inr: number | null;
  final_price: number | null;
  price_at_booking: number | null;
  wallet_credits_applied_inr: number | null;
  pending_payable_inr?: number | null;
  discount_code: string | null;
  created_at: string;
  users: { name: string | null; email: string | null; phone: string | null; address: string | null } | null;
  providers: { name: string | null; email: string | null; phone_number: string | null } | null;
  pets: Array<{ id: string; name: string; breed: string | null; age: number | null; gender: string | null; size_category: string | null }> | null;
  booking_status_transition_events: StatusEvent[] | null;
};

type SopChecklistSubmission = {
  id: string;
  title_snapshot: string;
  instructions_snapshot: string | null;
  requires_photo_snapshot: boolean;
  min_photo_count_snapshot: number;
  max_photo_count_snapshot: number;
  mandatory_snapshot: boolean;
  sop_version: number;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'waived';
  submitted_at: string | null;
  review_note: string | null;
  waive_reason: string | null;
  photos: Array<{ id: string; signed_url: string | null; created_at: string }>;
};

type SopChecklist = {
  sop_completion_waived: boolean;
  sop_waiver_reason: string | null;
  sop_waived_at: string | null;
  submissions: SopChecklistSubmission[];
};

const SOP_STATUS_META: Record<SopChecklistSubmission['status'], { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800 border-green-200' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700 border-red-200' },
  waived: { label: 'Waived', className: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
};

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

function fmt(v: number | null | undefined) { return v != null ? CURRENCY_FORMATTER.format(v) : '—'; }
function fmtDt(v: string) { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : DATE_TIME_FORMATTER.format(d); }

function formatPaymentModeLabel(value: string | null | undefined) {
  if (!value) return 'Not specified';
  if (value === 'direct_to_provider') return 'Direct to provider';
  if (value === 'platform') return 'Paid online';
  if (value === 'subscription_credit') return 'Subscription credits';
  if (value === 'mixed') return 'Mixed payment';
  return value.replace(/_/g, ' ');
}

function isActiveAddonStatus(value: string | null | undefined) {
  return ACTIVE_BOOKING_ADDON_STATUSES.has((value ?? '').trim().toLowerCase());
}

type Props = {
  bookingId: number | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function BookingDetailModal({ bookingId, isOpen, onClose }: Props) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [invoices, setInvoices] = useState<BookingInvoice[]>([]);
  const [addonItems, setAddonItems] = useState<BookingAddonItem[]>([]);
  const [isAddonManagementOpen, setIsAddonManagementOpen] = useState(false);
  const [notes, setNotes] = useState<BookingNote[]>([]);
  const [customerFeedback, setCustomerFeedback] = useState<CustomerFeedbackEntry[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [customerRatingInput, setCustomerRatingInput] = useState<number>(5);
  const [customerFeedbackInput, setCustomerFeedbackInput] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [customerFeedbackError, setCustomerFeedbackError] = useState<string | null>(null);
  const [sopChecklist, setSopChecklist] = useState<SopChecklist | null>(null);
  const [sopAction, setSopAction] = useState<{ submissionId: string; action: 'reject' | 'waive' } | null>(null);
  const [sopActionInput, setSopActionInput] = useState('');
  const [sopBusyId, setSopBusyId] = useState<string | null>(null);
  const [sopActionError, setSopActionError] = useState<string | null>(null);
  const [waiveAllOpen, setWaiveAllOpen] = useState(false);
  const [waiveAllReason, setWaiveAllReason] = useState('');
  const [isLoading, startLoad] = useTransition();
  const [isSavingNote, startSave] = useTransition();

  const refreshBookingCore = useCallback(async (targetBookingId: number) => {
    const detailRes = await fetch(`/api/admin/bookings/${targetBookingId}`, { cache: 'no-store' });

    if (!detailRes.ok) {
      const payload = (await detailRes.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Failed to load booking details.');
    }

    const detail = await detailRes.json();
    setBooking(detail.booking ?? null);
    setInvoices(detail.invoices ?? []);
    setAddonItems(detail.addonItems ?? []);
    setSopChecklist(detail.sopChecklist ?? null);
  }, []);

  useEffect(() => {
    if (!isOpen || bookingId == null) return;
    setBooking(null);
    setNotes([]);
    setCustomerFeedback([]);
    setInvoices([]);
    setAddonItems([]);
    setIsAddonManagementOpen(false);
    setLoadError(null);
    setCustomerFeedbackError(null);
    setCustomerFeedbackInput('');
    setCustomerRatingInput(5);
    setSopChecklist(null);
    setSopAction(null);
    setSopActionInput('');
    setSopActionError(null);
    setWaiveAllOpen(false);
    setWaiveAllReason('');

    startLoad(async () => {
      try {
        const [notesRes, customerFeedbackRes] = await Promise.all([
          fetch(`/api/admin/bookings/${bookingId}/notes`, { cache: 'no-store' }),
          fetch(`/api/admin/bookings/${bookingId}/customer-feedback`, { cache: 'no-store' }),
        ]);

        await refreshBookingCore(bookingId);

        if (notesRes.ok) {
          const notesData = await notesRes.json();
          setNotes(notesData.notes ?? []);
        }

        if (customerFeedbackRes.ok) {
          const feedbackData = await customerFeedbackRes.json();
          setCustomerFeedback(feedbackData.feedback ?? []);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load booking details. Please try again.';
        setLoadError(message);
      }
    });
  }, [bookingId, isOpen, refreshBookingCore]);

  function handleSaveNote() {
    if (!noteInput.trim() || bookingId == null) return;
    setNoteError(null);
    startSave(async () => {
      const res = await fetch(`/api/admin/bookings/${bookingId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: noteInput.trim() }),
      });
      if (!res.ok) {
        setNoteError('Failed to save note.');
        return;
      }
      const data = await res.json();
      setNotes((prev) => [data.note, ...prev]);
      setNoteInput('');
    });
  }

  async function submitSopAction(
    submissionId: string,
    action: 'approve' | 'reject' | 'waive',
    options?: { note?: string; reason?: string },
  ) {
    if (bookingId == null) return;
    setSopActionError(null);
    setSopBusyId(submissionId);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/sops/${submissionId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, note: options?.note, reason: options?.reason }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Unable to update this SOP.');
      }
      setSopAction(null);
      setSopActionInput('');
      await refreshBookingCore(bookingId);
    } catch (error) {
      setSopActionError(error instanceof Error ? error.message : 'Unable to update this SOP.');
    } finally {
      setSopBusyId(null);
    }
  }

  async function waiveAllSops() {
    if (bookingId == null) return;
    setSopActionError(null);
    setSopBusyId('waive-all');
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/sops/waive`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: waiveAllReason.trim() }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Unable to waive SOP requirements.');
      }
      setWaiveAllOpen(false);
      setWaiveAllReason('');
      await refreshBookingCore(bookingId);
    } catch (error) {
      setSopActionError(error instanceof Error ? error.message : 'Unable to waive SOP requirements.');
    } finally {
      setSopBusyId(null);
    }
  }

  function handleSaveCustomerFeedback() {
    if (bookingId == null) return;
    setCustomerFeedbackError(null);

    startSave(async () => {
      const res = await fetch(`/api/admin/bookings/${bookingId}/customer-feedback`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rating: customerRatingInput,
          notes: customerFeedbackInput.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setCustomerFeedbackError(payload?.error ?? 'Failed to save customer feedback.');
        return;
      }

      const refreshRes = await fetch(`/api/admin/bookings/${bookingId}/customer-feedback`, {
        cache: 'no-store',
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setCustomerFeedback(data.feedback ?? []);
      }

      setCustomerFeedbackInput('');
    });
  }

  const handleAddonManagerUpdated = useCallback(() => {
    if (bookingId == null) {
      return;
    }

    void refreshBookingCore(bookingId).catch((error) => {
      setLoadError(error instanceof Error ? error.message : 'Unable to refresh booking after addon update.');
    });
  }, [bookingId, refreshBookingCore]);

  const status = booking?.booking_status ?? booking?.status ?? '';
  const walletApplied = booking ? Math.max(0, Number(booking.wallet_credits_applied_inr ?? 0)) : 0;
  const discountInr = booking ? Math.max(0, Number(booking.discount_inr ?? 0)) : 0;
  const referenceServiceSubtotalInr = booking
    ? Math.max(0, Number(booking.subtotal_inr ?? booking.admin_price_reference ?? booking.price_at_booking ?? 0))
    : 0;
  const allAddonItems = addonItems;
  const activeAddonItems = addonItems.filter((item) => isActiveAddonStatus(item.status));
  const addonSubtotalInr = activeAddonItems.reduce(
    (sum, item) => sum + Math.max(0, Number(item.total_price_inr ?? item.total_price_snapshot ?? 0)),
    0,
  );
  const finalAmountFromBookingInr = booking
    ? Math.max(0, Number(booking.final_price ?? booking.total_inr ?? 0))
    : 0;
  const fallbackFinalAmountInr = Math.max(
    0,
    referenceServiceSubtotalInr + addonSubtotalInr - discountInr - walletApplied,
  );
  const finalAmountInr = finalAmountFromBookingInr > 0 ? finalAmountFromBookingInr : fallbackFinalAmountInr;
  const impliedGrossSubtotalInr = Math.max(0, finalAmountInr + discountInr + walletApplied);
  const hasReferenceServiceSubtotal = referenceServiceSubtotalInr > 0;
  const serviceSubtotalInr = hasReferenceServiceSubtotal
    ? referenceServiceSubtotalInr
    : Math.max(0, impliedGrossSubtotalInr - addonSubtotalInr);
  const reconciliationAdjustmentInr = hasReferenceServiceSubtotal
    ? Math.round(impliedGrossSubtotalInr - (referenceServiceSubtotalInr + addonSubtotalInr))
    : 0;
  const grossSubtotalInr = Math.max(0, serviceSubtotalInr + addonSubtotalInr + reconciliationAdjustmentInr);
  const pendingPayable = booking
    ? Math.max(0, Number(booking.pending_payable_inr ?? Math.max(0, finalAmountInr - walletApplied)))
    : 0;
  const paidOrCollectedInr = Math.max(0, finalAmountInr - pendingPayable);
  const includedServices = booking
    ? Array.isArray(booking.included_services)
      ? booking.included_services
      : resolveIncludedServicesForBooking({
          service_type: booking.service_type,
          provider_service_id: booking.provider_service_id,
          provider_notes: booking.provider_notes,
          internal_notes: booking.internal_notes ?? booking.notes,
          admin_price_reference: booking.admin_price_reference ?? booking.subtotal_inr,
          price_at_booking: booking.price_at_booking,
        })
    : [];
  const serviceLabel = buildIncludedServicesLabel(includedServices, booking?.service_type);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Booking #${bookingId}`} size="xl">
      {isLoading ? (
        <p className="text-sm text-neutral-500 py-8 text-center">Loading…</p>
      ) : loadError ? (
        <Alert variant="error">{loadError}</Alert>
      ) : !booking ? null : (
        <div className="space-y-6">
          {/* Status + dates */}
          <div className="rounded-xl bg-neutral-50 p-4 space-y-1">
            <p className="text-sm font-semibold text-neutral-900">
              Status: <span className="font-normal capitalize">{status.replace('_', ' ')}</span>
              {serviceLabel ? ` • ${serviceLabel}` : ''}
              {booking.booking_mode ? ` • ${booking.booking_mode.replace('_', ' ')}` : ''}
            </p>
            {booking.user_id ? (
              <p className="text-sm">
                <Link
                  href={`/dashboard/admin/crm?customer=${booking.user_id}`}
                  className="font-semibold text-coral underline decoration-coral/40 underline-offset-2 transition hover:brightness-90"
                >
                  Customer 360 →
                </Link>
              </p>
            ) : null}
            {booking.booking_date && booking.start_time ? (
              <p className="text-sm text-neutral-600">{booking.booking_date} • {booking.start_time}{booking.end_time ? ` – ${booking.end_time}` : ''}</p>
            ) : (
              <p className="text-sm text-neutral-600">{fmtDt(booking.booking_start)}</p>
            )}
            {booking.address ? <p className="text-xs text-neutral-500">{booking.address}{booking.pincode ? `, ${booking.pincode}` : ''}</p> : null}
            {booking.notes ? <p className="text-xs text-neutral-500 italic">Notes: {booking.notes}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Customer */}
            <div className="rounded-xl border border-neutral-200 p-4 space-y-1">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Customer</p>
              <p className="text-sm font-semibold text-neutral-900">{booking.users?.name ?? '—'}</p>
              <p className="text-xs text-neutral-600">{booking.users?.email ?? 'No email'}</p>
              <p className="text-xs text-neutral-600">{booking.users?.phone ?? 'No phone'}</p>
              {booking.users?.address ? <p className="text-xs text-neutral-500">{booking.users.address}</p> : null}
            </div>

            {/* Provider */}
            <div className="rounded-xl border border-neutral-200 p-4 space-y-1">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Provider</p>
              <p className="text-sm font-semibold text-neutral-900">{booking.providers?.name ?? `#${booking.provider_id}`}</p>
              <p className="text-xs text-neutral-600">{booking.providers?.email ?? 'No email'}</p>
              <p className="text-xs text-neutral-600">{booking.providers?.phone_number ?? 'No phone'}</p>
            </div>
          </div>

          {/* Pets */}
          {(booking.pets?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Pets</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {booking.pets!.map((pet) => (
                  <div key={pet.id} className="rounded-lg border border-neutral-200 p-3">
                    <p className="text-sm font-semibold text-neutral-900">{pet.name}</p>
                    <p className="text-xs text-neutral-500">
                      {pet.breed ?? 'Breed n/a'} • {pet.gender ?? '—'} • {pet.age != null ? `${pet.age} yrs` : 'Age n/a'}
                      {pet.size_category ? ` • ${pet.size_category}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* SOP Checklist */}
          {sopChecklist && sopChecklist.submissions.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  SOP Checklist (
                  {sopChecklist.submissions.filter((s) => s.status !== 'pending' && s.status !== 'rejected').length}/
                  {sopChecklist.submissions.length} fulfilled)
                </p>
                {!sopChecklist.sop_completion_waived ? (
                  <Button size="sm" variant="secondary" onClick={() => setWaiveAllOpen((open) => !open)}>
                    {waiveAllOpen ? 'Cancel waive' : 'Waive SOP requirements'}
                  </Button>
                ) : null}
              </div>

              {sopChecklist.sop_completion_waived ? (
                <Alert variant="warning" className="!text-xs">
                  SOP requirements waived.
                  {sopChecklist.sop_waiver_reason ? ` Reason: ${sopChecklist.sop_waiver_reason}` : ''}
                  {sopChecklist.sop_waived_at ? ` (${fmtDt(sopChecklist.sop_waived_at)})` : ''}
                </Alert>
              ) : null}

              {waiveAllOpen ? (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800">
                    Waive all pending SOP requirements for this booking?
                  </p>
                  <textarea
                    value={waiveAllReason}
                    onChange={(event) => setWaiveAllReason(event.target.value)}
                    placeholder="Reason (required, recorded in the audit log) — e.g. customer declined photos"
                    maxLength={2000}
                    className="input-field min-h-[60px] w-full resize-y text-sm"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={sopBusyId !== null || waiveAllReason.trim().length < 3}
                      onClick={() => void waiveAllSops()}
                    >
                      {sopBusyId === 'waive-all' ? 'Waiving…' : 'Waive all SOPs'}
                    </Button>
                  </div>
                </div>
              ) : null}

              {sopActionError ? <Alert variant="error" className="!text-xs">{sopActionError}</Alert> : null}

              <div className="space-y-2">
                {sopChecklist.submissions.map((submission) => {
                  const meta = SOP_STATUS_META[submission.status] ?? SOP_STATUS_META.pending;

                  return (
                    <div key={submission.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-900">
                            {submission.title_snapshot}
                            {submission.mandatory_snapshot ? (
                              <span className="ml-1.5 rounded bg-coral/10 px-1.5 py-0.5 text-[10px] font-bold text-coral">
                                Mandatory
                              </span>
                            ) : (
                              <span className="ml-1.5 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500">
                                Optional
                              </span>
                            )}
                            <span className="ml-1.5 text-[10px] text-neutral-400">v{submission.sop_version}</span>
                          </p>
                          {submission.instructions_snapshot ? (
                            <p className="mt-0.5 text-xs text-neutral-500">{submission.instructions_snapshot}</p>
                          ) : null}
                          {submission.status === 'rejected' && submission.review_note ? (
                            <p className="mt-1 text-[11px] text-red-700">Rejected — {submission.review_note}</p>
                          ) : null}
                          {submission.status === 'waived' && submission.waive_reason ? (
                            <p className="mt-1 text-[11px] text-neutral-500">Waived — {submission.waive_reason}</p>
                          ) : null}
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>

                      {submission.photos.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {submission.photos.map((photo) =>
                            photo.signed_url ? (
                              <a key={photo.id} href={photo.signed_url} target="_blank" rel="noopener noreferrer">
                                <Image
                                  src={photo.signed_url}
                                  alt={`${submission.title_snapshot} evidence`}
                                  width={64}
                                  height={64}
                                  unoptimized
                                  className="h-16 w-16 rounded-lg border border-neutral-200 object-cover transition hover:opacity-80"
                                />
                              </a>
                            ) : null,
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-neutral-400">No photos submitted.</p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {submission.status === 'submitted' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={sopBusyId !== null}
                            onClick={() => void submitSopAction(submission.id, 'approve')}
                          >
                            {sopBusyId === submission.id ? 'Working…' : 'Approve'}
                          </Button>
                        ) : null}
                        {submission.status === 'submitted' || submission.status === 'approved' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={sopBusyId !== null}
                            onClick={() => {
                              setSopAction({ submissionId: submission.id, action: 'reject' });
                              setSopActionInput('');
                            }}
                          >
                            Reject
                          </Button>
                        ) : null}
                        {submission.status !== 'waived' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={sopBusyId !== null}
                            onClick={() => {
                              setSopAction({ submissionId: submission.id, action: 'waive' });
                              setSopActionInput('');
                            }}
                          >
                            Waive
                          </Button>
                        ) : null}
                      </div>

                      {sopAction?.submissionId === submission.id ? (
                        <div className="mt-2 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                          <p className="text-[11px] font-semibold text-neutral-600">
                            {sopAction.action === 'reject'
                              ? 'Rejection note (required — the provider sees it and can resubmit):'
                              : 'Waive reason (required for the audit trail):'}
                          </p>
                          <textarea
                            value={sopActionInput}
                            onChange={(event) => setSopActionInput(event.target.value)}
                            maxLength={2000}
                            className="input-field min-h-[56px] w-full resize-y text-xs"
                          />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setSopAction(null)}>
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant={sopAction.action === 'reject' ? 'danger' : 'primary'}
                              disabled={sopBusyId !== null || sopActionInput.trim().length < 3}
                              onClick={() => {
                                if (sopAction.action === 'reject') {
                                  void submitSopAction(submission.id, 'reject', { note: sopActionInput.trim() });
                                } else {
                                  void submitSopAction(submission.id, 'waive', { reason: sopActionInput.trim() });
                                }
                              }}
                            >
                              {sopBusyId === submission.id
                                ? 'Working…'
                                : sopAction.action === 'reject'
                                  ? 'Reject SOP'
                                  : 'Waive SOP'}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-3 rounded-lg border border-[#ecd8c7] bg-[#fffaf4] px-3 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a6549]">Price Breakup</p>
              <div className="mt-1 space-y-1 text-[11px] text-[#6f4b32] sm:text-xs">
                {serviceSubtotalInr > 0 ? (
                  <div className="flex items-center justify-between">
                    <span>Service Subtotal</span>
                    <span>{fmt(serviceSubtotalInr)}</span>
                  </div>
                ) : null}
                {addonSubtotalInr > 0 ? (
                  <div className="flex items-center justify-between">
                    <span>Add-on Subtotal</span>
                    <span>{fmt(addonSubtotalInr)}</span>
                  </div>
                ) : null}
                {reconciliationAdjustmentInr !== 0 ? (
                  <div className="flex items-center justify-between">
                    <span>Price Adjustment</span>
                    <span>
                      {reconciliationAdjustmentInr > 0 ? '+ ' : '- '}
                      {fmt(Math.abs(reconciliationAdjustmentInr))}
                    </span>
                  </div>
                ) : null}
                {grossSubtotalInr > 0 ? (
                  <div className="flex items-center justify-between">
                    <span>Gross Subtotal</span>
                    <span>{fmt(grossSubtotalInr)}</span>
                  </div>
                ) : null}
                {discountInr > 0 ? (
                  <div className="flex items-center justify-between">
                    <span>Discount Applied{booking.discount_code ? ` (${booking.discount_code})` : ''}</span>
                    <span>- {fmt(discountInr)}</span>
                  </div>
                ) : null}
                {walletApplied > 0 ? (
                  <div className="flex items-center justify-between">
                    <span>Dofurs Credits Applied</span>
                    <span>- {fmt(walletApplied)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-[#e7c4a7]/70 pt-1 font-semibold text-[#5d3e2b]">
                  <span>Final Amount</span>
                  <span>{fmt(finalAmountInr)}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-[#5d3e2b]">
                  <span>Pending Payable</span>
                  <span>{fmt(pendingPayable)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a6549]">Included Services</p>
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
                  <p className="mt-1 text-[11px] text-[#7c5b43] sm:text-xs">No bundled service lines found.</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a6549]">Add-on Summary</p>
                {activeAddonItems.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {activeAddonItems.map((item, index) => {
                      const totalPriceInr = Math.max(0, Number(item.total_price_inr ?? item.total_price_snapshot ?? 0));
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
                          {unitPriceInr != null ? ` (${fmt(unitPriceInr)} each)` : ''} • {fmt(totalPriceInr)}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1 text-[11px] text-[#7c5b43] sm:text-xs">No active add-ons selected.</p>
                )}
                {allAddonItems.length > activeAddonItems.length ? (
                  <p className="mt-1 text-[10px] text-[#8a6549] sm:text-[11px]">
                    Only active add-ons are included in totals.
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a6549]">Payment Snapshot</p>
              <div className="mt-1 space-y-1 text-[11px] text-[#6f4b32] sm:text-xs">
                <div className="flex items-center justify-between">
                  <span>Payment Mode</span>
                  <span className="capitalize">{formatPaymentModeLabel(booking.payment_mode)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Discount Code</span>
                  <span>{booking.discount_code ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Paid / Collected</span>
                  <span>{fmt(paidOrCollectedInr)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#e7c4a7]/70 pt-1 font-semibold text-[#5d3e2b]">
                  <span>Amount to Collect</span>
                  <span>{fmt(pendingPayable)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoices */}
          {invoices.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Invoices</p>
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
                  <span className="text-sm font-mono text-neutral-700">{inv.invoice_number}</span>
                  <span className="text-xs text-neutral-500 capitalize">{inv.status}</span>
                  <div className="flex items-center gap-2">
                    {(inv.wallet_credits_applied_inr ?? 0) > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        −{fmt(inv.wallet_credits_applied_inr)} credits
                      </span>
                    )}
                    <span className="text-sm font-semibold">{fmt(inv.total_inr)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Status history */}
          {(booking.booking_status_transition_events?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status History</p>
              <div className="space-y-1">
                {[...booking.booking_status_transition_events!].sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()).map((ev, i) => (
                  <div key={i} className="text-xs text-neutral-600 flex gap-2">
                    <span className="text-neutral-400 shrink-0">{fmtDt(ev.changed_at)}</span>
                    <span className="capitalize">{ev.old_status?.replace('_', ' ') ?? '—'} → {ev.new_status.replace('_', ' ')}</span>
                    {ev.source ? <span className="text-neutral-400">via {ev.source}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Internal notes */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Internal Notes</p>

            <div className="space-y-2">
              <textarea
                className="input-field w-full resize-y min-h-[80px] text-sm"
                placeholder="Add an internal note visible only to admins…"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                maxLength={4000}
              />
              {noteError ? <Alert variant="error" className="!py-1 !text-xs">{noteError}</Alert> : null}
              <Button size="sm" onClick={handleSaveNote} disabled={!noteInput.trim() || isSavingNote}>
                Save Note
              </Button>
            </div>

            {notes.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg bg-neutral-50 p-3">
                    <p className="text-sm text-neutral-800">{n.note}</p>
                    <p className="text-xs text-neutral-400 mt-1">{fmtDt(n.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400">No notes yet.</p>
            )}
          </div>

          {/* Customer feedback (provider/admin) */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Customer Feedback</p>

            {status === 'completed' ? (
              <div className="space-y-2 rounded-xl border border-neutral-200 p-3">
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCustomerRatingInput(value)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        customerRatingInput === value
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-neutral-200 bg-white text-neutral-500'
                      }`}
                    >
                      {value}★
                    </button>
                  ))}
                </div>
                <textarea
                  className="input-field w-full resize-y min-h-[80px] text-sm"
                  placeholder="Add internal service notes about customer behavior/coordination (optional)..."
                  value={customerFeedbackInput}
                  onChange={(event) => setCustomerFeedbackInput(event.target.value)}
                  maxLength={4000}
                />
                {customerFeedbackError ? (
                  <Alert variant="error" className="!py-1 !text-xs">{customerFeedbackError}</Alert>
                ) : null}
                <Button size="sm" onClick={handleSaveCustomerFeedback} disabled={isSavingNote}>
                  Save Customer Feedback
                </Button>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">Available after booking is completed.</p>
            )}

            {customerFeedback.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {customerFeedback.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-900">
                        {entry.created_by_role === 'provider' ? 'Provider' : entry.created_by_role === 'staff' ? 'Staff' : 'Admin'} • {entry.rating}★
                      </p>
                      <p className="text-xs text-neutral-400">{fmtDt(entry.created_at)}</p>
                    </div>
                    <p className="mt-1 text-sm text-neutral-700">{entry.notes ?? 'No notes provided.'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400">No customer feedback yet.</p>
            )}
          </div>

          {/* Admin actions */}
          {bookingId != null ? (
            <>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsAddonManagementOpen((open) => !open)}
                >
                  {isAddonManagementOpen ? 'Hide Add-on Management' : 'Add-on Management'}
                </Button>
                {(status === 'pending' || status === 'confirmed') ? (
                  <Link href={`/forms/customer-booking?reschedule=${bookingId}`}>
                    <Button type="button" size="sm" variant="premium">
                      Reschedule
                    </Button>
                  </Link>
                ) : null}
              </div>

              {isAddonManagementOpen ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <BookingAddonManager
                    bookingId={bookingId}
                    source="admin_adjustment"
                    title="Add-on Management"
                    onItemsChange={setAddonItems}
                    onUpdated={handleAddonManagerUpdated}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
