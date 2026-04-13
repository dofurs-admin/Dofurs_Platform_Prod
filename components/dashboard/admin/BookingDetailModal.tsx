'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import { Button, Alert } from '@/components/ui';

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
  address: string | null;
  pincode: string | null;
  notes: string | null;
  subtotal_inr: number | null;
  discount_inr: number | null;
  total_inr: number | null;
  final_price: number | null;
  price_at_booking: number | null;
  wallet_credits_applied_inr: number | null;
  discount_code: string | null;
  created_at: string;
  users: { name: string | null; email: string | null; phone: string | null; address: string | null } | null;
  providers: { name: string | null; email: string | null; phone_number: string | null } | null;
  pets: Array<{ id: string; name: string; breed: string | null; age: number | null; gender: string | null; size_category: string | null }> | null;
  booking_status_transition_events: StatusEvent[] | null;
};

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

function fmt(v: number | null | undefined) { return v != null ? CURRENCY_FORMATTER.format(v) : '—'; }
function fmtDt(v: string) { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : DATE_TIME_FORMATTER.format(d); }

type Props = {
  bookingId: number | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function BookingDetailModal({ bookingId, isOpen, onClose }: Props) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [invoices, setInvoices] = useState<BookingInvoice[]>([]);
  const [notes, setNotes] = useState<BookingNote[]>([]);
  const [customerFeedback, setCustomerFeedback] = useState<CustomerFeedbackEntry[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [customerRatingInput, setCustomerRatingInput] = useState<number>(5);
  const [customerFeedbackInput, setCustomerFeedbackInput] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [customerFeedbackError, setCustomerFeedbackError] = useState<string | null>(null);
  const [isLoading, startLoad] = useTransition();
  const [isSavingNote, startSave] = useTransition();

  useEffect(() => {
    if (!isOpen || bookingId == null) return;
    setBooking(null);
    setNotes([]);
    setCustomerFeedback([]);
    setInvoices([]);
    setLoadError(null);
    setCustomerFeedbackError(null);
    setCustomerFeedbackInput('');
    setCustomerRatingInput(5);

    startLoad(async () => {
      try {
        const [detailRes, notesRes, customerFeedbackRes] = await Promise.all([
          fetch(`/api/admin/bookings/${bookingId}`, { cache: 'no-store' }),
          fetch(`/api/admin/bookings/${bookingId}/notes`, { cache: 'no-store' }),
          fetch(`/api/admin/bookings/${bookingId}/customer-feedback`, { cache: 'no-store' }),
        ]);

        if (!detailRes.ok) {
          const payload = (await detailRes.json().catch(() => null)) as { error?: string } | null;
          if (detailRes.status === 401 || detailRes.status === 403) {
            setLoadError('Your session expired or you do not have access to this booking.');
            return;
          }
          setLoadError(payload?.error ?? 'Failed to load booking details.');
          return;
        }

        const detail = await detailRes.json();
        setBooking(detail.booking ?? null);
        setInvoices(detail.invoices ?? []);

        if (notesRes.ok) {
          const notesData = await notesRes.json();
          setNotes(notesData.notes ?? []);
        }

        if (customerFeedbackRes.ok) {
          const feedbackData = await customerFeedbackRes.json();
          setCustomerFeedback(feedbackData.feedback ?? []);
        }
      } catch {
        setLoadError('Failed to load booking details. Please try again.');
      }
    });
  }, [bookingId, isOpen]);

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

  const status = booking?.booking_status ?? booking?.status ?? '';
  const servicePrice = booking ? Number(booking.subtotal_inr ?? booking.price_at_booking ?? booking.total_inr ?? booking.final_price ?? 0) : 0;
  const storedDiscount = booking ? Number(booking.discount_inr ?? 0) : 0;
  const payableBeforeWallet = booking
    ? Number(booking.final_price ?? booking.total_inr ?? Math.max(servicePrice - storedDiscount, 0))
    : 0;
  const effectiveDiscount = Math.max(storedDiscount, Math.max(servicePrice - payableBeforeWallet, 0));
  const walletApplied = booking ? Number(booking.wallet_credits_applied_inr ?? 0) : 0;
  const netPayable = Math.max(0, servicePrice - effectiveDiscount - walletApplied);

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
              {booking.service_type ? ` • ${booking.service_type}` : ''}
              {booking.booking_mode ? ` • ${booking.booking_mode.replace('_', ' ')}` : ''}
            </p>
            {booking.booking_date && booking.start_time ? (
              <p className="text-sm text-neutral-600">{booking.booking_date} • {booking.start_time}{booking.end_time ? ` – ${booking.end_time}` : ''}</p>
            ) : (
              <p className="text-sm text-neutral-600">{fmtDt(booking.booking_start)}</p>
            )}
            {booking.address ? <p className="text-xs text-neutral-500">{booking.address}{booking.pincode ? `, ${booking.pincode}` : ''}</p> : null}
            {booking.notes ? <p className="text-xs text-neutral-500 italic">Customer note: {booking.notes}</p> : null}
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

          {/* Pricing */}
          <div className="rounded-xl border border-neutral-200 p-4">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Pricing</p>
            <div className="space-y-1 text-sm">
              {(booking.subtotal_inr ?? booking.price_at_booking) != null ? (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Service Price</span>
                  <span>{fmt(servicePrice)}</span>
                </div>
              ) : null}
              {effectiveDiscount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Discount {booking.discount_code ? `(${booking.discount_code})` : ''}</span>
                  <span className="text-green-600">−{fmt(effectiveDiscount)}</span>
                </div>
              ) : null}
              {(booking.wallet_credits_applied_inr ?? 0) > 0 ? (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Dofurs Credits Applied</span>
                  <span className="text-green-600">−{fmt(booking.wallet_credits_applied_inr)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-neutral-100 pt-1 font-semibold">
                <span>Net Payable</span>
                <span>{fmt(netPayable)}</span>
              </div>
            </div>
          </div>

          {/* Payment information */}
          <div className="rounded-xl border border-neutral-200 p-4">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Payment Information</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Payment Mode</span>
                <span className="capitalize">{booking.payment_mode ? booking.payment_mode.replace(/_/g, ' ') : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Discount Code</span>
                <span>{booking.discount_code ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Wallet Credits Applied</span>
                <span>{fmt(walletApplied)}</span>
              </div>
              <div className="flex justify-between border-t border-neutral-100 pt-1 font-semibold">
                <span>Amount to Collect</span>
                <span>{fmt(netPayable)}</span>
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
          {(status === 'pending' || status === 'confirmed') && (
            <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
              <Link href={`/forms/customer-booking?reschedule=${bookingId}`}>
                <Button type="button" size="sm" variant="premium">
                  Reschedule
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
