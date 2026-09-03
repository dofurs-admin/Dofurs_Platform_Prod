'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Flame, MapPin, Radar, RefreshCw, Scissors, Target, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { useSearchParams } from 'next/navigation';
import { BOOKING_MODES, BOOKING_STATUSES, type BookingMode, type BookingStatus } from '@/lib/bookings/types';
import type { GazeOverviewResponse, GazeWindowKey } from '@/lib/gaze/aggregates';
import { CRM_SOURCE_LABELS } from '@/lib/crm/labels';
import { aggregateLeadsByArea, buildGazeLeadKpis, type GazeLeadPoint } from '@/lib/gaze/leads';

// Shared CRM source vocabulary (lib/crm/labels.ts) — widened because
// GazeLeadPoint.source is a plain string, not the CrmLeadSource union.
const LEAD_SOURCE_LABELS = CRM_SOURCE_LABELS as Record<string, string>;

type GazeLeadStatusFilter = 'all' | 'open' | 'hot' | 'converted' | 'lost' | 'cancelled';

const GazeMap = dynamic(() => import('@/components/dashboard/admin/gaze/GazeMap'), {
  ssr: false,
  loading: () => <div className="h-[62vh] min-h-[420px] w-full animate-pulse rounded-2xl bg-neutral-100" />,
});

const WINDOW_OPTIONS: Array<{ key: GazeWindowKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'alltime', label: 'All time' },
  { key: 'custom', label: 'Custom range' },
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

const MODE_LABELS: Record<BookingMode, string> = {
  home_visit: 'Home visit',
  clinic_visit: 'Clinic visit',
  teleconsult: 'Teleconsult',
};

type GazeLayerKey = 'heat' | 'pins' | 'groomers' | 'coverage' | 'gaps' | 'leads';

type GazeLayerDefinition = {
  key: GazeLayerKey;
  label: string;
  icon: LucideIcon;
  note?: string;
};

const LAYER_DEFINITIONS: GazeLayerDefinition[] = [
  { key: 'heat', label: 'Booking heat', icon: Flame },
  { key: 'pins', label: 'Exact booking pins', icon: MapPin, note: 'Shows customer locations' },
  { key: 'groomers', label: 'Groomers', icon: Scissors },
  { key: 'coverage', label: 'Coverage radius', icon: Radar },
  { key: 'gaps', label: 'Coverage gaps', icon: TriangleAlert },
  { key: 'leads', label: 'Lead demand', icon: Target, note: 'CRM leads by Bengaluru area' },
];

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

function formatUpdatedAt(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);

  if (Number.isNaN(parsed.getTime())) {
    return 'just now';
  }

  return parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatWindowRange(windowInfo: GazeOverviewResponse['window']): string {
  if (windowInfo.key === 'alltime' || !windowInfo.fromDate || !windowInfo.toDate) {
    return 'All time';
  }

  if (windowInfo.fromDate === windowInfo.toDate) {
    return windowInfo.fromDate;
  }

  return `${windowInfo.fromDate} → ${windowInfo.toDate}`;
}

/**
 * Identifies the filter context a dataset was loaded under. The map auto-fits
 * at most once per signature, so identical refetches (auto-refresh, manual
 * refresh) never reset the operator's zoom or pan.
 */
function buildGazeFitSignature(params: {
  windowKey: GazeWindowKey;
  fromDate: string;
  toDate: string;
  statusFilter: 'all' | BookingStatus;
  modeFilter: 'all' | BookingMode;
  providerFilter: 'all' | number;
}) {
  return [
    params.windowKey,
    params.fromDate,
    params.toDate,
    params.statusFilter,
    params.modeFilter,
    String(params.providerFilter),
  ].join('|');
}

