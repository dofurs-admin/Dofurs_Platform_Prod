'use client';

import { Modal, ModalFooter, Input, Button, Badge } from '@/components/ui';
import type { ProviderDashboard } from '@/lib/provider-management/types';
import {
  WEEK_DAYS,
  PREMIUM_MODAL_FOOTER_CLASS,
} from './providerTypes';
import { formatProviderDate, formatProviderTime } from './providerFormatters';
import type {
  ProfileFormState,
  DetailsFormState,
  NewBlockedDateState,
  NewAvailabilityState,
  AvailabilityDraftState,
  DocumentDraftState,
  ProviderBooking,
  ProviderBlockedDate,
} from './providerTypes';
import type { ProviderReview } from '@/lib/provider-management/types';

type Props = {
  dashboard: ProviderDashboard;
  isPending: boolean;

  // Bio modal
  isEditingProfileBio: boolean;
  onCloseProfileBio: () => void;
  profileForm: ProfileFormState;
  onProfileBioChange: (value: string) => void;
  onSaveProfile: () => void;

  // Details modal
  isEditingDetails: boolean;
  onCloseDetails: () => void;
  detailsForm: DetailsFormState;
  onDetailsFormChange: (patch: Partial<DetailsFormState>) => void;
  onSaveDetails: () => void;

  // Blocked dates modal
  isManagingBlockedDates: boolean;
  onCloseBlockedDates: () => void;
  blockedDates: ProviderBlockedDate[];
  newBlockedDate: NewBlockedDateState;
  onNewBlockedDateChange: (patch: Partial<NewBlockedDateState>) => void;
  onAddBlockedDate: () => void;
  onRemoveBlockedDate: (id: string) => void;

  // Availability modal
  isManagingAvailability: boolean;
  onCloseAvailability: () => void;
  newAvailability: NewAvailabilityState;
  onNewAvailabilityChange: (patch: Partial<NewAvailabilityState>) => void;
  onAddAvailability: () => void;
  availabilityDraft: AvailabilityDraftState;
  onAvailabilityDraftChange: (slotId: string, patch: Partial<NewAvailabilityState>) => void;
  onSaveAvailabilitySlot: (slotId: string) => void;
  onDeleteAvailability: (slotId: string) => void;

  // Documents modal
  isManagingDocuments: boolean;
  onCloseDocuments: () => void;
  newDocument: { document_type: string; document_url: string };
  onNewDocumentChange: (patch: Partial<{ document_type: string; document_url: string }>) => void;
  onUploadDocument: () => void;
  documentDraft: DocumentDraftState;
  onDocumentDraftChange: (docId: string, patch: Partial<{ document_type: string; document_url: string }>) => void;
  onSaveDocument: (docId: string) => void;
  onRemoveDocument: (docId: string) => void;

  // Review modal
  activeReview: ProviderReview | null;
  onCloseReviewEditor: () => void;
  reviewResponses: Record<string, string>;
  onReviewResponseChange: (reviewId: string, value: string) => void;
  onRespondToReview: (reviewId: string) => void;

  // Completion modal
  activeCompletionBooking: ProviderBooking | null;
  onCloseCompletionEditor: () => void;
  completionFeedbackDraft: Record<number, string>;
  onCompletionFeedbackChange: (bookingId: number, value: string) => void;
  onCompleteBookingWithFeedback: (bookingId: number, feedback: string) => void;

  // Customer feedback modal
  activeCustomerFeedbackBooking: ProviderBooking | null;
  onCloseCustomerFeedbackEditor: () => void;
  customerFeedbackDraft: Record<number, { rating: number; notes: string }>;
  onCustomerFeedbackChange: (
    bookingId: number,
    patch: Partial<{ rating: number; notes: string }>,
  ) => void;
  onSaveCustomerFeedback: (bookingId: number) => void;
};

