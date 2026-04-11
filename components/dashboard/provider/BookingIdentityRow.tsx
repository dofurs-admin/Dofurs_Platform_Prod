'use client';

import Image from 'next/image';
import { normalizeDisplayImageUrl } from '@/components/dashboard/user/petUtils';
import { BOOKING_OWNER_AVATAR_CLASS, BOOKING_PET_AVATAR_CLASS } from './bookingCardTokens';

type Props = {
  bookingId: number;
  dateTimeLabel: string;
  mobileDateTimeLabel?: string;
  petName?: string | null;
  ownerName?: string | null;
  petPhotoUrl?: string | null;
  ownerPhotoUrl?: string | null;
  petImageSizes?: string;
  ownerImageSizes?: string;
};

export default function BookingIdentityRow({
  bookingId,
  dateTimeLabel,
  mobileDateTimeLabel,
  petName,
  ownerName,
  petPhotoUrl,
  ownerPhotoUrl,
  petImageSizes = '40px',
  ownerImageSizes = '40px',
}: Props) {
  const normalizedPetPhotoUrl = normalizeDisplayImageUrl(petPhotoUrl);
  const normalizedOwnerPhotoUrl = normalizeDisplayImageUrl(ownerPhotoUrl);

  return (
    <div className="flex w-full min-w-0 items-start gap-3">
      <div className={BOOKING_PET_AVATAR_CLASS}>
        {normalizedPetPhotoUrl ? (
          <Image
            src={normalizedPetPhotoUrl}
            alt={`${petName ?? 'Pet'} photo`}
            fill
            sizes={petImageSizes}
            className="object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-sm">🐾</span>
        )}
      </div>
      <div className={BOOKING_OWNER_AVATAR_CLASS}>
        {normalizedOwnerPhotoUrl ? (
          <Image
            src={normalizedOwnerPhotoUrl}
            alt={`${ownerName ?? 'Owner'} photo`}
            fill
            sizes={ownerImageSizes}
            className="object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-xs">👤</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-5 text-neutral-900">Booking #{bookingId}</p>
        <p className="text-xs leading-4 text-neutral-600 whitespace-normal break-words sm:hidden">
          {mobileDateTimeLabel ?? dateTimeLabel}
        </p>
        <p className="hidden text-xs leading-4 text-neutral-600 sm:truncate sm:block">
          {dateTimeLabel}
        </p>
      </div>
    </div>
  );
}
