'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Alert, Button, Input } from '@/components/ui';
import { adminRequest } from '@/lib/api/admin-fetch';
import { useToast } from '@/components/ui/ToastProvider';
import type { ConfirmConfig } from '@/components/dashboard/admin/AdminDashboardShell';

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminSop = {
  id: string;
  slug: string;
  title: string;
  instructions: string | null;
  requires_photo: boolean;
  min_photo_count: number;
  max_photo_count: number;
  mandatory: boolean;
  service_type: string | null;
  sort_order: number;
  status: 'active' | 'inactive';
  version: number;
  created_at: string;
  updated_at: string;
  usage: {
    pending: number;
    submitted: number;
    approved: number;
    rejected: number;
    waived: number;
  };
};

type SopFormDraft = {
  title: string;
  instructions: string;
  requiresPhoto: boolean;
  minPhotoCount: string;
  maxPhotoCount: string;
  mandatory: boolean;
  serviceType: string;
  sortOrder: string;
};

const EMPTY_DRAFT: SopFormDraft = {
  title: '',
  instructions: '',
  requiresPhoto: true,
  minPhotoCount: '1',
  maxPhotoCount: '6',
  mandatory: true,
  serviceType: '',
  sortOrder: '0',
};

const SERVICE_TYPE_OPTIONS = [
  { value: '', label: 'All services' },
  { value: 'grooming', label: 'Grooming only' },
  { value: 'vet_consultation', label: 'Vet consultation only' },
  { value: 'pet_sitting', label: 'Pet sitting only' },
  { value: 'training', label: 'Training only' },
];

