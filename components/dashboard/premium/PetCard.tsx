'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/design-system';

interface PetCardProps {
  id: number;
  name: string;
  breed?: string;
  age?: number;
  photo?: string;
  hasDisability?: boolean;
  accessRole?: 'owner' | 'manager' | 'viewer';
  ownerName?: string | null;
  completionPercent?: number;
  className?: string;
  onViewPassport?: (petId: number) => void;
}

export default function PetCard({
  id,
  name,
  breed,
  age,
  photo,
  hasDisability,
  accessRole,
  ownerName,
  completionPercent,
  className,
  onViewPassport,
}: PetCardProps) {
  const isSharedPet = accessRole === 'manager' || accessRole === 'viewer';
  const roleLabel = accessRole === 'manager' ? 'Manager' : accessRole === 'viewer' ? 'Viewer' : null;
  const normalizedCompletion =
    typeof completionPercent === 'number'
      ? Math.max(0, Math.min(100, Math.round(completionPercent)))
      : null;

  const badgeToneClass =
    normalizedCompletion === null
      ? ''
      : normalizedCompletion >= 80
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : normalizedCompletion >= 50
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-neutral-200 bg-neutral-50 text-neutral-700';

  const passportCtaClass =
    'relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-[#ca7d44] bg-[linear-gradient(135deg,#e49a57_0%,#cf8347_55%,#bf733c_100%)] px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(182,102,40,0.28)] transition-all duration-300 ease-out before:absolute before:inset-y-0 before:left-[-30%] before:w-1/3 before:skew-x-[-25deg] before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.42),transparent)] before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-0.5 hover:brightness-[1.04] hover:shadow-[0_16px_30px_rgba(182,102,40,0.4)] hover:before:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d89157]/50 focus-visible:ring-offset-1 sm:px-4 sm:py-2.5 sm:text-sm';

  return (
    <article
      className={cn(
        'card-interactive group relative flex h-full flex-col overflow-hidden border border-[#e7ceb9] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_65%,#fff7ef_100%)] shadow-[0_16px_34px_rgba(151,101,60,0.14)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(151,101,60,0.2)]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#f0c59f] to-transparent" aria-hidden="true" />

      {/* Photo */}
      {photo ? (
        <div className="relative h-28 w-full overflow-hidden bg-neutral-100 sm:h-40">
          <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-[#3f2816]/28 via-transparent to-transparent" aria-hidden="true" />
          {normalizedCompletion !== null ? (
            <div
              className={cn(
                'absolute right-2.5 top-2.5 z-10 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur-sm sm:right-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[11px]',
                badgeToneClass,
              )}
            >
              {normalizedCompletion}% complete
            </div>
          ) : null}
          <Image
            src={photo}
            alt={`${name} photo`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="relative flex h-28 w-full items-center justify-center bg-gradient-to-br from-[#fff4ea] via-[#fffaf5] to-[#f8eee4] text-4xl sm:h-40">
          {normalizedCompletion !== null ? (
            <div
              className={cn(
                'absolute right-2.5 top-2.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:right-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[11px]',
                badgeToneClass,
              )}
            >
              {normalizedCompletion}% complete
            </div>
          ) : null}
          <span>🐾</span>
        </div>
      )}

      {/* Info */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-6">
        {isSharedPet ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 sm:mb-3">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-blue-700 sm:text-[11px]">
              Shared
            </span>
            {roleLabel ? (
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] sm:text-[11px] ${
                  accessRole === 'manager'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-violet-200 bg-violet-50 text-violet-700'
                }`}
              >
                {roleLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Name */}
        <h3 className="text-base font-bold leading-tight text-neutral-950 sm:text-lg">{name}</h3>

        {isSharedPet ? (
          <p className="mt-1 text-xs text-neutral-600 sm:text-[13px]">
            Shared by {ownerName?.trim() ? ownerName : 'another owner'}
          </p>
        ) : null}

        {/* Breed and Age */}
        {(breed || age !== undefined) && (
          <div className="mt-2 min-h-[46px] flex flex-wrap items-center gap-1.5 text-sm leading-relaxed text-neutral-600 sm:mt-3 sm:min-h-[52px] sm:gap-2">
            {breed && <span className="rounded-full border border-[#e7d3c1] bg-[#fff8f2] px-2 py-0.5 text-[11px] font-medium text-[#67472f] sm:px-2.5 sm:py-1 sm:text-[12px]">{breed}</span>}
            {age !== undefined && age !== null && (
              <span className="rounded-full border border-[#e7d3c1] bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-600 sm:px-2.5 sm:py-1 sm:text-[12px]">
                {age} {age === 1 ? 'year' : 'years'} old
              </span>
            )}
            {hasDisability ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 sm:px-2.5 sm:py-1 sm:text-[12px]">
                Disability declared
              </span>
            ) : null}
          </div>
        )}
        {!(breed || age !== undefined) && <div className="mt-2 min-h-[46px] sm:mt-3 sm:min-h-[52px]" />}

        {/* View Passport Button */}
        <div className="mt-auto pt-3 sm:pt-4">
          {onViewPassport ? (
            <button
              type="button"
              onClick={() => onViewPassport(id)}
              className={passportCtaClass}
            >
              <span className="relative z-[1]">View Pet Passport</span>
              <svg className="relative z-[1] h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <Link href={`/dashboard/user/pets?pet=${id}`} className={passportCtaClass}>
              <span className="relative z-[1]">View Pet Passport</span>
              <svg className="relative z-[1] h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
