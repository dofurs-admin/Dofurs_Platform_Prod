'use client';

type Service = {
  id: string;
  provider_id: number;
  service_type: string;
  service_duration_minutes: number;
  buffer_minutes: number;
  base_price: number;
  source: 'provider_services' | 'services';
};
type Pet = { id: number; name: string; breed?: string | null };
type Provider = {
  id: number;
  name: string;
  provider_type?: string | null;
  type?: string | null;
  averageRating?: number | null;
  totalBookings?: number | null;
  isVerified?: boolean;
  backgroundVerified?: boolean;
};
type PricingBreakdown = {
  base_total: number;
  discount_amount: number;
  final_total: number;
};
type DiscountPreview = {
  discountId: string;
  code: string;
  title: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  discountAmount: number;
  baseAmount: number;
  finalAmount: number;
  appliesToServiceType: string | null;
  validUntil: string | null;
};
type ServiceAddon = {
  id: string;
  name: string;
  price: number;
};
type BookingStep = 'pet-service' | 'datetime' | 'review';

interface BookingSummarySidebarProps {
  step: BookingStep;
  service: Service | undefined;
  pet: Pet | undefined;
  provider: Provider | undefined;
  bookingDate: string;
  slotStartTime: string;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  priceCalculation: PricingBreakdown | null;
  discountPreview: DiscountPreview | null;
  addOns: ServiceAddon[];
  selectedAddOns: Record<string, number>;
  selectedPetCount?: number;
  selectedServiceCount?: number;
}

export default function BookingSummarySidebar({
  step,
  service,
  pet,
  provider,
  bookingDate,
  slotStartTime,
  bookingMode,
  priceCalculation,
  discountPreview,
  addOns,
  selectedAddOns,
  selectedPetCount = 0,
  selectedServiceCount = 0,
}: BookingSummarySidebarProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const stepLabels = {
    'pet-service': 'Pets & Service',
    datetime: 'Date & Time',
    review: 'Review',
  };

  const stepNumber = {
    'pet-service': 1,
    datetime: 2,
    review: 3,
  };

  const orderedSteps: BookingStep[] = ['pet-service', 'datetime', 'review'];

  const totalPrice = discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0;
  const basePrice = discountPreview?.baseAmount ?? priceCalculation?.base_total ?? 0;
  const discountAmount = discountPreview?.discountAmount ?? priceCalculation?.discount_amount ?? 0;

  const selectedAddOnsTotal = addOns
    .filter((addon) => selectedAddOns[addon.id] > 0)
    .reduce((sum, addon) => sum + addon.price * selectedAddOns[addon.id], 0);

  return (
    <div className="premium-fade-up h-full">
      <div className="h-full lg:sticky lg:top-6">
        <div className="rounded-3xl border border-[#e9d7c7] bg-[linear-gradient(170deg,#fffdfb_0%,#fff8f1_100%)] p-6 shadow-[0_12px_30px_rgba(79,47,25,0.1)] lg:h-full">
          {/* Header */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6a44]">Booking Flow</p>
          <p className="mt-1 text-xs text-[#6e4d35]">Step {stepNumber[step]} of 3</p>

          {/* Progress indicator */}
          <div className="mt-4 space-y-2">
            {orderedSteps.map((s) => {
              const isCompleted = orderedSteps.indexOf(s) < orderedSteps.indexOf(step);
              const isCurrent = s === step;

              return (
                <div
                  key={s}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    isCurrent
                      ? 'border border-[#d99a66] bg-white'
                      : isCompleted
                        ? 'border border-[#c6e5d0] bg-[#f1fbf5]'
                        : 'border border-transparent bg-[#f5eee6]'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                      isCompleted
                        ? 'bg-[#3a9c65] text-white'
                        : isCurrent
                          ? 'bg-[#c7773b] text-white'
                          : 'bg-[#dfc8b3] text-[#6e4d35]'
                    }`}
                  >
                    {isCompleted ? '✓' : stepNumber[s]}
                  </div>
                  <span className={`font-medium ${isCurrent ? 'text-[#8f4a1d]' : isCompleted ? 'text-[#2b7d50]' : 'text-[#6e4d35]'}`}>
                    {stepLabels[s]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-4 h-px bg-gradient-to-r from-[#d9bda4] via-[#eddccc] to-transparent" />

          {/* Selection details */}
          <div className="space-y-3">
            {bookingMode && (
              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase">Service Type</p>
                <p className="mt-1 font-medium text-neutral-950">
                  {bookingMode === 'home_visit' && 'Home Visit'}
                  {bookingMode === 'clinic_visit' && 'Clinic Visit'}
                  {bookingMode === 'teleconsult' && 'Teleconsult'}
                </p>
              </div>
            )}

            {provider && (
              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase">
                  {bookingMode === 'clinic_visit' ? 'Clinic' : 'Provider'}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <p className="font-medium text-neutral-950">{provider.name}</p>
                  {provider.isVerified && (
                    <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">✓</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
                  {typeof provider.averageRating === 'number' && provider.averageRating > 0 && (
                    <span className="text-amber-600 font-semibold">★ {provider.averageRating.toFixed(1)}</span>
                  )}
                  {typeof provider.totalBookings === 'number' && provider.totalBookings > 0 && (
                    <span>{provider.totalBookings} bookings</span>
                  )}
                  {provider.backgroundVerified && (
                    <span className="text-blue-600 font-semibold">🛡 BG</span>
                  )}
                </div>
              </div>
            )}

            {service ? (
              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase">Service</p>
                <p className="mt-1 font-medium text-neutral-950">{service.service_type}</p>
                <p className="text-xs text-neutral-600">₹{service.base_price} • {service.service_duration_minutes} mins</p>
              </div>
            ) : null}

            {pet && (
              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase">Pet</p>
                <p className="mt-1 font-medium text-neutral-950">{pet.name}</p>
                {pet.breed ? <p className="text-xs text-neutral-600">{pet.breed}</p> : null}
                {selectedPetCount > 1 ? <p className="text-xs text-neutral-600">+ {selectedPetCount - 1} more pets</p> : null}
              </div>
            )}

            {selectedServiceCount > 0 ? (
              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase">Bundle Size</p>
                <p className="mt-1 font-medium text-neutral-950">{selectedServiceCount} services selected</p>
              </div>
            ) : null}

            {bookingDate && (
              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase">Date & Time</p>
                <p className="mt-1 font-medium text-neutral-950">{formatDate(bookingDate)}</p>
                {slotStartTime && <p className="text-xs text-neutral-600">{slotStartTime}</p>}
              </div>
            )}
          </div>

          {/* Divider */}
          {(basePrice > 0 || selectedAddOnsTotal > 0) && (
            <>
              <div className="my-4 h-px bg-gradient-to-r from-[#d9bda4] via-[#eddccc] to-transparent" />

              {/* Price breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Base price</span>
                  <span className="font-semibold text-neutral-950">₹{basePrice}</span>
                </div>

                {selectedAddOnsTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">Add-ons</span>
                    <span className="font-semibold text-neutral-950">₹{selectedAddOnsTotal}</span>
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">Discount</span>
                    <span className="font-semibold text-green-700">-₹{discountAmount}</span>
                  </div>
                )}

                <div className="border-t-2 border-coral/20 pt-2 flex justify-between">
                  <span className="font-semibold text-neutral-950">Total</span>
                  <span className="text-xl font-bold text-[#b25f27]">₹{totalPrice}</span>
                </div>

                <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                  Select your preferred payment option in the review step before scheduling.
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
