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
type PetServiceSelection = {
  serviceType: string | null;
  quantity: number;
};

interface ServiceSelectionStepProps {
  selectedPets: Pet[];
  services: Service[];
  petServiceSelections: Record<number, PetServiceSelection>;
  totalSelectedServices: number;
  searchResultSummary?: string | null;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  onBookingModeChange: (mode: 'home_visit' | 'clinic_visit') => void;
  onPetServiceChange: (petId: number, serviceType: string) => void;
  onPetQuantityChange: (petId: number, quantity: number) => void;
  onApplyServiceToAll: (serviceType: string) => void;
  onNext: () => void;
}

export default function ServiceSelectionStep({
  selectedPets = [],
  services,
  petServiceSelections = {},
  totalSelectedServices = 0,
  searchResultSummary,
  bookingMode,
  onBookingModeChange,
  onPetServiceChange,
  onPetQuantityChange,
  onApplyServiceToAll,
  onNext,
}: ServiceSelectionStepProps) {
  const canContinue =
    Boolean(bookingMode) &&
    selectedPets.length > 0 &&
    selectedPets.every((pet) => {
      const selection = petServiceSelections[pet.id];
      return Boolean(selection?.serviceType) && (selection?.quantity ?? 0) > 0;
    });

  const selectedPetLabel =
    selectedPets.length === 0
      ? 'your pet'
      : selectedPets.length === 1
        ? selectedPets[0].name
        : `${selectedPets.length} pets`;

  const firstSelectedServiceType =
    selectedPets.length > 0 ? petServiceSelections[selectedPets[0].id]?.serviceType ?? null : null;

  return (
    <div className="premium-fade-up space-y-7 rounded-3xl border border-[#e9d7c7] bg-[linear-gradient(165deg,#fffdfb_0%,#fff8f1_100%)] p-5 shadow-[0_10px_30px_rgba(79,47,25,0.08)] md:p-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a6a44]">Step 2 of 3</p>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-950">Choose The Perfect Service</h2>
        <p className="mt-2 text-sm text-[#6e4d35]">Now selecting services tailored for {selectedPetLabel}.</p>
        {searchResultSummary ? (
          <p className="mt-3 rounded-xl border border-[#e8c9ad] bg-[#fff4e9] px-3 py-2 text-xs font-medium text-[#8f4a1d]">
            {searchResultSummary}
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-3 block text-sm font-semibold text-neutral-950">Booking Mode</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => {
              onBookingModeChange('home_visit');
            }}
            className={`premium-lift relative rounded-2xl border p-4 text-left transition-all ${
              bookingMode === 'home_visit'
                ? 'border-[#d99a66] bg-[linear-gradient(165deg,#fff8ef_0%,#fff0e3_100%)] shadow-[0_8px_20px_rgba(208,133,72,0.18)]'
                : 'border-[#ebdfd3] bg-white hover:border-[#d9b89a]'
            }`}
          >
            <h3 className="font-semibold text-neutral-950">Home Visit</h3>
            <p className="mt-1 text-xs text-[#6e4d35]">Comfort-first grooming at your doorstep.</p>
          </button>

          <button
            onClick={() => {
              onBookingModeChange('clinic_visit');
            }}
            className={`premium-lift relative rounded-2xl border p-4 text-left transition-all ${
              bookingMode === 'clinic_visit'
                ? 'border-[#d99a66] bg-[linear-gradient(165deg,#fff8ef_0%,#fff0e3_100%)] shadow-[0_8px_20px_rgba(208,133,72,0.18)]'
                : 'border-[#ebdfd3] bg-white hover:border-[#d9b89a]'
            }`}
          >
            <h3 className="font-semibold text-neutral-950">Clinic Visit</h3>
            <p className="mt-1 text-xs text-[#6e4d35]">Structured in-clinic care at partner centers.</p>
          </button>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="block text-sm font-semibold text-neutral-950">Select Service Per Pet</label>
          <p className="text-xs font-semibold text-[#8f4a1d]">{totalSelectedServices} services selected</p>
        </div>
        {!bookingMode && (
          <div className="mb-3 rounded-2xl border border-dashed border-[#ddc9b6] bg-white p-4 text-center">
            <p className="text-sm text-neutral-500">Select booking mode first to load services.</p>
          </div>
        )}

        {bookingMode && firstSelectedServiceType ? (
          <div className="mb-3 rounded-xl border border-[#e8c9ad] bg-[#fff4e9] px-3 py-2">
            <button
              type="button"
              onClick={() => onApplyServiceToAll(firstSelectedServiceType)}
              className="text-xs font-semibold text-[#8f4a1d] underline underline-offset-4"
            >
              Apply &quot;{firstSelectedServiceType}&quot; to all selected pets
            </button>
          </div>
        ) : null}

        {bookingMode && services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#ddc9b6] bg-white p-4 text-center">
            <p className="text-sm text-neutral-500">No services available for this mode</p>
          </div>
        ) : bookingMode ? (
          <div className="space-y-3">
            {selectedPets.map((pet) => {
              const selection = petServiceSelections[pet.id] ?? { serviceType: null, quantity: 1 };

              return (
                <div key={pet.id} className="rounded-2xl border border-[#ebdfd3] bg-white p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-neutral-950">{pet.name}</h3>
                      <p className="text-xs text-[#6e4d35]">{pet.breed?.trim() || 'Pet profile ready for booking'}</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-[#e3c7ae] px-2 py-1">
                      <button
                        type="button"
                        onClick={() => onPetQuantityChange(pet.id, Math.max(1, selection.quantity - 1))}
                        className="h-6 w-6 rounded-full bg-[#fff3e6] text-sm font-semibold text-[#8f4a1d]"
                      >
                        -
                      </button>
                      <span className="min-w-5 text-center text-xs font-semibold text-neutral-900">{selection.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onPetQuantityChange(pet.id, Math.min(5, selection.quantity + 1))}
                        className="h-6 w-6 rounded-full bg-[#fff3e6] text-sm font-semibold text-[#8f4a1d]"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {services.map((service) => (
                      <button
                        key={`${pet.id}-${service.service_type}`}
                        onClick={() => onPetServiceChange(pet.id, service.service_type)}
                        className={`premium-lift relative rounded-2xl border p-3 text-left transition-all ${
                          selection.serviceType === service.service_type
                            ? 'border-[#d99a66] bg-[linear-gradient(165deg,#fff8ef_0%,#fff0e3_100%)] shadow-[0_8px_20px_rgba(208,133,72,0.18)]'
                            : 'border-[#ebdfd3] bg-white hover:border-[#d9b89a]'
                        }`}
                      >
                        <h4 className="text-sm font-semibold text-neutral-950">{service.service_type}</h4>
                        <p className="mt-1 text-[11px] text-[#6e4d35]">
                          {service.service_duration_minutes} mins • Starts at Rs.{service.base_price}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {canContinue ? (
        <div className="rounded-2xl border border-dashed border-[#ddc9b6] bg-white p-4 text-center">
          <p className="text-sm text-neutral-600">
            Date, time, and provider options will be shown in the next step based on real-time availability for your selected bundle.
          </p>
        </div>
      ) : null}

      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="premium-lift w-full rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-7 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(199,119,59,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(199,119,59,0.3)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Continue To Date, Time & Provider
        </button>
      </div>
    </div>
  );
}
