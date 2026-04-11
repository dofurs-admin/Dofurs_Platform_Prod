'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import AdminHealthView from '@/components/dashboard/admin/views/AdminHealthView';
import { useToast } from '@/components/ui/ToastProvider';

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

const INITIAL_FUNCTIONAL_CHECKS: FunctionalHealthCheck[] = [
  {
    key: 'admin.providers.read',
    label: 'Providers API',
    endpoint: '/api/admin/providers',
    status: 'unknown',
    durationMs: null,
    lastRunAt: null,
    error: null,
  },
  {
    key: 'admin.bookings.read',
    label: 'Bookings API',
    endpoint: '/api/admin/bookings',
    status: 'unknown',
    durationMs: null,
    lastRunAt: null,
    error: null,
  },
  {
    key: 'admin.services.read',
    label: 'Services API',
    endpoint: '/api/admin/services',
    status: 'unknown',
    durationMs: null,
    lastRunAt: null,
    error: null,
  },
  {
    key: 'admin.billing.integrity',
    label: 'Billing Integrity API',
    endpoint: '/api/admin/billing/health?lookbackDays=30&sampleSize=20',
    status: 'unknown',
    durationMs: null,
    lastRunAt: null,
    error: null,
  },
];

export default function HealthTab() {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [schemaSyncHealth, setSchemaSyncHealth] = useState<SchemaSyncHealthResponse | null>(null);
  const [schemaSyncDurationMs, setSchemaSyncDurationMs] = useState<number | null>(null);
  const [isSchemaSyncChecking, setIsSchemaSyncChecking] = useState(false);
  const [hasAutoRun, setHasAutoRun] = useState(false);
  const [functionalHealthChecks, setFunctionalHealthChecks] = useState<FunctionalHealthCheck[]>(INITIAL_FUNCTIONAL_CHECKS);
  const [isFunctionalHealthChecking, setIsFunctionalHealthChecking] = useState(false);
  const [financeIntegrityHealth, setFinanceIntegrityHealth] = useState<FinanceIntegrityHealthResponse | null>(null);
  const [financeIntegrityDurationMs, setFinanceIntegrityDurationMs] = useState<number | null>(null);
  const [isFinanceIntegrityChecking, setIsFinanceIntegrityChecking] = useState(false);

  const runFinanceIntegrityCheck = useCallback(() => {
    setIsFinanceIntegrityChecking(true);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/billing/health?lookbackDays=30&sampleSize=20', {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => null)) as FinanceIntegrityHealthResponse | { error?: string } | null;

        if (!response.ok) {
          const errorMessage = payload && 'error' in payload && payload.error ? payload.error : 'Finance integrity check failed';
          throw new Error(errorMessage);
        }

        const health = payload as FinanceIntegrityHealthResponse;
        setFinanceIntegrityHealth(health);
        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setFinanceIntegrityDurationMs(Math.round(finishedAt - startedAt));

        if (health.integrity.severity === 'healthy') {
          showToast('Finance integrity check passed.', 'success');
          return;
        }

        if (health.integrity.severity === 'critical') {
          showToast(`Finance integrity critical: ${health.integrity.mismatch_count} mismatch sample(s).`, 'error');
          return;
        }

        showToast(`Finance integrity warning: ${health.integrity.mismatch_count} mismatch sample(s).`, 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Finance integrity check failed';
        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setFinanceIntegrityDurationMs(Math.round(finishedAt - startedAt));
        setFinanceIntegrityHealth({
          generated_at: new Date().toISOString(),
          window: {
            lookback_days: 30,
            since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            max_rows_scanned_per_table: 0,
          },
          totals: {
            bookings_scanned: 0,
            completed_bookings: 0,
            invoices_scanned: 0,
            service_invoices: 0,
            paid_service_invoices: 0,
            payment_transactions_scanned: 0,
            booking_payment_transactions: 0,
          },
          integrity: {
            severity: 'critical',
            mismatch_count: 0,
            issues: {
              completed_without_invoice: 0,
              completed_without_payment_transaction: 0,
              paid_invoices_missing_payment_reference: 0,
              paid_service_transactions_without_service_invoice: 0,
            },
          },
          samples: {
            completed_without_invoice: [],
            completed_without_payment_transaction: [],
            paid_invoices_missing_payment_reference: [],
            paid_service_transactions_without_service_invoice: [],
          },
          error: message,
        });
        showToast(message, 'error');
      } finally {
        setIsFinanceIntegrityChecking(false);
      }
    });
  }, [showToast]);

  const runSchemaSyncHealthCheck = useCallback(() => {
    setIsSchemaSyncChecking(true);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/health/schema-sync', {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = (await response.json().catch(() => null)) as SchemaSyncHealthResponse | { error?: string } | null;

        if (!response.ok) {
          const errorMessage = payload && 'error' in payload && payload.error ? payload.error : 'Schema health check failed';
          throw new Error(errorMessage);
        }

        const health = payload as SchemaSyncHealthResponse;
        setSchemaSyncHealth(health);
        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setSchemaSyncDurationMs(Math.round(finishedAt - startedAt));

        if (health.healthy) {
          showToast('Schema sync check passed.', 'success');
          return;
        }

        showToast(`Schema sync check found ${health.summary.failed} issue(s).`, 'error');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Schema health check failed';
        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setSchemaSyncDurationMs(Math.round(finishedAt - startedAt));
        setSchemaSyncHealth({
          healthy: false,
          domain: 'schema-contract',
          checks: [],
          failed_checks: [],
          summary: { total: 0, passed: 0, failed: 0 },
          generated_at: new Date().toISOString(),
          error: message,
        });
        showToast(message, 'error');
      } finally {
        setIsSchemaSyncChecking(false);
      }
    });
  }, [showToast]);

  const runFunctionalHealthChecks = useCallback(() => {
    setIsFunctionalHealthChecking(true);

    startTransition(async () => {
      try {
        const nextChecks = await Promise.all(
          functionalHealthChecks.map(async (check) => {
            const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

            try {
              const response = await fetch(check.endpoint, {
                method: 'GET',
                cache: 'no-store',
              });
              const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

              return {
                ...check,
                status: response.ok ? ('healthy' as const) : ('unhealthy' as const),
                durationMs: Math.round(finishedAt - startedAt),
                lastRunAt: new Date().toISOString(),
                error: response.ok ? null : `HTTP ${response.status}`,
              };
            } catch (error) {
              const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
              return {
                ...check,
                status: 'unhealthy' as const,
                durationMs: Math.round(finishedAt - startedAt),
                lastRunAt: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Request failed',
              };
            }
          }),
        );

        setFunctionalHealthChecks(nextChecks);
        const unhealthyCount = nextChecks.filter((c) => c.status === 'unhealthy').length;
        if (unhealthyCount > 0) {
          showToast(`${unhealthyCount} functional check(s) failed.`, 'error');
        } else {
          showToast('All functional checks passed.', 'success');
        }
      } catch (err) { console.error(err);
        showToast('Functional health checks failed.', 'error');
      } finally {
        setIsFunctionalHealthChecking(false);
      }
    });
  }, [functionalHealthChecks, showToast]);

  // Auto-run both checks once on mount
  useEffect(() => {
    if (hasAutoRun || isSchemaSyncChecking) {
      return;
    }
    setHasAutoRun(true);
    runSchemaSyncHealthCheck();
    runFunctionalHealthChecks();
    runFinanceIntegrityCheck();
  }, [hasAutoRun, isSchemaSyncChecking, runFinanceIntegrityCheck, runFunctionalHealthChecks, runSchemaSyncHealthCheck]);

  function downloadSchemaHealthReport() {
    if (!schemaSyncHealth || typeof window === 'undefined') {
      return;
    }

    const reportPayload = {
      ...schemaSyncHealth,
      duration_ms: schemaSyncDurationMs,
      downloaded_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(reportPayload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `schema-health-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <AdminHealthView
      schemaSyncHealth={schemaSyncHealth}
      schemaSyncDurationMs={schemaSyncDurationMs}
      isSchemaSyncChecking={isSchemaSyncChecking}
      functionalHealthChecks={functionalHealthChecks}
      isFunctionalHealthChecking={isFunctionalHealthChecking}
      financeIntegrityHealth={financeIntegrityHealth}
      financeIntegrityDurationMs={financeIntegrityDurationMs}
      isFinanceIntegrityChecking={isFinanceIntegrityChecking}
      isPending={isPending}
      onRunSchemaSyncHealthCheck={runSchemaSyncHealthCheck}
      onRunFunctionalHealthChecks={runFunctionalHealthChecks}
      onRunFinanceIntegrityCheck={runFinanceIntegrityCheck}
      onDownloadSchemaHealthReport={downloadSchemaHealthReport}
    />
  );
}
