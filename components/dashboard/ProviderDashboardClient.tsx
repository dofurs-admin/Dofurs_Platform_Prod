'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import type { ProviderDashboard } from '@/lib/provider-management/types';
import { apiRequest } from '@/lib/api/client';
import {
  useProviderBookingRealtime,
  useProviderApprovalRealtime,
  useOptimisticUpdate,
} from '@/lib/hooks/useRealtime';

// Premium Layout
import DashboardPageLayout from './premium/DashboardPageLayout';
import { Card } from '@/components/ui';

// Provider subcomponents
import ProviderOverviewTab from './provider/ProviderOverviewTab';
import ProviderOperationsTab from './provider/ProviderOperationsTab';
import ProviderProfileTab from './provider/ProviderProfileTab';
import ProviderModals from './provider/ProviderModals';

import type {
  ProviderDashboardView,
  ProviderBooking,
  ProviderBlockedDate,
  ReviewsPageResponse,
  ProfileFormState,
  DetailsFormState,
  NewBlockedDateState,
  NewAvailabilityState,
  AvailabilityDraftState,
  DocumentDraftState,
  PerformanceSummary,
  BookingInsights,
  ResponseHistoryEntry,
} from './provider/providerTypes';

export default function ProviderDashboardClient({
  initialDashboard,
  view = 'overview',
}: {
  initialDashboard: ProviderDashboard | null;
  view?: ProviderDashboardView;
}) {
  const [dashboard, setDashboard] = useState<ProviderDashboard | null>(initialDashboard);
  const [providerBookings, setProviderBookings] = useState<ProviderBooking[]>([]);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const { performUpdate } = useOptimisticUpdate(providerBookings, setProviderBookings);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    bio: initialDashboard?.provider.bio ?? '',
    profile_photo_url: initialDashboard?.provider.profile_photo_url ?? '',
    years_of_experience:
      initialDashboard?.provider.years_of_experience == null
        ? ''
        : String(initialDashboard.provider.years_of_experience),
    phone_number: initialDashboard?.provider.phone_number ?? '',
    email: initialDashboard?.provider.email ?? '',
    service_radius_km:
      initialDashboard?.provider.service_radius_km == null
        ? ''
        : String(initialDashboard.provider.service_radius_km),
  });

  const [detailsForm, setDetailsForm] = useState<DetailsFormState>({
    license_number: initialDashboard?.professionalDetails?.license_number ?? '',
    specialization: initialDashboard?.professionalDetails?.specialization ?? '',
    teleconsult_enabled: initialDashboard?.professionalDetails?.teleconsult_enabled ?? false,
    emergency_service_enabled:
      initialDashboard?.professionalDetails?.emergency_service_enabled ?? false,
    equipment_details: initialDashboard?.professionalDetails?.equipment_details ?? '',
    insurance_document_url: initialDashboard?.professionalDetails?.insurance_document_url ?? '',
    registration_number: initialDashboard?.clinicDetails?.registration_number ?? '',
    gst_number: initialDashboard?.clinicDetails?.gst_number ?? '',
    address: initialDashboard?.clinicDetails?.address ?? '',
    city: initialDashboard?.clinicDetails?.city ?? '',
    state: initialDashboard?.clinicDetails?.state ?? '',
    pincode: initialDashboard?.clinicDetails?.pincode ?? '',
    number_of_doctors:
      initialDashboard?.clinicDetails?.number_of_doctors == null
        ? ''
        : String(initialDashboard.clinicDetails.number_of_doctors),
    hospitalization_available: initialDashboard?.clinicDetails?.hospitalization_available ?? false,
    emergency_services_available:
      initialDashboard?.clinicDetails?.emergency_services_available ?? false,
  });

  const [newAvailability, setNewAvailability] = useState<NewAvailabilityState>({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '18:00',
    is_available: true,
  });
  const [availabilityDraft, setAvailabilityDraft] = useState<AvailabilityDraftState>({});

  const [newDocument, setNewDocument] = useState({ document_type: '', document_url: '' });
  const [documentDraft, setDocumentDraft] = useState<DocumentDraftState>({});

  // ── Modal visibility ─────────────────────────────────────────────────────────
  const [isEditingProfileBio, setIsEditingProfileBio] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isManagingAvailability, setIsManagingAvailability] = useState(false);
  const [isManagingDocuments, setIsManagingDocuments] = useState(false);
  const [isManagingBlockedDates, setIsManagingBlockedDates] = useState(false);
  const [activeReviewEditorId, setActiveReviewEditorId] = useState<string | null>(null);

  // ── Reviews state ────────────────────────────────────────────────────────────
  const [reviewResponses, setReviewResponses] = useState<Record<string, string>>({});
  const [reviewsPage, setReviewsPage] = useState<ReviewsPageResponse>({
    reviews: initialDashboard?.reviews ?? [],
    page: 1,
    pageSize: 10,
    total: initialDashboard?.reviews.length ?? 0,
    hasMore: false,
  });
  const [reviewFilter, setReviewFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [responseHistory, setResponseHistory] = useState<
    Record<string, ResponseHistoryEntry[]>
  >({});

  // ── Bookings & blocked dates state ────────────────────────────────────────────
  const [bookingFilter, setBookingFilter] = useState<
    'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  >('all');
  const [blockedDates, setBlockedDates] = useState<ProviderBlockedDate[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState<NewBlockedDateState>({
    blockedDate: '',
    blockStartTime: '',
    blockEndTime: '',
    reason: '',
  });
  const [completionFeedbackDraft, setCompletionFeedbackDraft] = useState<Record<number, string>>(
    {},
  );
  const [activeCompletionEditorId, setActiveCompletionEditorId] = useState<number | null>(null);

  // ── HTTP helper ───────────────────────────────────────────────────────────────
  const providerRequest = useCallback(
    async <T,>(path: string, init?: RequestInit, retries = 2): Promise<T> => {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          return await apiRequest<T>(path, init);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Request failed');
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
          }
        }
      }
      throw lastError ?? new Error('Request failed');
    },
    [],
  );

  // ── Realtime ──────────────────────────────────────────────────────────────────
  const refreshBookings = useCallback(async () => {
    if (!dashboard?.provider.id) return;
    try {
      const response = await apiRequest<{ bookings: ProviderBooking[] }>('/api/provider/bookings');
      setProviderBookings(response.bookings ?? []);
    } catch (error) {
      console.error('Failed to refresh bookings:', error);
    }
  }, [dashboard?.provider.id]);

  const refreshDashboard = useCallback(async () => {
    try {
      const response = await providerRequest<{ dashboard: ProviderDashboard | null }>(
        '/api/provider/dashboard',
      );
      setDashboard(response.dashboard);
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    }
  }, [providerRequest]);

  useProviderBookingRealtime(dashboard?.provider.id, refreshBookings);
  useProviderApprovalRealtime(dashboard?.provider.id, refreshDashboard);

  // Sync forms when dashboard refreshes
  useEffect(() => {
    if (!dashboard) return;

    setProfileForm({
      bio: dashboard.provider.bio ?? '',
      profile_photo_url: dashboard.provider.profile_photo_url ?? '',
      years_of_experience:
        dashboard.provider.years_of_experience == null
          ? ''
          : String(dashboard.provider.years_of_experience),
      phone_number: dashboard.provider.phone_number ?? '',
      email: dashboard.provider.email ?? '',
      service_radius_km:
        dashboard.provider.service_radius_km == null
          ? ''
          : String(dashboard.provider.service_radius_km),
    });

    setDetailsForm((current) => ({
      ...current,
      license_number: dashboard.professionalDetails?.license_number ?? '',
      specialization: dashboard.professionalDetails?.specialization ?? '',
      teleconsult_enabled: dashboard.professionalDetails?.teleconsult_enabled ?? false,
      emergency_service_enabled:
        dashboard.professionalDetails?.emergency_service_enabled ?? false,
      equipment_details: dashboard.professionalDetails?.equipment_details ?? '',
      insurance_document_url: dashboard.professionalDetails?.insurance_document_url ?? '',
      registration_number: dashboard.clinicDetails?.registration_number ?? '',
      gst_number: dashboard.clinicDetails?.gst_number ?? '',
      address: dashboard.clinicDetails?.address ?? '',
      city: dashboard.clinicDetails?.city ?? '',
      state: dashboard.clinicDetails?.state ?? '',
      pincode: dashboard.clinicDetails?.pincode ?? '',
      number_of_doctors:
        dashboard.clinicDetails?.number_of_doctors == null
          ? ''
          : String(dashboard.clinicDetails.number_of_doctors),
      hospitalization_available: dashboard.clinicDetails?.hospitalization_available ?? false,
      emergency_services_available:
        dashboard.clinicDetails?.emergency_services_available ?? false,
    }));

    const nextAvailabilityDraft: AvailabilityDraftState = {};
    for (const slot of dashboard.availability) {
      nextAvailabilityDraft[slot.id] = {
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_available: slot.is_available,
      };
    }
    setAvailabilityDraft(nextAvailabilityDraft);

    const nextDocumentDraft: DocumentDraftState = {};
    for (const doc of dashboard.documents) {
      nextDocumentDraft[doc.id] = {
        document_type: doc.document_type ?? '',
        document_url: doc.document_url ?? '',
      };
    }
    setDocumentDraft(nextDocumentDraft);
  }, [dashboard]);

  // ── Derived state ─────────────────────────────────────────────────────────────
  const performanceSummary = useMemo((): PerformanceSummary | null => {
    if (!dashboard) return null;
    return {
      avgRating: dashboard.provider.average_rating,
      totalBookings: dashboard.provider.total_bookings,
      cancellationRate: dashboard.provider.cancellation_rate,
      noShowCount: dashboard.provider.no_show_count,
      performanceScore: dashboard.provider.performance_score,
      rankingScore: dashboard.provider.ranking_score,
      accountStatus: dashboard.provider.account_status,
    };
  }, [dashboard]);

  const bookingInsights = useMemo((): BookingInsights => {
    const active = providerBookings.filter(
      (b) => b.booking_status === 'pending' || b.booking_status === 'confirmed',
    );
    const pending = providerBookings.filter((b) => b.booking_status === 'pending');
    const confirmed = providerBookings.filter((b) => b.booking_status === 'confirmed');
    const completed = providerBookings.filter((b) => b.booking_status === 'completed');
    const noShow = providerBookings.filter((b) => b.booking_status === 'no_show');

    const hourBuckets: Record<string, number> = { Morning: 0, Afternoon: 0, Evening: 0 };
    for (const booking of active) {
      const hour = Number(booking.start_time.split(':')[0] ?? '0');
      if (hour < 12) hourBuckets.Morning += 1;
      else if (hour < 17) hourBuckets.Afternoon += 1;
      else hourBuckets.Evening += 1;
    }

    return {
      active: active.length,
      pending: pending.length,
      confirmed: confirmed.length,
      completed: completed.length,
      noShow: noShow.length,
      hourBuckets,
    };
  }, [providerBookings]);

  // bookingInsights is used by providerAlerts below — keep as computed value
  void bookingInsights;

  // ── Data fetchers ─────────────────────────────────────────────────────────────
  const fetchReviews = useCallback(
    async (page: number, filter: 'all' | '1' | '2' | '3' | '4' | '5') => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '10');
      if (filter !== 'all') params.set('rating', filter);
      try {
        const response = await providerRequest<ReviewsPageResponse>(
          `/api/provider/reviews?${params.toString()}`,
        );
        setReviewsPage(response);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to load reviews.', 'error');
      }
    },
    [providerRequest, showToast],
  );

  const fetchProviderBookings = useCallback(
    async (
      filter: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show',
    ) => {
      const params = new URLSearchParams();
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      params.set('fromDate', fromDate);
      params.set('limit', '200');
      if (filter !== 'all') params.set('status', filter);
      try {
        const response = await providerRequest<{ bookings: ProviderBooking[] }>(
          `/api/provider/bookings?${params.toString()}`,
        );
        setProviderBookings(response.bookings);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to load booking queue.',
          'error',
        );
      }
    },
    [providerRequest, showToast],
  );

  const fetchBlockedDates = useCallback(async () => {
    try {
      const response = await providerRequest<{ blockedDates: ProviderBlockedDate[] }>(
        '/api/provider/blocked-dates',
      );
      setBlockedDates(response.blockedDates);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Unable to load blocked dates.',
        'error',
      );
    }
  }, [providerRequest, showToast]);

  useEffect(() => {
    void fetchReviews(1, reviewFilter);
  }, [fetchReviews, reviewFilter]);

  useEffect(() => {
    void fetchProviderBookings(bookingFilter);
  }, [bookingFilter, fetchProviderBookings]);

  useEffect(() => {
    void fetchBlockedDates();
  }, [fetchBlockedDates]);

  // ── Actions ───────────────────────────────────────────────────────────────────
  function setProviderBookingStatus(
    bookingId: number,
    status: 'confirmed' | 'completed' | 'no_show' | 'cancelled',
    providerNotes?: string,
    completionFeedback?: string,
  ) {
    performUpdate(
      (current) =>
        current.map((booking) =>
          booking.id === bookingId
            ? {
                ...booking,
                booking_status: status,
                provider_notes: providerNotes ?? booking.provider_notes,
                completion_task_status:
                  status === 'completed' ? 'completed' : booking.completion_task_status,
                completion_completed_at:
                  status === 'completed'
                    ? new Date().toISOString()
                    : booking.completion_completed_at,
                completion_feedback_text:
                  status === 'completed'
                    ? (completionFeedback ??
                      providerNotes ??
                      booking.completion_feedback_text ??
                      null)
                    : booking.completion_feedback_text,
                requires_completion_feedback:
                  status === 'completed' ? false : booking.requires_completion_feedback,
              }
            : booking,
        ),
      async () => {
        const response = await fetch(`/api/provider/bookings/${bookingId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, providerNotes, completionFeedback }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? 'Failed to update booking status');
        }
      },
      () => {
        if (status === 'completed') setActiveCompletionEditorId(null);
        showToast('Booking updated.', 'success');
      },
      (error) => showToast(error.message || 'Unable to update booking status.', 'error'),
    );
  }

  function markCashCollected(bookingId: number, collectionMode: 'cash' | 'upi' | 'other' = 'cash') {
    performUpdate(
      (current) =>
        current.map((booking) =>
          booking.id === bookingId ? { ...booking, cash_collected: true } : booking,
        ),
      async () => {
        const response = await fetch(`/api/provider/bookings/${bookingId}/collect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionMode }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? 'Failed to record cash collection');
        }
      },
      () => showToast('Cash payment marked as received.', 'success'),
      (error) => showToast(error.message || 'Unable to record cash collection.', 'error'),
    );
  }

  function addBlockedDate() {
    if (!newBlockedDate.blockedDate) {
      showToast('Select a date to block.', 'error');
      return;
    }
    const hasStart = Boolean(newBlockedDate.blockStartTime);
    const hasEnd = Boolean(newBlockedDate.blockEndTime);
    if (hasStart !== hasEnd) {
      showToast('Provide both start and end time, or leave both empty.', 'error');
      return;
    }
    if (hasStart && hasEnd && newBlockedDate.blockEndTime <= newBlockedDate.blockStartTime) {
      showToast('End time must be after start time.', 'error');
      return;
    }
    startTransition(async () => {
      try {
        await providerRequest('/api/provider/blocked-dates', {
          method: 'POST',
          body: JSON.stringify({
            blockedDate: newBlockedDate.blockedDate,
            blockStartTime: newBlockedDate.blockStartTime || undefined,
            blockEndTime: newBlockedDate.blockEndTime || undefined,
            reason: newBlockedDate.reason.trim() || undefined,
          }),
        });
        setNewBlockedDate({ blockedDate: '', blockStartTime: '', blockEndTime: '', reason: '' });
        await fetchBlockedDates();
        showToast('Date blocked successfully.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to block date.', 'error');
      }
    });
  }

  function removeBlockedDate(id: string) {
    startTransition(async () => {
      try {
        await providerRequest(`/api/provider/blocked-dates/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        await fetchBlockedDates();
        showToast('Blocked date removed.', 'success');
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to remove blocked date.',
          'error',
        );
      }
    });
  }

  function saveProfile() {
    if (!dashboard) {
      showToast('Create provider profile first.', 'error');
      return;
    }
    startTransition(async () => {
      try {
        await providerRequest('/api/provider/profile', {
          method: 'PATCH',
          body: JSON.stringify({ bio: profileForm.bio.trim() || null }),
        });
        await refreshDashboard();
        setIsEditingProfileBio(false);
        showToast('Bio updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Profile update failed.', 'error');
      }
    });
  }

  function saveDetails() {
    if (!dashboard) {
      showToast('Create provider profile first.', 'error');
      return;
    }
    const parsedDoctors =
      detailsForm.number_of_doctors.trim() === ''
        ? null
        : Number(detailsForm.number_of_doctors);
    if (parsedDoctors !== null && (!Number.isFinite(parsedDoctors) || parsedDoctors < 0)) {
      showToast('Number of doctors must be a valid non-negative number.', 'error');
      return;
    }
    startTransition(async () => {
      try {
        await providerRequest('/api/provider/details', {
          method: 'PATCH',
          body: JSON.stringify({
            professionalDetails: {
              license_number: detailsForm.license_number.trim() || null,
              specialization: detailsForm.specialization.trim() || null,
              teleconsult_enabled: detailsForm.teleconsult_enabled,
              emergency_service_enabled: detailsForm.emergency_service_enabled,
              equipment_details: detailsForm.equipment_details.trim() || null,
              insurance_document_url: detailsForm.insurance_document_url.trim() || null,
            },
            clinicDetails: {
              registration_number: detailsForm.registration_number.trim() || null,
              gst_number: detailsForm.gst_number.trim() || null,
              address: detailsForm.address.trim() || null,
              city: detailsForm.city.trim() || null,
              state: detailsForm.state.trim() || null,
              pincode: detailsForm.pincode.trim() || null,
              number_of_doctors: parsedDoctors,
              hospitalization_available: detailsForm.hospitalization_available,
              emergency_services_available: detailsForm.emergency_services_available,
            },
          }),
        });
        await refreshDashboard();
        setIsEditingDetails(false);
        showToast('Professional and clinic details updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update details.', 'error');
      }
    });
  }

  function addAvailability() {
    if (!dashboard) {
      showToast('Create provider profile first.', 'error');
      return;
    }
    if (newAvailability.end_time <= newAvailability.start_time) {
      showToast('End time must be after start time.', 'error');
      return;
    }
    const current = dashboard.availability ?? [];
    const candidateKey = `${newAvailability.day_of_week}|${newAvailability.start_time.slice(0, 5)}|${newAvailability.end_time.slice(0, 5)}`;
    const hasDuplicate = current.some(
      (slot) =>
        `${slot.day_of_week}|${slot.start_time.slice(0, 5)}|${slot.end_time.slice(0, 5)}` ===
        candidateKey,
    );
    if (hasDuplicate) {
      showToast('This availability slot already exists.', 'error');
      return;
    }
    startTransition(async () => {
      try {
        await providerRequest('/api/provider/availability', {
          method: 'PUT',
          body: JSON.stringify([
            ...current.map((slot) => ({
              id: slot.id,
              day_of_week: slot.day_of_week,
              start_time: slot.start_time,
              end_time: slot.end_time,
              is_available: slot.is_available,
            })),
            newAvailability,
          ]),
        });
        await refreshDashboard();
        showToast('Availability updated.', 'success');
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to save availability.',
          'error',
        );
      }
    });
  }

  function saveAvailabilitySlot(slotId: string) {
    const slot = availabilityDraft[slotId];
    if (!slot) return;
    if (slot.end_time <= slot.start_time) {
      showToast('End time must be after start time.', 'error');
      return;
    }
    const current = dashboard?.availability ?? [];
    const candidateKey = `${slot.day_of_week}|${slot.start_time.slice(0, 5)}|${slot.end_time.slice(0, 5)}`;
    const hasDuplicate = current.some(
      (currentSlot) =>
        currentSlot.id !== slotId &&
        `${currentSlot.day_of_week}|${currentSlot.start_time.slice(0, 5)}|${currentSlot.end_time.slice(0, 5)}` ===
          candidateKey,
    );
    if (hasDuplicate) {
      showToast('Another slot with this day and timing already exists.', 'error');
      return;
    }
    startTransition(async () => {
      try {
        await providerRequest(`/api/provider/availability/${encodeURIComponent(slotId)}`, {
          method: 'PATCH',
          body: JSON.stringify(slot),
        });
        await refreshDashboard();
        showToast('Availability slot updated.', 'success');
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to update availability slot.',
          'error',
        );
      }
    });
  }

  function deleteAvailability(slotId: string) {
    startTransition(async () => {
      try {
        await providerRequest(
          `/api/provider/availability/${encodeURIComponent(slotId)}`,
          { method: 'DELETE' },
        );
        await refreshDashboard();
        showToast('Availability slot deleted.', 'success');
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to delete availability slot.',
          'error',
        );
      }
    });
  }

  function uploadDocument() {
    if (!dashboard) {
      showToast('Create provider profile first.', 'error');
      return;
    }
    if (!newDocument.document_type.trim() || !newDocument.document_url.trim()) {
      showToast('Document type and URL are required.', 'error');
      return;
    }
    startTransition(async () => {
      try {
        await providerRequest('/api/provider/documents', {
          method: 'POST',
          body: JSON.stringify({
            document_type: newDocument.document_type.trim(),
            document_url: newDocument.document_url.trim(),
          }),
        });
        await refreshDashboard();
        setNewDocument({ document_type: '', document_url: '' });
        showToast('Document uploaded.', 'success');
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to upload document.',
          'error',
        );
      }
    });
  }

  function saveDocument(documentId: string) {
    const doc = documentDraft[documentId];
    if (!doc || !doc.document_type.trim() || !doc.document_url.trim()) {
      showToast('Document type and URL are required.', 'error');
      return;
    }
    startTransition(async () => {
      try {
        await providerRequest(
          `/api/provider/documents/${encodeURIComponent(documentId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              document_type: doc.document_type.trim(),
              document_url: doc.document_url.trim(),
            }),
          },
        );
        await refreshDashboard();
        showToast('Document updated.', 'success');
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to update document.',
          'error',
        );
      }
    });
  }

  function removeDocument(documentId: string) {
    startTransition(async () => {
      try {
        await providerRequest(
          `/api/provider/documents/${encodeURIComponent(documentId)}`,
          { method: 'DELETE' },
        );
        await refreshDashboard();
        showToast('Document deleted.', 'success');
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to delete document.',
          'error',
        );
      }
    });
  }

  function respondToReview(reviewId: string) {
    const responseText = (reviewResponses[reviewId] ?? '').trim();
    if (!responseText) {
      showToast('Response cannot be empty.', 'error');
      return;
    }
    startTransition(async () => {
      try {
        await providerRequest(
          `/api/provider/reviews/${encodeURIComponent(reviewId)}/respond`,
          { method: 'PATCH', body: JSON.stringify({ responseText }) },
        );
        await fetchReviews(reviewsPage.page, reviewFilter);
        setReviewResponses((current) => ({ ...current, [reviewId]: '' }));
        setActiveReviewEditorId(null);
        showToast('Review response submitted.', 'success');
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to respond to review.',
          'error',
        );
      }
    });
  }

  function loadResponseHistory(reviewId: string) {
    startTransition(async () => {
      try {
        const response = await providerRequest<{
          history: ResponseHistoryEntry[];
        }>(`/api/provider/reviews/${encodeURIComponent(reviewId)}/history`);
        setResponseHistory((current) => ({ ...current, [reviewId]: response.history }));
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Unable to load response history.',
          'error',
        );
      }
    });
  }

  // ── Early return for missing dashboard ────────────────────────────────────────
  if (!dashboard) {
    return (
      <Card>
        <h2 className="text-card-title">Service Provider Dashboard</h2>
        <p className="mt-3 text-body text-neutral-600">
          Provider profile is not linked yet. Complete onboarding to access dashboard controls.
        </p>
      </Card>
    );
  }

  // ── Derived values used in render ─────────────────────────────────────────────
  const dashboardTabs = [
    { id: 'overview', label: 'Overview', href: '/dashboard/provider' },
    { id: 'operations', label: 'Operations', href: '/dashboard/provider?view=operations' },
    { id: 'profile', label: 'Profile Studio', href: '/dashboard/provider?view=profile' },
  ];
  const activeReview =
    reviewsPage.reviews.find((review) => review.id === activeReviewEditorId) ?? null;
  const activeCompletionBooking =
    providerBookings.find((booking) => booking.id === activeCompletionEditorId) ?? null;

  return (
    <DashboardPageLayout
      title="Service Provider Dashboard"
      description="Manage your bookings, availability, performance, and profile."
      tabs={dashboardTabs}
      activeTab={view}
    >
      <div className="space-y-8">
        {view === 'overview' && (
          <ProviderOverviewTab
            performanceSummary={performanceSummary}
            providerBookings={providerBookings}
            onBookingStatusChange={(bookingId, status) =>
              setProviderBookingStatus(bookingId, status)
            }
            onOpenCompletionEditor={setActiveCompletionEditorId}
            isPending={isPending}
          />
        )}

        {view === 'operations' && (
          <ProviderOperationsTab
            dashboard={dashboard}
            providerBookings={providerBookings}
            bookingFilter={bookingFilter}
            onBookingFilterChange={setBookingFilter}
            onBookingStatusChange={(bookingId, status) =>
              setProviderBookingStatus(bookingId, status)
            }
            onMarkCashCollected={markCashCollected}
            onOpenCompletionEditor={setActiveCompletionEditorId}
            blockedDates={blockedDates}
            onManageBlockedDates={() => setIsManagingBlockedDates(true)}
            onManageAvailability={() => setIsManagingAvailability(true)}
            reviewsPage={reviewsPage}
            reviewFilter={reviewFilter}
            onReviewFilterChange={setReviewFilter}
            reviewResponses={reviewResponses}
            onReviewResponseChange={(reviewId, value) =>
              setReviewResponses((current) => ({ ...current, [reviewId]: value }))
            }
            onOpenReviewEditor={setActiveReviewEditorId}
            onLoadResponseHistory={loadResponseHistory}
            onFetchReviews={fetchReviews}
            responseHistory={responseHistory}
            isPending={isPending}
          />
        )}

        {view === 'profile' && (
          <ProviderProfileTab
            dashboard={dashboard}
            profileForm={profileForm}
            detailsForm={detailsForm}
            onEditBio={() => setIsEditingProfileBio(true)}
            onEditDetails={() => setIsEditingDetails(true)}
            onManageDocuments={() => setIsManagingDocuments(true)}
          />
        )}

        <ProviderModals
          dashboard={dashboard}
          isPending={isPending}
          isEditingProfileBio={isEditingProfileBio}
          onCloseProfileBio={() => setIsEditingProfileBio(false)}
          profileForm={profileForm}
          onProfileBioChange={(value) =>
            setProfileForm((current) => ({ ...current, bio: value }))
          }
          onSaveProfile={saveProfile}
          isEditingDetails={isEditingDetails}
          onCloseDetails={() => setIsEditingDetails(false)}
          detailsForm={detailsForm}
          onDetailsFormChange={(patch) => setDetailsForm((current) => ({ ...current, ...patch }))}
          onSaveDetails={saveDetails}
          isManagingBlockedDates={isManagingBlockedDates}
          onCloseBlockedDates={() => setIsManagingBlockedDates(false)}
          blockedDates={blockedDates}
          newBlockedDate={newBlockedDate}
          onNewBlockedDateChange={(patch) =>
            setNewBlockedDate((current) => ({ ...current, ...patch }))
          }
          onAddBlockedDate={addBlockedDate}
          onRemoveBlockedDate={removeBlockedDate}
          isManagingAvailability={isManagingAvailability}
          onCloseAvailability={() => setIsManagingAvailability(false)}
          newAvailability={newAvailability}
          onNewAvailabilityChange={(patch) =>
            setNewAvailability((current) => ({ ...current, ...patch }))
          }
          onAddAvailability={addAvailability}
          availabilityDraft={availabilityDraft}
          onAvailabilityDraftChange={(slotId, patch) =>
            setAvailabilityDraft((current) => ({
              ...current,
              [slotId]: {
                ...(current[slotId] ?? {
                  day_of_week:
                    dashboard.availability.find((s) => s.id === slotId)?.day_of_week ?? 1,
                  start_time:
                    dashboard.availability.find((s) => s.id === slotId)?.start_time ?? '09:00',
                  end_time:
                    dashboard.availability.find((s) => s.id === slotId)?.end_time ?? '18:00',
                  is_available:
                    dashboard.availability.find((s) => s.id === slotId)?.is_available ?? true,
                }),
                ...patch,
              },
            }))
          }
          onSaveAvailabilitySlot={saveAvailabilitySlot}
          onDeleteAvailability={deleteAvailability}
          isManagingDocuments={isManagingDocuments}
          onCloseDocuments={() => setIsManagingDocuments(false)}
          newDocument={newDocument}
          onNewDocumentChange={(patch) =>
            setNewDocument((current) => ({ ...current, ...patch }))
          }
          onUploadDocument={uploadDocument}
          documentDraft={documentDraft}
          onDocumentDraftChange={(docId, patch) =>
            setDocumentDraft((current) => ({
              ...current,
              [docId]: { ...(current[docId] ?? { document_type: '', document_url: '' }), ...patch },
            }))
          }
          onSaveDocument={saveDocument}
          onRemoveDocument={removeDocument}
          activeReview={activeReview}
          onCloseReviewEditor={() => setActiveReviewEditorId(null)}
          reviewResponses={reviewResponses}
          onReviewResponseChange={(reviewId, value) =>
            setReviewResponses((current) => ({ ...current, [reviewId]: value }))
          }
          onRespondToReview={respondToReview}
          activeCompletionBooking={activeCompletionBooking}
          onCloseCompletionEditor={() => setActiveCompletionEditorId(null)}
          completionFeedbackDraft={completionFeedbackDraft}
          onCompletionFeedbackChange={(bookingId, value) =>
            setCompletionFeedbackDraft((current) => ({ ...current, [bookingId]: value }))
          }
          onCompleteBookingWithFeedback={(bookingId, feedback) =>
            setProviderBookingStatus(bookingId, 'completed', feedback, feedback)
          }
        />
      </div>
    </DashboardPageLayout>
  );
}
