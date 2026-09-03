'use client';

// ── Unified automation health card (B11) ─────────────────────────────────────
// One place in the System area showing every scheduled system's health: CRM
// jobs come from the heartbeat-backed status API; the billing automation runs
// on Render crons and links to the Billing command center for run history.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { adminRequest } from '@/lib/api/admin-fetch';
import { formatLeadTimestamp } from '@/lib/crm/labels';
import type { CrmAutomationStatus } from '@/lib/crm/automation-status';

const SEVERITY_BADGE_VARIANTS: Record<CrmAutomationStatus['overall']['severity'], 'success' | 'warning' | 'error'> = {
  ok: 'success',
  warn: 'warning',
  critical: 'error',
};

const STATUS_LABELS: Record<CrmAutomationStatus['overall']['status'], string> = {
  healthy: 'Healthy',
  stale: 'Stale',
  failing: 'Failing',
  not_reporting: 'Not reporting',
  misconfigured: 'Misconfigured',
};

const JOB_LABELS: Record<'meta_sheet_import' | 'abandoned_bookings_sweep', string> = {
  meta_sheet_import: 'Meta sheet import',
  abandoned_bookings_sweep: 'Abandoned-booking sweep',
};

export default function AutomationHealthCard({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const [status, setStatus] = useState<CrmAutomationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const payload = await adminRequest<CrmAutomationStatus>('/api/admin/crm/automation/status');
      setStatus(payload);
      setError(null);
    } catch (err) {
      // Loud, never silent — a stuck "loading…" card hides cron outages.
      console.warn('[admin] Automation status failed to load:', err);
      setError('Automation status failed to load.');
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = window.setInterval(() => void fetchStatus(), 60_000);
    return () => window.clearInterval(interval);
  }, [fetchStatus, refreshSignal]);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-neutral-900">Automation health</h3>
          {status ? (
            <Badge variant={SEVERITY_BADGE_VARIANTS[status.overall.severity]} size="sm">
              {STATUS_LABELS[status.overall.status]}
            </Badge>
          ) : (
            <span className="text-xs text-neutral-400">loading…</span>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          {status
            ? `Crons expected every ${status.expectedCadenceMinutes} min · auto-refreshes every minute`
            : 'Scheduled systems across CRM and billing'}
        </p>
      </div>

      {error ? (
        <p className="mt-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}{' '}
          <button type="button" onClick={() => void fetchStatus()} className="underline underline-offset-2">
            Retry
          </button>
        </p>
      ) : null}

      {status ? (
        <>
          <p className={`mt-1.5 text-xs ${status.overall.severity === 'ok' ? 'text-neutral-500' : 'font-medium text-red-600'}`}>
            {status.overall.detail}
          </p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {status.jobs.map((job) => (
              <div key={job.job} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-neutral-800">{JOB_LABELS[job.job]}</p>
                  <Badge variant={SEVERITY_BADGE_VARIANTS[job.severity]} size="sm">
                    {STATUS_LABELS[job.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-neutral-600">{job.detail}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {job.lastHeartbeatAt ? `Last report ${formatLeadTimestamp(job.lastHeartbeatAt)}` : 'Never reported'}
                </p>
              </div>
            ))}
            {/* Billing automation runs on Render cron services (not heartbeat-backed). */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-neutral-800">Billing reminders + stale-txn cleanup</p>
                <Link
                  href="/dashboard/admin/billing"
                  className="text-[11px] font-semibold text-coral underline underline-offset-2"
                >
                  Runs →
                </Link>
              </div>
              <p className="mt-1 text-[11px] text-neutral-600">
                Render cron services — run history lives in the Billing command center.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {status.config.map((check) => (
              <span
                key={check.key}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  check.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {check.label}
                {check.hint ? ` · ${check.hint}` : ''}
              </span>
            ))}
          </div>
        </>
      ) : !error ? (
        <p className="mt-3 text-xs text-neutral-500">Loading automation status…</p>
      ) : null}
    </section>
  );
}
