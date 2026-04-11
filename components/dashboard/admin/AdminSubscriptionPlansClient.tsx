'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/design-system';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';

type PlanService = {
  service_type: string;
  credit_count: number;
};

type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_inr: number;
  duration_days: number;
  is_active: boolean;
  subscription_plan_services: PlanService[];
};

type NewServiceRow = { service_type: string; credit_count: number };

const SERVICE_TYPES = ['grooming', 'vet_consultation', 'pet_sitting', 'training'];

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  price_inr: '',
  duration_days: '',
  services: [{ service_type: 'grooming', credit_count: 1 }] as NewServiceRow[],
};

function planToForm(plan: SubscriptionPlan) {
  return {
    name: plan.name,
    code: plan.code,
    description: plan.description ?? '',
    price_inr: String(plan.price_inr),
    duration_days: String(plan.duration_days),
    services:
      plan.subscription_plan_services.length > 0
        ? plan.subscription_plan_services.map((s) => ({ service_type: s.service_type, credit_count: s.credit_count }))
        : [{ service_type: 'grooming', credit_count: 1 }],
  };
}

type AdminSubscriptionPlansClientProps = {
  showGuide?: boolean;
};

export default function AdminSubscriptionPlansClient({ showGuide = true }: AdminSubscriptionPlansClientProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/subscriptions/plans');
      const json = await res.json() as { plans?: SubscriptionPlan[] };
      setPlans(json.plans ?? []);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/subscriptions/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          description: form.description || undefined,
          price_inr: Number(form.price_inr),
          duration_days: Number(form.duration_days),
          services: form.services,
        }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? 'Failed to create plan.');
      }
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(plan: SubscriptionPlan) {
    setTogglingId(plan.id);
    try {
      await fetch(`/api/admin/subscriptions/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !plan.is_active }),
      });
      await fetchPlans();
    } finally {
      setTogglingId(null);
    }
  }

  function startEdit(plan: SubscriptionPlan) {
    setEditingPlanId(plan.id);
    setEditForm(planToForm(plan));
    setError(null);
  }

  function cancelEdit() {
    setEditingPlanId(null);
    setEditForm(EMPTY_FORM);
    setError(null);
  }

  async function handleUpdate(planId: string) {
    setIsUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subscriptions/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          code: editForm.code,
          description: editForm.description || null,
          price_inr: Number(editForm.price_inr),
          duration_days: Number(editForm.duration_days),
          services: editForm.services,
        }),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? 'Failed to update plan.');
      }

      cancelEdit();
      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete(plan: SubscriptionPlan) {
    const confirmed = window.confirm(
      `Delete ${plan.name}? This cannot be undone. If it has linked records, deletion will be blocked and you should archive it instead.`,
    );
    if (!confirmed) return;

    setDeletingId(plan.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subscriptions/plans/${plan.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? 'Failed to delete plan.');
      }
      if (editingPlanId === plan.id) {
        cancelEdit();
      }
      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDeletingId(null);
    }
  }

  function addServiceRow() {
    setForm((f) => ({ ...f, services: [...f.services, { service_type: 'grooming', credit_count: 1 }] }));
  }

  function removeServiceRow(idx: number) {
    setForm((f) => ({ ...f, services: f.services.filter((_, i) => i !== idx) }));
  }

  function updateServiceRow(idx: number, field: keyof NewServiceRow, value: string | number) {
    setForm((f) => ({
      ...f,
      services: f.services.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  }

  return (
    <section className="space-y-4">
      {showGuide && (
        <AdminSectionGuide
          title="How to Use Subscription Plans"
          subtitle="Create and manage subscription plans with credit allocations"
          steps={[
            { title: 'View Plans', description: 'All subscription plans are listed below with their pricing, duration, and included service credits.' },
            { title: 'Create a Plan', description: 'Click "+ New Plan" to create a new subscription plan. Fill in the name, price, duration, and credits.' },
            { title: 'Edit Credits', description: 'Each plan includes service credits (e.g., 2 grooming sessions). Adjust allocations per service type.' },
            { title: 'Manage Visibility', description: 'Plans can be active or hidden. Only active plans are shown to customers on the subscription page.' },
          ]}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-section-title">Subscription Plans</h2>
          <p className="text-muted">Manage subscription plans and their service credit allocations.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="shrink-0 rounded-lg border border-coral/40 bg-coral/5 px-3 py-2 text-xs font-semibold text-coral hover:bg-coral/10"
        >
          {showCreate ? 'Cancel' : '+ New Plan'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-[#e7c4a7] bg-white p-5 shadow-soft space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">Create New Plan</h3>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-700">Plan Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Grooming Monthly"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-700">Code</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. GROOM_MONTHLY"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-700">Price (INR)</label>
              <input
                required
                type="number"
                min={1}
                value={form.price_inr}
                onChange={(e) => setForm((f) => ({ ...f, price_inr: e.target.value }))}
                placeholder="e.g. 1499"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-700">Duration (days)</label>
              <input
                required
                type="number"
                min={1}
                value={form.duration_days}
                onChange={(e) => setForm((f) => ({ ...f, duration_days: e.target.value }))}
                placeholder="e.g. 30"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-neutral-700">Description (optional)</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description shown to users"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-700">Service Credits</label>
              <button type="button" onClick={addServiceRow} className="text-xs text-coral hover:underline">
                + Add service
              </button>
            </div>
            {form.services.map((svc, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={svc.service_type}
                  onChange={(e) => updateServiceRow(idx, 'service_type', e.target.value)}
                  className="flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm focus:border-coral focus:outline-none"
                >
                  {SERVICE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={svc.credit_count}
                  onChange={(e) => updateServiceRow(idx, 'credit_count', Number(e.target.value))}
                  className="w-20 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm focus:border-coral focus:outline-none"
                />
                <span className="text-xs text-neutral-500">credits</span>
                {form.services.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeServiceRow(idx)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral/90 disabled:opacity-60"
            >
              {isSaving ? 'Creating…' : 'Create Plan'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl bg-white p-4">
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading plans…</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-neutral-500">No subscription plans found.</p>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-lg bg-neutral-50/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-900">{plan.name}</span>
                      <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 font-mono text-[10px] text-neutral-500">
                        {plan.code}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-xs text-neutral-500">{plan.description}</p>
                    )}
                    <p className="text-xs text-neutral-600">
                      ₹{plan.price_inr.toLocaleString('en-IN')} · {plan.duration_days} days
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {plan.subscription_plan_services.map((s) => (
                        <span
                          key={s.service_type}
                          className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-2 py-0.5 text-[11px] font-medium text-coral"
                        >
                          {s.service_type} × {s.credit_count}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-semibold',
                        plan.is_active
                          ? 'border-green-300 bg-green-50 text-green-700'
                          : 'border-neutral-300 bg-neutral-100 text-neutral-500',
                      )}
                    >
                      {plan.is_active ? 'Active' : 'Archived'}
                    </span>
                    <button
                      type="button"
                      disabled={togglingId === plan.id}
                      onClick={() => toggleActive(plan)}
                      className={cn(
                        'rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50',
                        plan.is_active
                          ? 'border-neutral-300 text-neutral-600 hover:border-neutral-400'
                          : 'border-green-200 text-green-700 hover:bg-green-50',
                      )}
                    >
                      {plan.is_active ? 'Archive' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating || deletingId === plan.id}
                      onClick={() => startEdit(plan)}
                      className="rounded-md border border-coral/40 px-2 py-1 text-xs font-medium text-coral hover:bg-coral/5 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === plan.id || isUpdating}
                      onClick={() => handleDelete(plan)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === plan.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>

                {editingPlanId === plan.id && (
                  <div className="mt-4 rounded-xl border border-[#f0d8c5] bg-white p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-neutral-900">Edit Plan</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-700">Plan Name</label>
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-700">Code</label>
                        <input
                          value={editForm.code}
                          onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-700">Price (INR)</label>
                        <input
                          type="number"
                          min={1}
                          value={editForm.price_inr}
                          onChange={(e) => setEditForm((f) => ({ ...f, price_inr: e.target.value }))}
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-700">Duration (days)</label>
                        <input
                          type="number"
                          min={1}
                          value={editForm.duration_days}
                          onChange={(e) => setEditForm((f) => ({ ...f, duration_days: e.target.value }))}
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-medium text-neutral-700">Description</label>
                        <input
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-neutral-700">Service Credits</label>
                        <button
                          type="button"
                          onClick={() => setEditForm((f) => ({ ...f, services: [...f.services, { service_type: 'grooming', credit_count: 1 }] }))}
                          className="text-xs text-coral hover:underline"
                        >
                          + Add service
                        </button>
                      </div>
                      {editForm.services.map((svc, idx) => (
                        <div key={`${plan.id}-${idx}`} className="flex items-center gap-2">
                          <select
                            value={svc.service_type}
                            onChange={(e) => setEditForm((f) => ({
                              ...f,
                              services: f.services.map((s, i) => (i === idx ? { ...s, service_type: e.target.value } : s)),
                            }))}
                            className="flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm focus:border-coral focus:outline-none"
                          >
                            {SERVICE_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={svc.credit_count}
                            onChange={(e) => setEditForm((f) => ({
                              ...f,
                              services: f.services.map((s, i) => (i === idx ? { ...s, credit_count: Number(e.target.value) } : s)),
                            }))}
                            className="w-20 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm focus:border-coral focus:outline-none"
                          />
                          {editForm.services.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setEditForm((f) => ({ ...f, services: f.services.filter((_, i) => i !== idx) }))}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdate(plan.id)}
                        className="rounded-lg bg-coral px-3 py-1.5 text-xs font-semibold text-white hover:bg-coral/90 disabled:opacity-60"
                      >
                        {isUpdating ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