export default function ProviderModals({
  dashboard,
  isPending,
  isEditingProfileBio,
  onCloseProfileBio,
  profileForm,
  onProfileBioChange,
  onSaveProfile,
  isEditingDetails,
  onCloseDetails,
  detailsForm,
  onDetailsFormChange,
  onSaveDetails,
  isManagingBlockedDates,
  onCloseBlockedDates,
  blockedDates,
  newBlockedDate,
  onNewBlockedDateChange,
  onAddBlockedDate,
  onRemoveBlockedDate,
  isManagingAvailability,
  onCloseAvailability,
  newAvailability,
  onNewAvailabilityChange,
  onAddAvailability,
  availabilityDraft,
  onAvailabilityDraftChange,
  onSaveAvailabilitySlot,
  onDeleteAvailability,
  isManagingDocuments,
  onCloseDocuments,
  newDocument,
  onNewDocumentChange,
  onUploadDocument,
  documentDraft,
  onDocumentDraftChange,
  onSaveDocument,
  onRemoveDocument,
  activeReview,
  onCloseReviewEditor,
  reviewResponses,
  onReviewResponseChange,
  onRespondToReview,
  activeCompletionBooking,
  onCloseCompletionEditor,
  completionFeedbackDraft,
  onCompletionFeedbackChange,
  onCompleteBookingWithFeedback,
  activeCustomerFeedbackBooking,
  onCloseCustomerFeedbackEditor,
  customerFeedbackDraft,
  onCustomerFeedbackChange,
  onSaveCustomerFeedback,
}: Props) {
  return (
    <>
      {/* Edit Bio Modal */}
      <Modal
        isOpen={isEditingProfileBio}
        onClose={onCloseProfileBio}
        title="Edit Provider Bio"
        description="Craft a concise, trust-building bio that helps pet parents choose you confidently."
        size="lg"
      >
        <div className="space-y-4 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Provider Story
          </p>
          <Input
            label="Bio"
            value={profileForm.bio}
            onChange={(event) => onProfileBioChange(event.target.value)}
            placeholder="Write a brief bio about yourself"
          />
        </div>
        <ModalFooter className={PREMIUM_MODAL_FOOTER_CLASS}>
          <Button onClick={onSaveProfile} disabled={isPending}>
            Submit
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Professional Details Modal */}
      <Modal
        isOpen={isEditingDetails}
        onClose={onCloseDetails}
        title="Edit Professional Details"
        description="Update professional and clinic information in one focused workspace."
        size="xl"
      >
        <div className="space-y-5 pb-2">
          <div className="space-y-3 rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
              Credentials
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="License Number"
                value={detailsForm.license_number}
                onChange={(event) => onDetailsFormChange({ license_number: event.target.value })}
                placeholder="License number"
              />
              <Input
                label="Specialization"
                value={detailsForm.specialization}
                onChange={(event) => onDetailsFormChange({ specialization: event.target.value })}
                placeholder="Specialization"
              />
              <Input
                label="Clinic Registration"
                value={detailsForm.registration_number}
                onChange={(event) =>
                  onDetailsFormChange({ registration_number: event.target.value })
                }
                placeholder="Registration number"
              />
              <Input
                label="City"
                value={detailsForm.city}
                onChange={(event) => onDetailsFormChange({ city: event.target.value })}
                placeholder="City"
              />
              <Input
                label="State"
                value={detailsForm.state}
                onChange={(event) => onDetailsFormChange({ state: event.target.value })}
                placeholder="State"
              />
              <Input
                label="Number of Doctors"
                type="number"
                min={0}
                value={detailsForm.number_of_doctors}
                onChange={(event) =>
                  onDetailsFormChange({ number_of_doctors: event.target.value })
                }
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
              Operational Settings
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={detailsForm.teleconsult_enabled}
                onChange={(event) =>
                  onDetailsFormChange({ teleconsult_enabled: event.target.checked })
                }
                className="w-4 h-4 rounded border-neutral-300"
              />
              <span className="text-body">Teleconsult enabled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={detailsForm.hospitalization_available}
                onChange={(event) =>
                  onDetailsFormChange({ hospitalization_available: event.target.checked })
                }
                className="w-4 h-4 rounded border-neutral-300"
              />
              <span className="text-body">Hospitalization available</span>
            </label>
          </div>
        </div>
        <ModalFooter className={PREMIUM_MODAL_FOOTER_CLASS}>
          <Button onClick={onSaveDetails} disabled={isPending}>
            Submit
          </Button>
        </ModalFooter>
      </Modal>

      {/* Blocked Dates Modal */}
      <Modal
        isOpen={isManagingBlockedDates}
        onClose={onCloseBlockedDates}
        title="Manage Blocked Dates &amp; Time"
        description="Block an entire day or a specific time window to prevent bookings."
        size="lg"
      >
        <div className="space-y-5 pb-2">
          <div className="space-y-3 rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
              Add Block
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                type="date"
                value={newBlockedDate.blockedDate}
                onChange={(event) => onNewBlockedDateChange({ blockedDate: event.target.value })}
                label="Date"
              />
              <Input
                type="time"
                value={newBlockedDate.blockStartTime}
                onChange={(event) =>
                  onNewBlockedDateChange({ blockStartTime: event.target.value })
                }
                label="Start time (optional)"
              />
              <Input
                type="time"
                value={newBlockedDate.blockEndTime}
                onChange={(event) => onNewBlockedDateChange({ blockEndTime: event.target.value })}
                label="End time (optional)"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Input
                value={newBlockedDate.reason}
                onChange={(event) => onNewBlockedDateChange({ reason: event.target.value })}
                placeholder="Reason (optional)"
                label="Reason"
              />
              <div className="sm:self-end">
                <Button
                  onClick={onAddBlockedDate}
                  disabled={isPending}
                  className="h-[46px] w-full px-5 sm:w-auto"
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>

          {blockedDates.length === 0 ? (
            <p className="text-body text-neutral-500 text-center py-6">No blocked dates set</p>
          ) : (
            <div className="space-y-3 rounded-xl border border-neutral-200/70 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                Existing Blocks
              </p>
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveBlockedDate(item.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Availability Modal */}
      <Modal
        isOpen={isManagingAvailability}
        onClose={onCloseAvailability}
        title="Manage Availability"
        description="Set your working windows and fine-tune each slot from one premium control panel."
        size="xl"
      >
        <div className="space-y-5 pb-2">
          <div className="space-y-3 rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Add New Slot
            </p>
            <div className="grid gap-4 sm:grid-cols-4 sm:items-end">
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Day</label>
                <select
                  value={newAvailability.day_of_week}
                  onChange={(event) =>
                    onNewAvailabilityChange({ day_of_week: Number(event.target.value) })
                  }
                  className="h-[46px] w-full input-field"
                >
                  {WEEK_DAYS.map((day) => (
                    <option key={day.day} value={day.day}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Start Time"
                type="time"
                value={newAvailability.start_time}
                onChange={(event) => onNewAvailabilityChange({ start_time: event.target.value })}
                className="h-[46px]"
              />
              <Input
                label="End Time"
                type="time"
                value={newAvailability.end_time}
                onChange={(event) => onNewAvailabilityChange({ end_time: event.target.value })}
                className="h-[46px]"
              />
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-700">Status</p>
                <label className="flex h-[46px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAvailability.is_available}
                    onChange={(event) =>
                      onNewAvailabilityChange({ is_available: event.target.checked })
                    }
                    className="w-4 h-4 rounded border-neutral-300"
                  />
                  <span className="text-sm font-medium text-neutral-700">Available</span>
                </label>
              </div>
            </div>
            <Button
              onClick={onAddAvailability}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              Submit
            </Button>
          </div>

          <div className="space-y-3 rounded-xl border border-neutral-200/70 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
              Existing Slots
            </p>
            {dashboard.availability.map((slot) => {
              const draft = availabilityDraft[slot.id];
              const currentDayOfWeek = draft?.day_of_week ?? slot.day_of_week;
              const currentStartTime = draft?.start_time ?? slot.start_time;
              const currentEndTime = draft?.end_time ?? slot.end_time;
              const currentIsAvailable = draft?.is_available ?? slot.is_available;

              return (
                <div key={slot.id} className="border border-neutral-200/60 rounded-xl p-4">
                  <div className="mb-3 grid gap-2 sm:grid-cols-4 sm:items-end">
                    <div>
                      <label className="text-xs font-medium text-neutral-600 block mb-1">Day</label>
                      <select
                        value={currentDayOfWeek}
                        onChange={(event) =>
                          onAvailabilityDraftChange(slot.id, {
                            day_of_week: Number(event.target.value),
                          })
                        }
                        className="input-field h-[42px] w-full text-sm"
                      >
                        {WEEK_DAYS.map((day) => (
                          <option key={day.day} value={day.day}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      type="time"
                      value={currentStartTime}
                      onChange={(event) =>
                        onAvailabilityDraftChange(slot.id, { start_time: event.target.value })
                      }
                      label="Start"
                      className="h-[42px]"
                    />
                    <Input
                      type="time"
                      value={currentEndTime}
                      onChange={(event) =>
                        onAvailabilityDraftChange(slot.id, { end_time: event.target.value })
                      }
                      label="End"
                      className="h-[42px]"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-neutral-600">Status</p>
                      <label className="flex h-[42px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentIsAvailable}
                          onChange={(event) =>
                            onAvailabilityDraftChange(slot.id, {
                              is_available: event.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-neutral-300"
                        />
                        <span className="text-sm font-medium text-neutral-700">Available</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-neutral-200/60">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onSaveAvailabilitySlot(slot.id)}
                    >
                      Submit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => onDeleteAvailability(slot.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Documents Modal */}
      <Modal
        isOpen={isManagingDocuments}
        onClose={onCloseDocuments}
        title="Manage Documents"
        description="Add, update, and clean verification documents from a focused popup workspace."
        size="xl"
      >
        <div className="space-y-5 pb-2">
          <div className="space-y-3 rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
              Upload New Document
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Document Type"
                value={newDocument.document_type}
                onChange={(event) => onNewDocumentChange({ document_type: event.target.value })}
                placeholder="License, Insurance, Certification, etc."
                className="h-[46px]"
              />
              <Input
                label="Document URL"
                value={newDocument.document_url}
                onChange={(event) => onNewDocumentChange({ document_url: event.target.value })}
                placeholder="https://example.com/document.pdf"
                className="h-[46px]"
              />
            </div>
            <Button
              onClick={onUploadDocument}
              disabled={isPending}
              className="h-[46px] w-full sm:w-auto"
            >
              Submit
            </Button>
          </div>

          {dashboard.documents.length === 0 ? (
            <p className="text-body text-neutral-500 text-center py-6">No documents uploaded</p>
          ) : (
            <div className="space-y-3 rounded-xl border border-neutral-200/70 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                Existing Documents
              </p>
              {dashboard.documents.map((doc) => {
                const draft = documentDraft[doc.id];
                const currentType = draft?.document_type ?? doc.document_type ?? '';
                const currentUrl = draft?.document_url ?? doc.document_url ?? '';

                return (
                  <div key={doc.id} className="rounded-xl border border-neutral-200/60 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 mb-3">
                      <Input
                        label="Type"
                        value={currentType}
                        onChange={(event) =>
                          onDocumentDraftChange(doc.id, { document_type: event.target.value })
                        }
                        className="h-[42px]"
                      />
                      <Input
                        label="URL"
                        value={currentUrl}
                        onChange={(event) =>
                          onDocumentDraftChange(doc.id, { document_url: event.target.value })
                        }
                        className="h-[42px]"
                      />
                    </div>
                    <div className="flex flex-col gap-2 border-t border-neutral-200/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <Badge
                        variant={
                          doc.verification_status === 'approved'
                            ? 'success'
                            : doc.verification_status === 'rejected'
                              ? 'error'
                              : 'warning'
                        }
                      >
                        {`Verification: ${doc.verification_status}`}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSaveDocument(doc.id)}
                        >
                          Submit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => onRemoveDocument(doc.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Respond to Review Modal */}
      <Modal
        isOpen={activeReview !== null}
        onClose={onCloseReviewEditor}
        title="Respond To Review"
        description="Share a calm, professional response to strengthen provider trust."
        size="lg"
      >
        {activeReview ? (
          <>
            <div className="space-y-4 pb-2">
              <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Customer Feedback
                </p>
                <p className="mt-2 text-sm text-neutral-700">
                  {activeReview.review_text ?? 'No written feedback'}
                </p>
              </div>
              <Input
                label="Your Response"
                value={reviewResponses[activeReview.id] ?? ''}
                onChange={(event) =>
                  onReviewResponseChange(activeReview.id, event.target.value)
                }
                placeholder="Write your response..."
              />
            </div>
            <ModalFooter className={PREMIUM_MODAL_FOOTER_CLASS}>
              <Button onClick={() => onRespondToReview(activeReview.id)}>Submit</Button>
            </ModalFooter>
          </>
        ) : null}
      </Modal>

      {/* Complete Booking Modal */}
      <Modal
        isOpen={activeCompletionBooking !== null}
        onClose={onCloseCompletionEditor}
        title="Complete Booking"
        description="Add visit notes and complete the booking with a premium quality closure."
        size="lg"
      >
        {activeCompletionBooking ? (
          <>
            <div className="space-y-4 pb-2">
              <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Booking
                </p>
                <p className="mt-2 text-sm font-medium text-neutral-900">
                  #{activeCompletionBooking.id}
                </p>
                <p className="text-sm text-neutral-600">
                  {activeCompletionBooking.booking_date} • {activeCompletionBooking.start_time} -{' '}
                  {activeCompletionBooking.end_time}
                </p>
              </div>
              <Input
                label="Completion Feedback"
                value={completionFeedbackDraft[activeCompletionBooking.id] ?? ''}
                onChange={(event) =>
                  onCompletionFeedbackChange(activeCompletionBooking.id, event.target.value)
                }
                placeholder="Add post-visit feedback before completion"
              />
            </div>
            <ModalFooter className={PREMIUM_MODAL_FOOTER_CLASS}>
              <Button
                variant="success"
                onClick={() => {
                  const feedback = completionFeedbackDraft[activeCompletionBooking.id] ?? '';
                  onCompleteBookingWithFeedback(activeCompletionBooking.id, feedback);
                }}
                disabled={!(completionFeedbackDraft[activeCompletionBooking.id] ?? '').trim()}
              >
                Submit
              </Button>
            </ModalFooter>
          </>
        ) : null}
      </Modal>

      {/* Customer Feedback Modal */}
      <Modal
        isOpen={activeCustomerFeedbackBooking !== null}
        onClose={onCloseCustomerFeedbackEditor}
        title="Rate Customer"
        description="Capture service quality notes for customer handling and operational trust signals."
        size="lg"
      >
        {activeCustomerFeedbackBooking ? (
          <>
            <div className="space-y-4 pb-2">
              <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Booking
                </p>
                <p className="mt-2 text-sm font-medium text-neutral-900">
                  #{activeCustomerFeedbackBooking.id}
                </p>
                <p className="text-sm text-neutral-600">
                  {activeCustomerFeedbackBooking.booking_date} • {activeCustomerFeedbackBooking.start_time} -{' '}
                  {activeCustomerFeedbackBooking.end_time}
                </p>
                {activeCustomerFeedbackBooking.owner_full_name ? (
                  <p className="mt-1 text-sm text-neutral-700">
                    Customer: {activeCustomerFeedbackBooking.owner_full_name}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-700">Customer Rating</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const current = customerFeedbackDraft[activeCustomerFeedbackBooking.id]?.rating ?? 5;
                    const selected = current === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          onCustomerFeedbackChange(activeCustomerFeedbackBooking.id, {
                            rating: value,
                          })
                        }
                        className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                          selected
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-neutral-200 bg-white text-neutral-500'
                        }`}
                      >
                        {value}★
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input
                label="Notes"
                value={customerFeedbackDraft[activeCustomerFeedbackBooking.id]?.notes ?? ''}
                onChange={(event) =>
                  onCustomerFeedbackChange(activeCustomerFeedbackBooking.id, {
                    notes: event.target.value,
                  })
                }
                placeholder="Behavior, punctuality, safety, communication notes (optional)"
              />
            </div>
            <ModalFooter className={PREMIUM_MODAL_FOOTER_CLASS}>
              <Button onClick={() => onSaveCustomerFeedback(activeCustomerFeedbackBooking.id)}>
                Submit
              </Button>
            </ModalFooter>
          </>
        ) : null}
      </Modal>
    </>
  );
}
