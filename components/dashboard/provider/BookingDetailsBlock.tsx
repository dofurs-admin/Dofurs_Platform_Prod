'use client';

import { formatProviderMode } from './providerFormatters';
import {
  BOOKING_CHIP_CLASS,
  BOOKING_LABEL_CLASS,
  BOOKING_META_TEXT_ADDRESS_CLASS,
  BOOKING_META_TEXT_CLASS,
  BOOKING_META_TEXT_TIGHT_CLASS,
} from './bookingCardTokens';

type Props = {
  serviceType: string | null | undefined;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  customerName: string | null | undefined;
  petName: string | null | undefined;
  ownerPhone: string | null | undefined;
  locationAddress: string | null | undefined;
  latitude?: number | null;
  longitude?: number | null;
  showAcceptedPill?: boolean;
};

function buildDirectionsUrl(
  lat: number | null | undefined,
  lng: number | null | undefined,
  address: string | null | undefined,
): string | null {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return null;
}

export default function BookingDetailsBlock({
  serviceType,
  bookingMode,
  customerName,
  petName,
  ownerPhone,
  locationAddress,
  latitude,
  longitude,
  showAcceptedPill = false,
}: Props) {
  const directionsUrl =
    bookingMode === 'home_visit'
      ? buildDirectionsUrl(latitude, longitude, locationAddress)
      : null;
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={BOOKING_CHIP_CLASS}>{serviceType ?? 'Service'}</span>
        <span className={BOOKING_CHIP_CLASS}>{formatProviderMode(bookingMode)}</span>
        {showAcceptedPill ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.02em] text-emerald-700 ring-1 ring-emerald-200 sm:text-[11px]">
            Accepted
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-1.5 sm:grid-cols-2 sm:gap-2">
        <p className={BOOKING_META_TEXT_CLASS}>
          <span className={BOOKING_LABEL_CLASS}>Customer:</span> {customerName ?? 'Not available'}
        </p>
        <p className={BOOKING_META_TEXT_CLASS}>
          <span className={BOOKING_LABEL_CLASS}>Pet:</span> {petName ?? 'Not available'}
        </p>
        <p className={BOOKING_META_TEXT_TIGHT_CLASS}>
          <span className={BOOKING_LABEL_CLASS}>Phone:</span> {ownerPhone ?? 'Not available'}
        </p>
        <p className={BOOKING_META_TEXT_ADDRESS_CLASS} title={locationAddress ?? 'Not available'}>
          <span className={BOOKING_LABEL_CLASS}>Address:</span> {locationAddress ?? 'Not available'}
        </p>
      </div>

      {directionsUrl && (
        <div className="mt-3">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#e7c4a7] bg-[#fff8f0] px-3 py-1 text-[11px] font-semibold text-[#b25f27] transition-colors hover:bg-[#fdf0e4] sm:text-xs"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-3 w-3 shrink-0"
            >
              <path
                fillRule="evenodd"
                d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.083 3.602-5.017 3.602-8.532 0-4.636-3.664-8.101-8-8.101S4 4.715 4 9.335c0 3.515 1.658 6.449 3.602 8.532a19.58 19.58 0 002.683 2.282 16.975 16.975 0 001.144.742l.07.04.028.016zM12 13.085a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z"
                clipRule="evenodd"
              />
            </svg>
            Get Directions
          </a>
        </div>
      )}
    </>
  );
}
