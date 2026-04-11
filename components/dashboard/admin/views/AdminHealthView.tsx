'use client';

import Link from 'next/link';
import { Card, Button } from '@/components/ui';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';
import { cn } from '@/lib/design-system';

type SchemaSyncCheck = {
  key: string;
  ok: boolean;
  expected: boolean;
  actual: boolean;
};

type SchemaSyncHealthResponse = {
  healthy: boolean;
  domain: 'schema-contract';
  checks: SchemaSyncCheck[];
  failed_checks: SchemaSyncCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  generated_at: string;
  error?: string;
};

type FunctionalHealthCheck = {
  key: string;
  label: string;
  endpoint: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  durationMs: number | null;
  lastRunAt: string | null;
  error: string | null;
};

type FinanceIntegrityHealthResponse = {
  generated_at: string;
  window: {
    lookback_days: number;
    since: string;
    max_rows_scanned_per_table: number;
  };
  totals: {
    bookings_scanned: number;
    completed_bookings: number;
    invoices_scanned: number;
    service_invoices: number;
    paid_service_invoices: number;
    payment_transactions_scanned: number;
    booking_payment_transactions: number;
  };
  integrity: {
    severity: 'healthy' | 'warning' | 'critical';
    mismatch_count: number;
    issues: {
      completed_without_invoice: number;
      completed_without_payment_transaction: number;
      paid_invoices_missing_payment_reference: number;
      paid_service_transactions_without_service_invoice: number;
    };
  };
  samples: {
    completed_without_invoice: Array<{ booking_id: number; created_at: string | null; status: string }>;
    completed_without_payment_transaction: Array<{ booking_id: number; created_at: string | null; status: string }>;
    paid_invoices_missing_payment_reference: Array<{ invoice_id: string; booking_id: number | null; created_at: string | null }>;
    paid_service_transactions_without_service_invoice: Array<{
      payment_transaction_id: string;
      booking_id: number | null;
      status: string;
      created_at: string | null;
    }>;
  };
  error?: string;
};

type SchemaFixGuide = {
  migration: string;
  note: string;
};

const SCHEMA_FIX_GUIDES: Record<string, SchemaFixGuide> = {
  'users.address.nullable': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Users profile fields must be nullable at column level and enforced by role-aware trigger.',
  },
  'users.age.nullable': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Users profile fields must be nullable at column level and enforced by role-aware trigger.',
  },
  'users.gender.nullable': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Users profile fields must be nullable at column level and enforced by role-aware trigger.',
  },
  'users.role_profile.trigger.exists': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Create role-aware trigger to enforce profile completeness only for role=user.',
  },
  'users.role_profile.trigger.enabled': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Ensure role-aware users trigger is enabled.',
  },
  'users.role_profile.function.exists': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Function backing role-aware users profile enforcement is missing.',
  },
  'providers.provider_type.is_text': {
    migration: '017_allow_custom_provider_types.sql',
    note: 'Provider type must be text to support custom provider categories.',
  },
  'admin.idempotency.table.exists': {
    migration: '039_admin_idempotency_keys.sql',
    note: 'Create idempotency storage for safe retry of admin onboarding requests.',
  },
};

