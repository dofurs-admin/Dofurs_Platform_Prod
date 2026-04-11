'use client';

import ProgressRing from './ProgressRing';
import StorageBackedImage from '@/components/ui/StorageBackedImage';

interface PetHeroHeaderProps {
  petName: string;
  breed?: string | null;
  age?: number | null;
  photoUrl?: string | null;
  completionPercent: number;
  lastSavedAt?: string | null;
}

function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return 'Not saved yet';

  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Saved just now';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `Saved ${minutes}m ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `Saved ${hours}h ago`;
  }

  const days = Math.floor(seconds / 86400);
  return `Saved ${days}d ago`;
}

export default function PetHeroHeader({
  petName,
  breed,
  age,
  photoUrl,
  completionPercent,
  lastSavedAt,
}: PetHeroHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50/50 via-white to-neutral-50/50 p-8 shadow-sm border border-neutral-200/40">
      {/* Subtle background elements */}
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/5 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-neutral-500/5 blur-3xl" />

      <div className="relative grid gap-8 md:grid-cols-2 lg:gap-12">
        {/* Left: Pet Info */}
        <div className="flex flex-col justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-950 leading-tight">
              {petName}
            </h1>

            {(breed || age) && (
              <p className="mt-2 text-neutral-600">
                {[breed, age ? `${age} years old` : null].filter(Boolean).join(' • ')}
              </p>
            )}

            <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
              <div className="flex h-2 w-2 rounded-full bg-green-500" />
              <span>{formatTimeAgo(lastSavedAt)}</span>
            </div>
          </div>
        </div>

        {/* Right: Photo + Progress */}
        <div className="flex flex-col items-center justify-center gap-6">
          {/* Pet Photo */}
          <div className="relative">
            {photoUrl ? (
              <div className="relative h-32 w-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                <StorageBackedImage
                  value={photoUrl}
                  bucket="pet-photos"
                  alt={petName}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white bg-neutral-100 shadow-lg">
                <span className="text-4xl">🐾</span>
              </div>
            )}

            {/* Progress Ring */}
            <div className="absolute -bottom-2 -right-2">
              <div className="rounded-full bg-white p-2 shadow-md">
                <ProgressRing percentage={completionPercent} radius={30} circumference={189} />
              </div>
            </div>
          </div>

          {/* Completion Badge */}
          <div className="text-center">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Passport Completion
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              {completionPercent}% complete
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