export default function GazeTab() {
  const { showToast } = useToast();

  // C2: the active window + filters live in the URL — refresh-stable views and
  // shareable links (e.g. /dashboard/admin/gaze?window=7d&status=completed).
  const searchParams = useSearchParams();

  const [windowKey, setWindowKey] = useState<GazeWindowKey>(() => {
    const value = searchParams.get('window');
    return WINDOW_OPTIONS.some((option) => option.key === value) ? (value as GazeWindowKey) : '30d';
  });
  const [fromDate, setFromDate] = useState(() => (windowKey === 'custom' ? (searchParams.get('fromDate') ?? '') : ''));
  const [toDate, setToDate] = useState(() => (windowKey === 'custom' ? (searchParams.get('toDate') ?? '') : ''));
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>(() => {
    const value = searchParams.get('status');
    return value !== null && BOOKING_STATUSES.includes(value as BookingStatus) ? (value as BookingStatus) : 'all';
  });
  const [modeFilter, setModeFilter] = useState<'all' | BookingMode>(() => {
    const value = searchParams.get('mode');
    return value !== null && BOOKING_MODES.includes(value as BookingMode) ? (value as BookingMode) : 'all';
  });
  const [providerFilter, setProviderFilter] = useState<'all' | number>(() => {
    const value = Number(searchParams.get('providerId'));
    return Number.isInteger(value) && value > 0 ? value : 'all';
  });
  const [enabledLayers, setEnabledLayers] = useState<Record<GazeLayerKey, boolean>>({
    heat: true,
    pins: false,
    groomers: true,
    coverage: true,
    gaps: true,
    leads: true,
  });

  const [leadStatusFilter, setLeadStatusFilter] = useState<GazeLeadStatusFilter>('all');
  const [leadSourceFilter, setLeadSourceFilter] = useState<'all' | string>('all');

  const [overview, setOverview] = useState<GazeOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [fitRequestToken, setFitRequestToken] = useState(0);
  const [loadedFilterSignature, setLoadedFilterSignature] = useState<string | null>(null);
  const lastFittedSignatureRef = useRef<string | null>(null);

  const loadOverview = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams();
      params.set('window', windowKey);

      if (windowKey === 'custom') {
        if (fromDate) {
          params.set('fromDate', fromDate);
        }

        if (toDate) {
          params.set('toDate', toDate);
        }
      }

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      if (modeFilter !== 'all') {
        params.set('mode', modeFilter);
      }

      if (providerFilter !== 'all') {
        params.set('providerId', String(providerFilter));
      }

      try {
        const response = await fetch(`/api/admin/gaze?${params.toString()}`, { signal, credentials: 'same-origin' });

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorPayload?.error ?? `Gaze request failed (${response.status})`);
        }

        const payload = (await response.json()) as GazeOverviewResponse;
        setOverview(payload);
        setLoadedFilterSignature(
          buildGazeFitSignature({ windowKey, fromDate, toDate, statusFilter, modeFilter, providerFilter }),
        );
        setLoadError(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to load the gaze overview.';
        setLoadError(message);
        showToast(message, 'error');
      }
    },
    [fromDate, modeFilter, providerFilter, showToast, statusFilter, toDate, windowKey],
  );

  // Reload whenever the selected filters change.
  useEffect(() => {
    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);

    loadOverview(controller.signal).finally(() => {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    });

    return () => controller.abort();
  }, [loadOverview]);

  // Light auto-refresh keeps the operations view current while the tab is visible.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadOverview();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [loadOverview]);

  // Mirror the active window + filters into the URL via the native history API
  // (no navigation round-trip; refresh restores the view).
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('window', windowKey);
    if (windowKey === 'custom') {
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
    }
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (modeFilter !== 'all') params.set('mode', modeFilter);
    if (providerFilter !== 'all') params.set('providerId', String(providerFilter));
    window.history.replaceState(null, '', `/dashboard/admin/gaze?${params.toString()}`);
  }, [fromDate, modeFilter, providerFilter, statusFilter, toDate, windowKey]);

  // Auto-fit the map once per filter context (first load or filter change).
  // Background refreshes reuse the same signature, so they never reset the
  // operator's zoom or pan; the map's "Fit view" button re-fits on demand.
  useEffect(() => {
    if (!overview || loadedFilterSignature === null) {
      return;
    }

    if (lastFittedSignatureRef.current === loadedFilterSignature) {
      return;
    }

    lastFittedSignatureRef.current = loadedFilterSignature;
    setFitRequestToken((token) => token + 1);
  }, [loadedFilterSignature, overview]);

  function handleRequestFit() {
    setFitRequestToken((token) => token + 1);
  }

  function toggleLayer(key: GazeLayerKey) {
    setEnabledLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  const topPincodeStats = useMemo(() => overview?.pincodeStats.slice(0, 8) ?? [], [overview]);
  const topCoverageGaps = useMemo(() => overview?.coverageGaps.slice(0, 8) ?? [], [overview]);
  const providerOptions = useMemo(() => overview?.providers ?? [], [overview]);

  // Lead-layer filters are applied client-side using the same pure aggregation
  // functions the API uses, so filtering is instant with no refetch.
  const filteredLeadPoints = useMemo<GazeLeadPoint[]>(() => {
    if (!overview) {
      return [];
    }

    return overview.leads.filter((lead) => {
      if (leadStatusFilter === 'hot') {
        if (!(lead.isHot && lead.phase === 'open')) return false;
      } else if (leadStatusFilter !== 'all' && lead.phase !== leadStatusFilter) {
        return false;
      }

      if (leadSourceFilter !== 'all' && lead.source !== leadSourceFilter) {
        return false;
      }

      return true;
    });
  }, [overview, leadStatusFilter, leadSourceFilter]);

  const visibleLeadAreas = useMemo(() => aggregateLeadsByArea(filteredLeadPoints), [filteredLeadPoints]);
  const visibleLeadKpis = useMemo(() => buildGazeLeadKpis(filteredLeadPoints), [filteredLeadPoints]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Window</span>
            <select
              value={windowKey}
              onChange={(event) => setWindowKey(event.target.value as GazeWindowKey)}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 outline-none transition focus:border-coral/60"
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {windowKey === 'custom' ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 outline-none transition focus:border-coral/60"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 outline-none transition focus:border-coral/60"
                />
              </label>
            </>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | BookingStatus)}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 outline-none transition focus:border-coral/60"
            >
              <option value="all">All statuses</option>
              {BOOKING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Mode</span>
            <select
              value={modeFilter}
              onChange={(event) => setModeFilter(event.target.value as 'all' | BookingMode)}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 outline-none transition focus:border-coral/60"
            >
              <option value="all">All modes</option>
              {BOOKING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Groomer</span>
            <select
              value={providerFilter === 'all' ? 'all' : String(providerFilter)}
              onChange={(event) =>
                setProviderFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))
              }
              className="h-9 max-w-[180px] rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 outline-none transition focus:border-coral/60"
            >
              <option value="all">All groomers</option>
              {providerOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => loadOverview()}
            disabled={isLoading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-coral px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#cf8448] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {LAYER_DEFINITIONS.map((layer) => {
            const LayerIcon = layer.icon;
            const isActive = enabledLayers[layer.key];

            return (
              <button
                key={layer.key}
                type="button"
                onClick={() => toggleLayer(layer.key)}
                title={layer.note ?? `Toggle ${layer.label.toLowerCase()} layer`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'border-coral/60 bg-coral/10 text-coral'
                    : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
                }`}
              >
                <LayerIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {layer.label}
              </button>
            );
          })}
          {enabledLayers.pins ? (
            <span className="text-[11px] font-medium text-neutral-400">Exact customer locations are visible</span>
          ) : null}
        </div>

        {enabledLayers.leads ? (
          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200/70 bg-neutral-50/60 px-3 py-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Lead status
              </span>
              <select
                value={leadStatusFilter}
                onChange={(event) => setLeadStatusFilter(event.target.value as GazeLeadStatusFilter)}
                className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 outline-none transition focus:border-coral/60"
              >
                <option value="all">All lead statuses</option>
                <option value="open">Open (pipeline)</option>
                <option value="hot">Hot only</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Lead source
              </span>
              <select
                value={leadSourceFilter}
                onChange={(event) => setLeadSourceFilter(event.target.value)}
                className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 outline-none transition focus:border-coral/60"
              >
                <option value="all">All sources</option>
                {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <span className="text-[11px] font-medium text-neutral-400">
              {formatCount(visibleLeadKpis.totalLeads)} lead(s) match · {formatCount(visibleLeadKpis.mappedLeads)} mapped to areas
            </span>

            {leadStatusFilter !== 'all' || leadSourceFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setLeadStatusFilter('all');
                  setLeadSourceFilter('all');
                }}
                className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
              >
                Clear lead filters
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
          {loadError && !overview ? (
            <div className="flex h-[62vh] min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center">
              <TriangleAlert className="h-8 w-8 text-neutral-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-neutral-700">Gaze is unavailable right now</p>
              <p className="max-w-sm text-xs text-neutral-500">{loadError}</p>
              <button
                type="button"
                onClick={() => loadOverview()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : overview ? (
            <>
              <GazeMap
                bookings={overview.bookings}
                providers={overview.providers}
                pincodeStats={overview.pincodeStats}
                pincodeCentroids={overview.pincodeCentroids}
                coverage={overview.coverage}
                coverageGaps={overview.coverageGaps}
                leadAreas={visibleLeadAreas}
                showHeatLayer={enabledLayers.heat}
                showBookingPins={enabledLayers.pins}
                showGroomers={enabledLayers.groomers}
                showCoverage={enabledLayers.coverage}
                showCoverageGaps={enabledLayers.gaps}
                showLeadAreas={enabledLayers.leads}
                fitToken={fitRequestToken}
                onRequestFit={handleRequestFit}
              />
              {overview.bookings.length === 0 ? (
                <div className="pointer-events-none absolute inset-x-0 top-3 z-[600] flex justify-center">
                  <span className="rounded-full border border-neutral-200/80 bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-500 shadow-sm backdrop-blur-sm">
                    No bookings match the selected filters for this window.
                  </span>
                </div>
              ) : null}
              {overview.bookingsTruncated ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[600] flex justify-center">
                  <span className="rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1.5 text-[11px] font-medium text-amber-700 shadow-sm backdrop-blur-sm">
                    Showing the {formatCount(overview.bookings.length)} most recent bookings in this window.
                  </span>
                </div>
              ) : null}
              {overview.leadsTruncated ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-14 z-[600] flex justify-center">
                  <span className="rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1.5 text-[11px] font-medium text-amber-700 shadow-sm backdrop-blur-sm">
                    Showing the {formatCount(overview.leads.length)} most recent leads in this window.
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="h-[62vh] min-h-[420px] w-full animate-pulse bg-neutral-100" />
          )}
        </div>

        <aside className="space-y-4">
          {overview ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="Bookings" value={formatCount(overview.kpis.totalBookings)} />
                <KpiCard label="Booking value" value={formatInr(overview.kpis.totalBookingValueInr)} />
                <KpiCard label="Completed" value={formatCount(overview.kpis.completedCount)} />
                <KpiCard label="Jobs today" value={formatCount(overview.kpis.jobsToday)} />
                <KpiCard label="Active groomers" value={formatCount(overview.kpis.activeGroomers)} />
                <KpiCard
                  label="Coverage gaps"
                  value={formatCount(overview.kpis.coverageGapCount)}
                  tone={overview.kpis.coverageGapCount > 0 ? 'warning' : 'default'}
                />
                <KpiCard
                  label="Leads"
                  value={formatCount(visibleLeadKpis.totalLeads)}
                  hint={`${formatCount(visibleLeadKpis.mappedLeads)} mapped to areas`}
                />
                <KpiCard
                  label="Open leads"
                  value={formatCount(visibleLeadKpis.openLeads)}
                  hint={visibleLeadKpis.hotLeads > 0 ? `${formatCount(visibleLeadKpis.hotLeads)} hot` : undefined}
                  tone={visibleLeadKpis.openLeads > 0 ? 'warning' : 'default'}
                />
              </div>

              <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-neutral-950">Top areas</h3>
                  <span className="text-[11px] font-medium text-neutral-400">
                    {formatWindowRange(overview.window)}
                  </span>
                </div>
                {topPincodeStats.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {topPincodeStats.map((stat) => (
                      <li key={stat.pincode} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-neutral-800">{stat.pincode}</span>
                        <span className="text-neutral-500">
                          {formatCount(stat.bookingCount)} · {formatInr(stat.bookingValueInr)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-neutral-500">No pincode demand in this window yet.</p>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-neutral-950">Top lead areas</h3>
                  <span className="text-[11px] font-medium text-neutral-400">
                    {formatCount(visibleLeadKpis.mappedLeads)} mapped
                  </span>
                </div>
                {visibleLeadAreas.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {visibleLeadAreas.slice(0, 6).map((area) => (
                      <li key={area.areaSlug} className="flex items-center justify-between gap-2 text-xs">
                        <Link
                          href={`/dashboard/admin/crm?area=${area.areaSlug}&areaName=${encodeURIComponent(area.areaName)}&status=open`}
                          className="font-semibold text-neutral-800 underline decoration-transparent underline-offset-2 transition hover:text-coral hover:decoration-coral/40"
                          title="Open this area's open leads in the CRM"
                        >
                          {area.areaName}
                        </Link>
                        <span className="text-neutral-500">
                          {formatCount(area.leadCount)} lead(s) · {formatCount(area.openCount)} open ·{' '}
                          {Math.round(area.conversionRate * 100)}% conv
                          {area.hotCount > 0 ? ` · ${formatCount(area.hotCount)} hot` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-neutral-500">
                    No area-matched leads in this window. Leads without a recognized Bengaluru area are
                    excluded from the map.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-neutral-950">Lead data health</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-neutral-400">Area matched</p>
                    <p className="mt-0.5 font-semibold text-neutral-800">
                      {formatCount(overview.leadDataQuality.areaMatched)}
                      <span className="font-normal text-neutral-400">
                        {' / '}
                        {formatCount(overview.leadDataQuality.totalLeads)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-neutral-400">With pincode</p>
                    <p className="mt-0.5 font-semibold text-neutral-800">
                      {formatCount(overview.leadDataQuality.withManualPincode)}
                    </p>
                  </div>
                </div>
                {overview.leadDataQuality.unmatchedWithAreaText > 0 ? (
                  <p className="mt-2 text-[11px] text-amber-700">
                    {formatCount(overview.leadDataQuality.unmatchedWithAreaText)} lead(s) have unrecognized area answers
                    (incl. junk) — they do not plot on the map.
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-neutral-950">Demand without coverage</h3>
                {topCoverageGaps.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {topCoverageGaps.map((gap) => (
                      <li key={gap.pincode} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-neutral-800">{gap.pincode}</span>
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          {formatCount(gap.bookingCount)} booking(s) uncovered
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-neutral-500">Every demand pincode has enabled provider coverage.</p>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
                  Gaps are pincodes with booking demand but no active provider service coverage.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
                  <span>Updated {formatUpdatedAt(overview.generatedAt)} · auto-refreshes every 60s</span>
                  <Link
                    href="/dashboard/admin/bookings"
                    className="font-semibold text-coral transition hover:underline"
                  >
                    Open bookings
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />
          )}
        </aside>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warning';
  hint?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 shadow-sm ${
        tone === 'warning' ? 'border-red-100 bg-red-50/60' : 'border-neutral-200/80 bg-white'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === 'warning' ? 'text-red-700' : 'text-neutral-950'}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] font-medium text-neutral-400">{hint}</p> : null}
    </div>
  );
}
