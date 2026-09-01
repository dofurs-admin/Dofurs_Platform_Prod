'use client';

import 'leaflet/dist/leaflet.css';
import { Fragment, useEffect, useMemo } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Maximize2 } from 'lucide-react';
import type { BookingStatus } from '@/lib/bookings/types';
import { formatServiceCoveragePincode } from '@/lib/service-coverage';
import { haversineDistanceKm } from '@/lib/utils/geo-distance';
import {
  GAZE_BOOKING_STATUS_COLORS,
  GAZE_HEAT_BUBBLE_TIERS,
  resolveHeatBubbleForCount,
  type GazeBookingPoint,
  type GazeCoverageEntry,
  type GazeCoverageGap,
  type GazePincodeStat,
  type GazeProviderPoint,
} from '@/lib/gaze/aggregates';

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

const GROOMER_ACTIVE_COLOR = '#0f766e';
const GROOMER_INACTIVE_COLOR = '#94a3b8';
const COVERAGE_GAP_COLOR = '#dc2626';

type GazeMapProps = {
  bookings: GazeBookingPoint[];
  providers: GazeProviderPoint[];
  pincodeStats: GazePincodeStat[];
  coverage: GazeCoverageEntry[];
  coverageGaps: GazeCoverageGap[];
  showHeatLayer: boolean;
  showBookingPins: boolean;
  showGroomers: boolean;
  showCoverage: boolean;
  showCoverageGaps: boolean;
  /**
   * Increments whenever the map should auto-fit the area of interest: the
   * first load of a filter context, a filter change, or the "Fit view" button.
   * Background data refreshes do not bump it, so the operator's zoom sticks.
   */
  fitToken: number;
  onRequestFit: () => void;
};

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function InvalidateSize() {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

/**
 * Points further than this from the robust median center are treated as stray
 * coordinates and skipped by the auto-fit, so a single mis-mapped marker
 * cannot zoom the view out to a national scale.
 */
const AREA_OF_INTEREST_RADIUS_KM = 40;

function computeAreaOfInterestCoordinates(coordinates: [number, number][]): [number, number][] {
  if (coordinates.length <= 2) {
    return coordinates;
  }

  const sortedLatitudes = coordinates.map((coordinate) => coordinate[0]).sort((left, right) => left - right);
  const sortedLongitudes = coordinates.map((coordinate) => coordinate[1]).sort((left, right) => left - right);
  const medianLat = sortedLatitudes[Math.floor(sortedLatitudes.length / 2)];
  const medianLng = sortedLongitudes[Math.floor(sortedLongitudes.length / 2)];

  const nearbyCoordinates = coordinates.filter(
    (coordinate) =>
      haversineDistanceKm(medianLat, medianLng, coordinate[0], coordinate[1]) <= AREA_OF_INTEREST_RADIUS_KM,
  );

  // When the points are genuinely spread far apart (for example a future
  // multi-city rollout) the wide view is correct, so fall back to all points.
  return nearbyCoordinates.length > 0 ? nearbyCoordinates : coordinates;
}

function FitBoundsToData({ coordinates, fitToken }: { coordinates: [number, number][]; fitToken: number }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length === 0) {
      return;
    }

    const areaOfInterest = computeAreaOfInterestCoordinates(coordinates);
    const bounds = L.latLngBounds(areaOfInterest.map((coordinate) => L.latLng(coordinate[0], coordinate[1])));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    // Fitting is driven by an explicit token (first load of a filter context,
    // a filter change, or the "Fit view" button) so background refreshes never
    // reset the operator's zoom or pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitToken]);

  return null;
}

