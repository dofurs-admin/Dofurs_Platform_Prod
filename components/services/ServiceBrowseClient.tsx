'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ProviderCard from '@/components/ui/ProviderCard';

export type BrowseProvider = {
  id: number;
  name: string;
  provider_type: string | null;
  profile_photo_url: string | null;
  average_rating: number | null;
  total_bookings: number | null;
  base_price: number | null;
  service_mode: string | null;
  is_verified: boolean;
  service_type: string;
  availableSlotCount?: number | null;
  service_pincodes?: string[] | null;
};

type ServiceBrowseClientProps = {
  providers: BrowseProvider[];
  category: string;
  categoryLabel: string;
};

type SortOption = 'recommended' | 'rating' | 'price_asc' | 'price_desc';
type ModeFilter = 'all' | 'home_visit' | 'clinic_visit' | 'teleconsult';

export default function ServiceBrowseClient({
  providers,
  category,
  categoryLabel,
}: ServiceBrowseClientProps) {
  void category;
  const searchParams = useSearchParams();
  const urlPincode = searchParams.get('pincode') ?? '';

  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [maxPrice, setMaxPrice] = useState<number>(5000);
  const [minRating, setMinRating] = useState<number>(0);
  const [pincode, setPincode] = useState<string>(urlPincode);

  const filtered = useMemo(() => {
    let list = [...providers];

    if (modeFilter !== 'all') {
      list = list.filter(
        (p) => !p.service_mode || p.service_mode === modeFilter,
      );
    }

    if (maxPrice < 5000) {
      list = list.filter((p) => !p.base_price || p.base_price <= maxPrice);
    }

    if (minRating > 0) {
      list = list.filter(
        (p) => typeof p.average_rating === 'number' && p.average_rating >= minRating,
      );
    }

    if (pincode.length === 6) {
      list = list.filter(
        (p) =>
          !p.service_pincodes ||
          p.service_pincodes.length === 0 ||
          p.service_pincodes.includes(pincode),
      );
    }

    switch (sortBy) {
      case 'rating':
        list.sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
        break;
      case 'price_asc':
        list.sort((a, b) => (a.base_price ?? 9999) - (b.base_price ?? 9999));
        break;
      case 'price_desc':
        list.sort((a, b) => (b.base_price ?? 0) - (a.base_price ?? 0));
        break;
      default:
        // recommended: verified first, then by rating
        list.sort((a, b) => {
          if (a.is_verified !== b.is_verified) return a.is_verified ? -1 : 1;
          return (b.average_rating ?? 0) - (a.average_rating ?? 0);
        });
    }

    return list;
  }, [providers, sortBy, modeFilter, maxPrice, minRating, pincode]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-coral">Browse Providers</p>
        <h1 className="text-3xl font-bold text-neutral-950">{categoryLabel}</h1>
        <p className="text-sm text-neutral-600">
          {filtered.length} verified provider{filtered.length !== 1 ? 's' : ''} available in Bangalore
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ===== FILTER SIDEBAR ===== */}
        <aside className="w-full shrink-0 lg:w-64">
          <div className="rounded-2xl border border-[#e7c4a7] bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-neutral-800">Filters</h2>

            {/* Service mode */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Service Mode</p>
              {(
                [
                  { value: 'all', label: 'All Modes' },
                  { value: 'home_visit', label: '🏡 Home Visit' },
                  { value: 'clinic_visit', label: '🏥 Clinic Visit' },
                  { value: 'teleconsult', label: '📱 Teleconsult' },
                ] as { value: ModeFilter; label: string }[]
              ).map((opt) => (
                <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="radio"
                    name="mode"
                    value={opt.value}
                    checked={modeFilter === opt.value}
                    onChange={() => setModeFilter(opt.value)}
                    className="accent-coral"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <hr className="my-4 border-neutral-200" />

            {/* Max price */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Max Price: ₹{maxPrice === 5000 ? 'Any' : maxPrice}
              </p>
              <input
                type="range"
                min={200}
                max={5000}
                step={100}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-coral"
              />
              <div className="flex justify-between text-xs text-neutral-400">
                <span>₹200</span>
                <span>₹5000+</span>
              </div>
            </div>

            <hr className="my-4 border-neutral-200" />

            {/* Min rating */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Minimum Rating</p>
              {[0, 3, 3.5, 4, 4.5].map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="radio"
                    name="rating"
                    value={r}
                    checked={minRating === r}
                    onChange={() => setMinRating(r)}
                    className="accent-coral"
                  />
                  {r === 0 ? 'Any Rating' : `${r}★ & above`}
                </label>
              ))}
            </div>

            <hr className="my-4 border-neutral-200" />

            {/* Pincode filter */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your Pincode</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="e.g. 560001"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-coral/30"
              />
              {pincode.length > 0 && pincode.length < 6 && (
                <p className="text-[11px] text-neutral-400">Enter full 6-digit pincode</p>
              )}
            </div>

            <hr className="my-4 border-neutral-200" />

            <button
              type="button"
              onClick={() => {
                setSortBy('recommended');
                setModeFilter('all');
                setMaxPrice(5000);
                setMinRating(0);
                setPincode('');
              }}
              className="w-full rounded-lg border border-neutral-200 py-2 text-xs font-semibold text-neutral-500 hover:bg-neutral-50"
            >
              Reset Filters
            </button>
          </div>
        </aside>

        {/* ===== RESULTS ===== */}
        <div className="flex-1 space-y-4">
          {/* Sort bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-600">
              Showing <span className="font-semibold text-neutral-900">{filtered.length}</span> providers
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-coral/30"
            >
              <option value="recommended">Recommended</option>
              <option value="rating">Highest Rated</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-neutral-200 bg-neutral-50 py-16 text-center">
              <span className="text-4xl">🔍</span>
              <p className="font-semibold text-neutral-700">No providers match your filters</p>
              <button
                type="button"
                onClick={() => {
                  setModeFilter('all');
                  setMaxPrice(5000);
                  setMinRating(0);
                  setPincode('');
                }}
                className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  id={provider.id}
                  name={provider.name}
                  providerType={provider.provider_type}
                  profilePhotoUrl={provider.profile_photo_url}
                  averageRating={provider.average_rating}
                  totalBookings={provider.total_bookings}
                  basePrice={provider.base_price}
                  availableSlotCount={provider.availableSlotCount}
                  isVerified={provider.is_verified}
                  bookingHref={`/forms/customer-booking?providerName=${encodeURIComponent(provider.name)}&serviceType=${encodeURIComponent(provider.service_type)}`}
                />
              ))}
            </div>
          )}

          {/* CTA if no account */}
          <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-5 text-center">
            <p className="text-sm font-semibold text-neutral-800">Don&apos;t see what you need?</p>
            <p className="mt-1 text-xs text-neutral-600">All bookings go through our verified flow with real-time confirmation.</p>
            <Link
              href="/forms/customer-booking"
              className="mt-3 inline-block rounded-xl bg-[linear-gradient(135deg,#e49a57,#cf8347)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              Start Booking
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
