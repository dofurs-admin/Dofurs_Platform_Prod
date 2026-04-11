'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SERVICE_OPTIONS = [
  { label: '✂️ Grooming', slug: 'grooming' },
  { label: '🩺 Vet Visit', slug: 'vet-visits' },
  { label: '🏠 Pet Sitting', slug: 'pet-sitting' },
  { label: '🎓 Training', slug: 'training' },
  { label: '📱 Teleconsult', slug: 'teleconsult' },
] as const;

type ServiceSlug = (typeof SERVICE_OPTIONS)[number]['slug'];

export default function QuickBookWidget() {
  const router = useRouter();
  const [selected, setSelected] = useState<ServiceSlug | null>(null);
  const [pincode, setPincode] = useState('');

  function handleFind() {
    if (!selected) return;
    const params = pincode.trim() ? `?pincode=${encodeURIComponent(pincode.trim())}` : '';
    router.push(`/services/${selected}${params}`);
  }

  return (
    <div className="rounded-2xl border border-[#e7c4a7] bg-white/90 px-4 py-4 shadow-[0_4px_20px_rgba(79,47,25,0.07)] backdrop-blur-sm sm:px-6 sm:py-5">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a6a44]">
        Quick Book
      </p>

      {/* Service type pills */}
      <div className="mb-3 flex flex-wrap gap-2">
        {SERVICE_OPTIONS.map((svc) => (
          <button
            key={svc.slug}
            type="button"
            onClick={() => setSelected(svc.slug)}
            aria-pressed={selected === svc.slug}
            aria-label={`Select ${svc.label} service`}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              selected === svc.slug
                ? 'border-coral bg-coral text-white shadow-sm'
                : 'border-[#e7c4a7] bg-[#fdf8f4] text-neutral-700 hover:border-coral/60 hover:bg-coral/5'
            }`}
          >
            {svc.label}
          </button>
        ))}
      </div>

      {/* Pincode + CTA row */}
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="Pincode (optional)"
          aria-label="Enter pincode to find nearby providers"
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
          className="h-9 w-32 flex-shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-coral/30"
        />
        <button
          type="button"
          disabled={!selected}
          onClick={handleFind}
          className="flex-1 rounded-xl bg-[linear-gradient(135deg,#e49a57,#cf8347)] px-4 py-2 text-sm font-bold text-white shadow-sm transition-opacity disabled:opacity-40"
        >
          {selected ? 'Find Providers →' : 'Select a Service'}
        </button>
      </div>
    </div>
  );
}