function buildGroomerMarkerIcon(provider: GazeProviderPoint) {
  const markerColor = provider.accountStatus === 'active' ? GROOMER_ACTIVE_COLOR : GROOMER_INACTIVE_COLOR;
  const glyph = provider.providerType === 'clinic' ? '🏥' : provider.providerType === 'veterinarian' ? '🩺' : '✂️';

  return L.divIcon({
    className: 'dofurs-gaze-provider-marker',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:#ffffff;border:2px solid ${markerColor};box-shadow:0 1px 4px rgba(15,23,42,0.25);font-size:13px;line-height:1;">${glyph}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
}

type MappableBooking = GazeBookingPoint & { latitude: number; longitude: number };

function isMappableBooking(booking: GazeBookingPoint): booking is MappableBooking {
  return booking.latitude !== null && booking.longitude !== null;
}

export default function GazeMap({
  bookings,
  providers,
  pincodeStats,
  coverage,
  coverageGaps,
  showHeatLayer,
  showBookingPins,
  showGroomers,
  showCoverage,
  showCoverageGaps,
  fitToken,
  onRequestFit,
}: GazeMapProps) {
  const maxPincodeBookingCount = useMemo(
    () => pincodeStats.reduce((max, stat) => Math.max(max, stat.bookingCount), 0),
    [pincodeStats],
  );

  const coverageGapPincodes = useMemo(() => new Set(coverageGaps.map((gap) => gap.pincode)), [coverageGaps]);

  const coverageByProviderId = useMemo(() => {
    const map = new Map<number, GazeCoverageEntry>();

    for (const entry of coverage) {
      map.set(entry.providerId, entry);
    }

    return map;
  }, [coverage]);

  const fitBoundsCoordinates = useMemo<[number, number][]>(() => {
    const coordinates: [number, number][] = [];

    if (showHeatLayer || showCoverageGaps) {
      for (const stat of pincodeStats) {
        if (stat.centroidLat !== null && stat.centroidLng !== null) {
          coordinates.push([stat.centroidLat, stat.centroidLng]);
        }
      }
    }

    if (showGroomers) {
      for (const provider of providers) {
        if (provider.latitude !== null && provider.longitude !== null) {
          coordinates.push([provider.latitude, provider.longitude]);
        }
      }
    }

    if (coordinates.length === 0 && showBookingPins) {
      for (const booking of bookings) {
        if (isMappableBooking(booking)) {
          coordinates.push([booking.latitude, booking.longitude]);
        }
      }
    }

    return coordinates;
  }, [bookings, pincodeStats, providers, showBookingPins, showCoverageGaps, showGroomers, showHeatLayer]);

  return (
    <div className="relative h-[62vh] min-h-[420px] w-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={11}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <InvalidateSize />
        <FitBoundsToData coordinates={fitBoundsCoordinates} fitToken={fitToken} />

        {showCoverage && showGroomers
          ? providers.map((provider) => {
              if (provider.latitude === null || provider.longitude === null) {
                return null;
              }

              const radiusMeters = provider.serviceRadiusKm != null && provider.serviceRadiusKm > 0
                ? provider.serviceRadiusKm * 1000
                : null;

              if (radiusMeters === null) {
                return null;
              }

              return (
                <Circle
                  key={`coverage-radius-${provider.id}`}
                  center={[provider.latitude, provider.longitude]}
                  radius={radiusMeters}
                  pathOptions={{
                    color: GROOMER_ACTIVE_COLOR,
                    weight: 1,
                    fillColor: GROOMER_ACTIVE_COLOR,
                    fillOpacity: 0.05,
                  }}
                />
              );
            })
          : null}

        {showHeatLayer || showCoverageGaps
          ? pincodeStats.map((stat) => {
              if (stat.centroidLat === null || stat.centroidLng === null) {
                return null;
              }

              const bubble = showHeatLayer
                ? resolveHeatBubbleForCount(stat.bookingCount, maxPincodeBookingCount)
                : null;
              const isGap = showCoverageGaps && coverageGapPincodes.has(stat.pincode);

              return (
                <Fragment key={`pincode-${stat.pincode}`}>
                  {isGap ? (
                    <Circle
                      center={[stat.centroidLat, stat.centroidLng]}
                      radius={2800}
                      pathOptions={{
                        color: COVERAGE_GAP_COLOR,
                        weight: 2,
                        dashArray: '6 6',
                        fillColor: COVERAGE_GAP_COLOR,
                        fillOpacity: 0.06,
                      }}
                    >
                      <Popup>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-neutral-950">
                            Pincode {stat.pincode} — no active coverage
                          </p>
                          <p className="text-xs text-neutral-600">
                            {stat.bookingCount} booking(s) of demand without an enabled provider service.
                          </p>
                        </div>
                      </Popup>
                    </Circle>
                  ) : null}
                  {bubble ? (
                    <Circle
                      center={[stat.centroidLat, stat.centroidLng]}
                      radius={bubble.radiusMeters}
                      pathOptions={{
                        color: bubble.color,
                        weight: 1,
                        fillColor: bubble.fillColor,
                        fillOpacity: bubble.fillOpacity,
                      }}
                    >
                      <Popup>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-neutral-950">Pincode {stat.pincode}</p>
                          <p className="text-xs text-neutral-600">{stat.city ?? 'Bengaluru'}</p>
                          <p className="text-xs text-neutral-600">
                            {stat.bookingCount} booking(s) · {stat.completedCount} completed ·{' '}
                            {stat.cancelledCount + stat.noShowCount} lost
                          </p>
                          <p className="text-xs text-neutral-600">Booking value {formatInr(stat.bookingValueInr)}</p>
                        </div>
                      </Popup>
                    </Circle>
                  ) : null}
                </Fragment>
              );
            })
          : null}

        {showBookingPins
          ? bookings.filter(isMappableBooking).map((booking) => (
              <CircleMarker
                key={`booking-${booking.id}`}
                center={[booking.latitude, booking.longitude]}
                radius={5}
                pathOptions={{
                  color: '#ffffff',
                  weight: 1,
                  fillColor: GAZE_BOOKING_STATUS_COLORS[booking.status],
                  fillOpacity: 0.9,
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-neutral-950">
                      #{booking.id} · {BOOKING_STATUS_LABELS[booking.status]}
                    </p>
                    {booking.customerName ? (
                      <p className="text-xs text-neutral-600">Customer: {booking.customerName}</p>
                    ) : null}
                    {booking.providerName ? (
                      <p className="text-xs text-neutral-600">Groomer: {booking.providerName}</p>
                    ) : null}
                    <p className="text-xs text-neutral-600">
                      {booking.bookingDate ?? 'Date pending'}
                      {booking.startTime ? ` · ${booking.startTime}` : ''}
                      {booking.bookingMode ? ` · ${booking.bookingMode.replace(/_/g, ' ')}` : ''}
                    </p>
                    {booking.amountInr != null ? (
                      <p className="text-xs text-neutral-600">Value {formatInr(booking.amountInr)}</p>
                    ) : null}
                    {booking.locationAddress ? (
                      <p className="text-xs text-neutral-600">{booking.locationAddress}</p>
                    ) : null}
                  </div>
                </Popup>
              </CircleMarker>
            ))
          : null}

        {showGroomers
          ? providers.map((provider) => {
              if (provider.latitude === null || provider.longitude === null) {
                return null;
              }

              const coverageEntry = coverageByProviderId.get(provider.id);
              const coverageLabels = (coverageEntry?.pincodes ?? []).map(formatServiceCoveragePincode);
              const shownCoverageLabels = coverageLabels.slice(0, 8);

              return (
                <Marker
                  key={`provider-${provider.id}`}
                  position={[provider.latitude, provider.longitude]}
                  icon={buildGroomerMarkerIcon(provider)}
                >
                  <Tooltip direction="top" offset={[0, -16]}>
                    {provider.name}
                  </Tooltip>
                  <Popup>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-neutral-950">{provider.name}</p>
                      <p className="text-xs text-neutral-600">
                        {(provider.providerType ?? 'provider').replace(/_/g, ' ')} ·{' '}
                        {provider.accountStatus ?? 'unknown status'}
                      </p>
                      {provider.serviceRadiusKm != null && provider.serviceRadiusKm > 0 ? (
                        <p className="text-xs text-neutral-600">Service radius {provider.serviceRadiusKm} km</p>
                      ) : null}
                      {shownCoverageLabels.length > 0 ? (
                        <p className="text-xs text-neutral-600">
                          Serves: {shownCoverageLabels.join(', ')}
                          {coverageLabels.length > shownCoverageLabels.length
                            ? ` +${coverageLabels.length - shownCoverageLabels.length} more`
                            : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-neutral-500">No serviceable pincodes configured</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })
          : null}
      </MapContainer>

      <button
        type="button"
        onClick={onRequestFit}
        title="Zoom to fit the current area of interest"
        className="absolute right-3 top-3 z-[600] inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/95 px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm backdrop-blur-sm transition hover:border-neutral-300 hover:text-neutral-950"
      >
        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        Fit view
      </button>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[600] flex max-w-[calc(100%-1.5rem)] flex-col gap-1.5 rounded-xl border border-neutral-200/80 bg-white/95 px-3 py-2.5 shadow-soft-md backdrop-blur-sm">
        {showHeatLayer ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Demand</span>
            <span className="flex items-center gap-1">
              {GAZE_HEAT_BUBBLE_TIERS.map((tier) => (
                <span
                  key={tier.fillColor}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: tier.fillColor }}
                />
              ))}
              <span className="text-[10px] text-neutral-500">low → high</span>
            </span>
          </div>
        ) : null}
        {showGroomers ? (
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full border-2 bg-white"
              style={{ borderColor: GROOMER_ACTIVE_COLOR }}
            />
            <span className="text-[10px] text-neutral-600">Groomer / clinic base</span>
          </div>
        ) : null}
        {showCoverage && showGroomers ? (
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full border"
              style={{ backgroundColor: 'rgba(15, 118, 110, 0.1)', borderColor: GROOMER_ACTIVE_COLOR }}
            />
            <span className="text-[10px] text-neutral-600">Coverage radius</span>
          </div>
        ) : null}
        {showCoverageGaps ? (
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full border-2 border-dashed bg-transparent"
              style={{ borderColor: COVERAGE_GAP_COLOR }}
            />
            <span className="text-[10px] text-neutral-600">Demand without coverage</span>
          </div>
        ) : null}
        {showBookingPins ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Status</span>
            <span className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(GAZE_BOOKING_STATUS_COLORS) as BookingStatus[]).map((status) => (
                <span key={status} className="flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: GAZE_BOOKING_STATUS_COLORS[status] }}
                  />
                  <span className="text-[10px] text-neutral-600">{BOOKING_STATUS_LABELS[status]}</span>
                </span>
              ))}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