function formatSchemaHealthTimestamp(value: string | null) {
  if (!value) return 'Not run yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

type AdminHealthViewProps = {
  schemaSyncHealth: SchemaSyncHealthResponse | null;
  schemaSyncDurationMs: number | null;
  isSchemaSyncChecking: boolean;
  functionalHealthChecks: FunctionalHealthCheck[];
  isFunctionalHealthChecking: boolean;
  financeIntegrityHealth?: FinanceIntegrityHealthResponse | null;
  financeIntegrityDurationMs?: number | null;
  isFinanceIntegrityChecking?: boolean;
  isPending: boolean;
  onRunSchemaSyncHealthCheck: () => void;
  onRunFunctionalHealthChecks: () => void;
  onRunFinanceIntegrityCheck?: () => void;
  onDownloadSchemaHealthReport: () => void;
};

export default function AdminHealthView({
  schemaSyncHealth,
  schemaSyncDurationMs,
  isSchemaSyncChecking,
  functionalHealthChecks,
  isFunctionalHealthChecking,
  financeIntegrityHealth = null,
  financeIntegrityDurationMs = null,
  isFinanceIntegrityChecking = false,
  isPending,
  onRunSchemaSyncHealthCheck,
  onRunFunctionalHealthChecks,
  onRunFinanceIntegrityCheck,
  onDownloadSchemaHealthReport,
}: AdminHealthViewProps) {
  return (
    <section className="space-y-6">
      <AdminSectionGuide
        title="How to Use Health Center"
        subtitle="Monitor platform infrastructure and data integrity"
        steps={[
          { title: 'Schema Check', description: 'Verifies the database structure matches expected tables and columns. Run after any migration.' },
          { title: 'Functional Checks', description: 'Tests critical API endpoints (auth, bookings, payments) to confirm they respond correctly.' },
          { title: 'Finance Integrity', description: 'Cross-checks bookings, invoices, and payments to find any mismatches or orphaned records.' },
          { title: 'Review Results', description: 'Green = healthy. Red = issue found. Click "Download Schema Report" for full details.' },
        ]}
      />

      <div className="space-y-3">
        <h2 className="text-section-title">Platform Health Center</h2>
        <p className="text-muted">Run and monitor schema and functional health checks from one observability panel.</p>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-neutral-900">Health Actions</p>
              <p className="text-sm text-neutral-600">Use these controls to verify infrastructure and critical admin APIs.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onRunSchemaSyncHealthCheck} disabled={isPending || isSchemaSyncChecking} variant="secondary">
                {isSchemaSyncChecking ? 'Checking Schema…' : 'Run Schema Check'}
              </Button>
              <Button onClick={onRunFunctionalHealthChecks} disabled={isPending || isFunctionalHealthChecking} variant="secondary">
                {isFunctionalHealthChecking ? 'Checking Functions…' : 'Run Functional Checks'}
              </Button>
              <Button onClick={onRunFinanceIntegrityCheck} disabled={isPending || isFinanceIntegrityChecking || !onRunFinanceIntegrityCheck} variant="secondary">
                {isFinanceIntegrityChecking ? 'Checking Finance…' : 'Run Finance Integrity'}
              </Button>
              <Button onClick={onDownloadSchemaHealthReport} disabled={!schemaSyncHealth} variant="ghost">
                Download Schema Report
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-neutral-50/80 p-3">
              <p className="text-xs text-neutral-600">Schema Status</p>
              <p className={cn('mt-1 text-sm font-semibold', schemaSyncHealth?.healthy ? 'text-green-700' : 'text-red-700')}>
                {schemaSyncHealth?.healthy ? 'Healthy' : schemaSyncHealth ? 'Unhealthy' : 'Not run'}
              </p>
            </div>
            <div className="rounded-xl bg-neutral-50/80 p-3">
              <p className="text-xs text-neutral-600">Schema Checks</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {schemaSyncHealth ? `${schemaSyncHealth.summary.passed}/${schemaSyncHealth.summary.total}` : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-neutral-50/80 p-3">
              <p className="text-xs text-neutral-600">Function Checks</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {functionalHealthChecks.filter((check) => check.status === 'healthy').length}/{functionalHealthChecks.length}
              </p>
            </div>
            <div className="rounded-xl bg-neutral-50/80 p-3">
              <p className="text-xs text-neutral-600">Last Schema Run</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {formatSchemaHealthTimestamp(schemaSyncHealth?.generated_at ?? null)}
              </p>
            </div>
            <div className="rounded-xl bg-neutral-50/80 p-3">
              <p className="text-xs text-neutral-600">Finance Integrity</p>
              <p
                className={cn(
                  'mt-1 text-sm font-semibold',
                  financeIntegrityHealth?.integrity.severity === 'healthy'
                    ? 'text-green-700'
                    : financeIntegrityHealth?.integrity.severity === 'warning'
                    ? 'text-amber-700'
                    : financeIntegrityHealth
                    ? 'text-red-700'
                    : 'text-neutral-900',
                )}
              >
                {financeIntegrityHealth ? financeIntegrityHealth.integrity.severity : 'Not run'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl bg-neutral-50/60 p-3">
              <p className="text-sm font-semibold text-neutral-900">Schema Health</p>
              <p className="mt-1 text-xs text-neutral-500">
                Duration: {schemaSyncDurationMs !== null ? `${schemaSyncDurationMs}ms` : '—'}
              </p>

              {schemaSyncHealth && schemaSyncHealth.failed_checks.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-red-700">
                  {schemaSyncHealth.failed_checks.map((check) => {
                    const fixGuide = SCHEMA_FIX_GUIDES[check.key];
                    return (
                      <li key={check.key}>
                        • {check.key}
                        {fixGuide ? ` → ${fixGuide.migration}` : ''}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-green-700">No schema drift detected.</p>
              )}
            </div>

            <div className="rounded-xl bg-neutral-50/60 p-3">
              <p className="text-sm font-semibold text-neutral-900">Functional Health</p>
              <ul className="mt-2 space-y-2 text-xs">
                {functionalHealthChecks.map((check) => (
                  <li key={check.key} className="rounded-lg bg-neutral-50/70 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-neutral-900">{check.label}</span>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                          check.status === 'healthy'
                            ? 'border-green-300 bg-green-100 text-green-700'
                            : check.status === 'unhealthy'
                            ? 'border-red-300 bg-red-100 text-red-700'
                            : 'border-neutral-300 bg-neutral-100 text-neutral-700',
                        )}
                      >
                        {check.status}
                      </span>
                    </div>
                    <p className="mt-1 text-neutral-500">{check.endpoint}</p>
                    <p className="mt-1 text-neutral-500">
                      {check.lastRunAt ? `Last run: ${formatSchemaHealthTimestamp(check.lastRunAt)}` : 'Last run: —'}
                      {check.durationMs !== null ? ` • ${check.durationMs}ms` : ''}
                    </p>
                    {check.error ? <p className="mt-1 text-red-700">{check.error}</p> : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-neutral-50/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-neutral-900">Finance Integrity</p>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                    financeIntegrityHealth?.integrity.severity === 'healthy'
                      ? 'border-green-300 bg-green-100 text-green-700'
                      : financeIntegrityHealth?.integrity.severity === 'warning'
                      ? 'border-amber-300 bg-amber-100 text-amber-700'
                      : financeIntegrityHealth
                      ? 'border-red-300 bg-red-100 text-red-700'
                      : 'border-neutral-300 bg-neutral-100 text-neutral-700',
                  )}
                >
                  {financeIntegrityHealth?.integrity.severity ?? 'unknown'}
                </span>
              </div>

              <p className="mt-1 text-xs text-neutral-500">
                Duration: {financeIntegrityDurationMs !== null ? `${financeIntegrityDurationMs}ms` : '—'}
              </p>

              {financeIntegrityHealth?.error ? (
                <p className="mt-2 text-xs text-red-700">{financeIntegrityHealth.error}</p>
              ) : null}

              <div className="mt-2 space-y-1 text-xs text-neutral-700">
                <p>Mismatches: {financeIntegrityHealth?.integrity.mismatch_count ?? '—'}</p>
                <p>Completed without invoice: {financeIntegrityHealth?.integrity.issues.completed_without_invoice ?? '—'}</p>
                <p>Completed without payment tx: {financeIntegrityHealth?.integrity.issues.completed_without_payment_transaction ?? '—'}</p>
                <p>Paid invoice missing tx ref: {financeIntegrityHealth?.integrity.issues.paid_invoices_missing_payment_reference ?? '—'}</p>
                <p>Paid tx missing invoice: {financeIntegrityHealth?.integrity.issues.paid_service_transactions_without_service_invoice ?? '—'}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link href="/dashboard/admin/billing" className="rounded-md border border-neutral-300 px-2 py-1 font-semibold text-neutral-700 hover:border-neutral-400">
                  Open Billing
                </Link>
                <Link href="/dashboard/admin/payments" className="rounded-md border border-neutral-300 px-2 py-1 font-semibold text-neutral-700 hover:border-neutral-400">
                  Open Payments
                </Link>
              </div>

              {financeIntegrityHealth ? (
                <div className="mt-3 space-y-2 text-xs">
                  <div>
                    <p className="font-medium text-neutral-900">Sample: Completed without invoice</p>
                    <p className="text-neutral-600">
                      {financeIntegrityHealth.samples.completed_without_invoice
                        .slice(0, 3)
                        .map((item) => `#${item.booking_id}`)
                        .join(', ') || 'None'}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Sample: Paid invoices missing tx ref</p>
                    <p className="text-neutral-600">
                      {financeIntegrityHealth.samples.paid_invoices_missing_payment_reference
                        .slice(0, 3)
                        .map((item) => item.invoice_id)
                        .join(', ') || 'None'}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