function draftFromSop(sop: AdminSop): SopFormDraft {
  return {
    title: sop.title,
    instructions: sop.instructions ?? '',
    requiresPhoto: sop.requires_photo,
    minPhotoCount: String(sop.min_photo_count),
    maxPhotoCount: String(sop.max_photo_count),
    mandatory: sop.mandatory,
    serviceType: sop.service_type ?? '',
    sortOrder: String(sop.sort_order),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SopsTab({ openConfirm }: { openConfirm: (config: Omit<ConfirmConfig, 'isOpen'>) => void }) {
  const { showToast } = useToast();
  const [sops, setSops] = useState<AdminSop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<AdminSop | null>(null);
  const [draft, setDraft] = useState<SopFormDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchSops = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminRequest<{ sops: AdminSop[] }>('/api/admin/sops');
      setSops(response.sops ?? []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load SOPs.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSops();
  }, [fetchSops]);

  function openCreateEditor() {
    setEditingSop(null);
    setDraft(EMPTY_DRAFT);
    setSaveError(null);
    setIsEditorOpen(true);
  }

  function openEditEditor(sop: AdminSop) {
    setEditingSop(sop);
    setDraft(draftFromSop(sop));
    setSaveError(null);
    setIsEditorOpen(true);
  }

  async function saveSop() {
    if (!draft.title.trim()) {
      setSaveError('Title is required.');
      return;
    }

    const minPhotoCount = Number(draft.minPhotoCount);
    const maxPhotoCount = Number(draft.maxPhotoCount);
    const sortOrder = Number(draft.sortOrder);

    if (!Number.isInteger(minPhotoCount) || minPhotoCount < 0) {
      setSaveError('Minimum photo count must be 0 or more.');
      return;
    }
    if (!Number.isInteger(maxPhotoCount) || maxPhotoCount < 1) {
      setSaveError('Maximum photo count must be at least 1.');
      return;
    }
    if (minPhotoCount > maxPhotoCount) {
      setSaveError('Minimum photo count cannot exceed the maximum.');
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setSaveError('Sort order must be 0 or more.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const payload = {
        title: draft.title.trim(),
        instructions: draft.instructions.trim() || undefined,
        requiresPhoto: draft.requiresPhoto,
        minPhotoCount,
        maxPhotoCount,
        mandatory: draft.mandatory,
        serviceType: draft.serviceType || null,
        sortOrder,
      };

      if (editingSop) {
        await adminRequest(`/api/admin/sops/${editingSop.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        showToast('SOP updated. New requirements apply to future bookings.', 'success');
      } else {
        await adminRequest('/api/admin/sops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        showToast('SOP created. It applies to new bookings from now on.', 'success');
      }

      setIsEditorOpen(false);
      await fetchSops();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save the SOP.');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleSopStatus(sop: AdminSop) {
    const nextStatus = sop.status === 'active' ? 'inactive' : 'active';
    const activating = nextStatus === 'active';

    openConfirm({
      title: `${activating ? 'Activate' : 'Deactivate'} “${sop.title}”?`,
      description: activating
        ? 'New bookings will be assigned this SOP again. Existing submissions keep their snapshot.'
        : 'New bookings will no longer be assigned this SOP. In-flight orders keep their assigned checklist.',
      confirmLabel: activating ? 'Activate' : 'Deactivate',
      confirmVariant: activating ? 'default' : 'warning',
      onConfirm: async () => {
        try {
          await adminRequest(`/api/admin/sops/${sop.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus }),
          });
          showToast(`SOP ${activating ? 'activated' : 'deactivated'}.`, 'success');
          await fetchSops();
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Unable to update the SOP.', 'error');
        }
      },
    });
  }

  function archiveSop(sop: AdminSop) {
    openConfirm({
      title: `Archive “${sop.title}”?`,
      description:
        'Archived SOPs stay in history for audit but are never assigned to new bookings. This cannot be undone from the console.',
      confirmLabel: 'Archive SOP',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await adminRequest(`/api/admin/sops/${sop.id}`, { method: 'DELETE' });
          showToast('SOP archived.', 'success');
          await fetchSops();
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Unable to archive the SOP.', 'error');
        }
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Service SOPs</p>
          <p className="text-xs text-neutral-500">
            Providers must fulfil mandatory SOPs — with photo evidence where required — before completing an order.
            Edits apply to future bookings only; in-flight orders keep their assigned requirements.
          </p>
        </div>
        <Button size="sm" variant="premium" onClick={openCreateEditor}>
          + New SOP
        </Button>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
      ) : sops.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-neutral-800">No SOPs yet</p>
          <p className="mt-1 text-xs text-neutral-500">
            Create your first SOP — e.g. “Groomer in Uniform” — to start enforcing service quality at order completion.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sops.map((sop) => (
            <div
              key={sop.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm ${sop.status === 'active' ? 'border-neutral-200' : 'border-neutral-200 opacity-60'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">
                    {sop.title}
                    <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                      v{sop.version}
                    </span>
                    {sop.status === 'inactive' && (
                      <span className="ml-1.5 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500">
                        Inactive
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">{sop.instructions ?? 'No instructions set.'}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                    <span className={`rounded px-1.5 py-0.5 ${sop.mandatory ? 'bg-coral/10 text-coral' : 'bg-neutral-100 text-neutral-500'}`}>
                      {sop.mandatory ? 'Mandatory' : 'Optional'}
                    </span>
                    {sop.requires_photo && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                        📷 {sop.min_photo_count}–{sop.max_photo_count} photos
                      </span>
                    )}
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">
                      {sop.service_type ? `${sop.service_type.replace(/_/g, ' ')} only` : 'All services'}
                    </span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">Order {sop.sort_order}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEditEditor(sop)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => toggleSopStatus(sop)}>
                    {sop.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                  {sop.status === 'inactive' && (
                    <Button size="sm" variant="danger" onClick={() => archiveSop(sop)}>
                      Archive
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 border-t border-neutral-100 pt-2 text-[10px] text-neutral-500">
                <span>30d: {sop.usage.pending} pending</span>
                <span>{sop.usage.submitted} submitted</span>
                <span>{sop.usage.approved} approved</span>
                <span className={sop.usage.rejected > 0 ? 'text-red-600' : ''}>{sop.usage.rejected} rejected</span>
                <span>{sop.usage.waived} waived</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingSop ? `Edit “${editingSop.title}”` : 'New SOP'}
        description="Define what the provider must do (and photograph) before an order can be completed."
        size="lg"
      >
        <div className="space-y-4">
          {saveError && <Alert variant="error">{saveError}</Alert>}

          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-700" htmlFor="sop-title">
              Title
            </label>
            <Input
              id="sop-title"
              value={draft.title}
              maxLength={120}
              placeholder="e.g. Service After Pictures"
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-700" htmlFor="sop-instructions">
              Provider instructions
            </label>
            <textarea
              id="sop-instructions"
              value={draft.instructions}
              maxLength={2000}
              placeholder="Describe what a compliant submission looks like — providers see this text."
              onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))}
              className="input-field min-h-[80px] w-full resize-y text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-neutral-200 p-3">
              <label className="flex items-center justify-between text-xs font-semibold text-neutral-700">
                Photo evidence required
                <input
                  type="checkbox"
                  checked={draft.requiresPhoto}
                  onChange={(event) => setDraft((current) => ({ ...current, requiresPhoto: event.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-neutral-500" htmlFor="sop-min-photos">
                    Min photos
                  </label>
                  <Input
                    id="sop-min-photos"
                    value={draft.minPhotoCount}
                    inputMode="numeric"
                    disabled={!draft.requiresPhoto}
                    onChange={(event) => setDraft((current) => ({ ...current, minPhotoCount: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-neutral-500" htmlFor="sop-max-photos">
                    Max photos
                  </label>
                  <Input
                    id="sop-max-photos"
                    value={draft.maxPhotoCount}
                    inputMode="numeric"
                    disabled={!draft.requiresPhoto}
                    onChange={(event) => setDraft((current) => ({ ...current, maxPhotoCount: event.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-neutral-200 p-3">
              <label className="flex items-center justify-between text-xs font-semibold text-neutral-700">
                Mandatory to complete order
                <input
                  type="checkbox"
                  checked={draft.mandatory}
                  onChange={(event) => setDraft((current) => ({ ...current, mandatory: event.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
              <p className="text-[10px] leading-4 text-neutral-500">
                Optional SOPs appear in the provider checklist but never block completion. Admins can always bypass
                mandatory SOPs with a recorded reason.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-neutral-500" htmlFor="sop-service-type">
                    Applies to
                  </label>
                  <select
                    id="sop-service-type"
                    value={draft.serviceType}
                    onChange={(event) => setDraft((current) => ({ ...current, serviceType: event.target.value }))}
                    className="input-field w-full text-sm"
                  >
                    {SERVICE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-neutral-500" htmlFor="sop-sort-order">
                    Sort order
                  </label>
                  <Input
                    id="sop-sort-order"
                    value={draft.sortOrder}
                    inputMode="numeric"
                    onChange={(event) => setDraft((current) => ({ ...current, sortOrder: event.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
            <Button variant="secondary" size="sm" onClick={() => setIsEditorOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="premium" size="sm" onClick={() => void saveSop()} disabled={isSaving}>
              {isSaving ? 'Saving…' : editingSop ? 'Save changes' : 'Create SOP'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
