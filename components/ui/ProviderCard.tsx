'use client';

import Image from 'next/image';
import Link from 'next/link';

export type ProviderCardProps = {
  id: number;
  name: string;
  providerType?: string | null;
  profilePhotoUrl?: string | null;
  averageRating?: number | null;
  totalBookings?: number | null;
  basePrice?: number | null;
  availableSlotCount?: number | null;
  isVerified?: boolean;
  bookingHref?: string;
  onBook?: (providerId: number) => void;
};

function StarRating({ rating }: { rating: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600">
      <svg className="h-3.5 w-3.5 fill-amber-400" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      {rounded.toFixed(1)}
    </span>
  );
}

function formatProviderType(value: string | null | undefined) {
  if (!value) return null;
  const map: Record<string, string> = {
    groomer: 'Groomer',
    vet: 'Vet',
    trainer: 'Trainer',
    sitter: 'Pet Sitter',
    clinic: 'Clinic',
  };
  return map[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

export default function ProviderCard({
  id,
  name,
  providerType,
  profilePhotoUrl,
  averageRating,
  totalBookings,
  basePrice,
  availableSlotCount,
  isVerified,
  bookingHref,
  onBook,
}: ProviderCardProps) {
  const displayType = formatProviderType(providerType);
  const hasSlots = typeof availableSlotCount === 'number' && availableSlotCount > 0;
  const noSlots = typeof availableSlotCount === 'number' && availableSlotCount === 0;

  return (
    <div className="flex flex-col rounded-3xl border border-[#e7c4a7] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_100%)] p-5 shadow-[0_10px_22px_rgba(147,101,63,0.1)] transition-shadow duration-200 hover:shadow-[0_16px_30px_rgba(147,101,63,0.14)]">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-brand-100">
          {profilePhotoUrl ? (
            <Image src={profilePhotoUrl} alt={name} fill className="object-cover" sizes="56px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-brand-600">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          {isVerified && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-neutral-950">{name}</h3>
          {displayType && (
            <p className="mt-0.5 text-xs font-medium text-neutral-500">{displayType}</p>
          )}
          {typeof averageRating === 'number' && averageRating > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <StarRating rating={averageRating} />
              {typeof totalBookings === 'number' && (
                <span className="text-xs text-neutral-400">{totalBookings} visits</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Details row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {typeof basePrice === 'number' && (
          <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
            From ₹{basePrice}
          </span>
        )}
        {hasSlots && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {availableSlotCount} slot{availableSlotCount !== 1 ? 's' : ''} today
          </span>
        )}
        {noSlots && (
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-500">
            No slots today
          </span>
        )}
        {isVerified && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            ✓ Verified
          </span>
        )}
      </div>

      {/* CTA */}
      <div className="mt-5">
        {bookingHref ? (
          <Link
            href={bookingHref}
            className="block w-full rounded-xl bg-[linear-gradient(135deg,#e49a57,#cf8347)] py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Book Now
          </Link>
        ) : onBook ? (
          <button
            type="button"
            onClick={() => onBook(id)}
            className="block w-full rounded-xl bg-[linear-gradient(135deg,#e49a57,#cf8347)] py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Book Now
          </button>
        ) : null}
      </div>
    </div>
  );
}
