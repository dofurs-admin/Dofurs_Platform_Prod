'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

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
type Provider = { id: number; name: string; provider_type?: string | null; type?: string | null };
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
type CreditEligibilityResponse = {
  eligible: boolean;
  subscriptionId: string | null;
  serviceType: string;
  availableCredits: number;
  totalCredits: number;
};

type BookingBundleRow = {
  petId: number;
  petName: string;
  serviceType: string;
  quantity: number;
  unitBasePrice?: number;
  unitDurationMinutes?: number;
};

interface ReviewConfirmStepProps {
  selectedService: Service | undefined;
  selectedPet: Pet | undefined;
  selectedPets?: Pet[];
  selectedProvider: Provider | undefined;
  bookingDate: string;
  slotStartTime: string;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  locationAddress: string;
  providerNotes: string;
  priceCalculation: PricingBreakdown | null;
  discountPreview: DiscountPreview | null;
  discountCode: string;
  onDiscountCodeChange: (code: string) => void;
  onApplyDiscount: (code: string) => Promise<boolean>;
  addOns: ServiceAddon[];
  selectedAddOns: Record<string, number>;
  bookingBundleRows: BookingBundleRow[];
  totalSelectedServices: number;
  paymentChoice: 'online' | 'cash' | 'subscription_credit';
  creditEligibility: CreditEligibilityResponse | null;
  subscriptionCreditUnavailableReason?: string | null;
  isCheckingCreditEligibility: boolean;
  onPaymentChoiceChange: (choice: 'online' | 'cash' | 'subscription_credit') => void;
  walletCreditsToApply: number;
  onWalletCreditsToApplyChange: (amount: number) => void;
  isPackageBooking?: boolean;
  isBoardingBooking?: boolean;
  bookingEndDate?: string;
  onBundleRowQuantityChange?: (petId: number, serviceType: string, quantity: number) => void;
  onBundleRowRemove?: (petId: number, serviceType: string) => void;
  bundlePriceTotal?: number;
  totalDurationMinutes?: number;
  onPrev: () => void;
  onChangeSelectedService: () => void;
  onChangePet: () => void;
  onChangeProvider: () => void;
  onChangeAddress: () => void;
  onChangeDateTime: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export default function ReviewConfirmStep({
  selectedService,
  selectedPet,
  selectedPets = [],
  selectedProvider,
  bookingDate,
  slotStartTime,
  bookingMode,
  locationAddress,
  providerNotes,
  priceCalculation,
  discountPreview,
  discountCode,
  onDiscountCodeChange,
  onApplyDiscount,
  addOns,
  selectedAddOns,
  bookingBundleRows,
  totalSelectedServices,
  paymentChoice,
  creditEligibility,
  subscriptionCreditUnavailableReason = null,
  isCheckingCreditEligibility,
  onPaymentChoiceChange,
  walletCreditsToApply,
  onWalletCreditsToApplyChange,
  isPackageBooking = false,
  isBoardingBooking = false,
  bookingEndDate = '',
  onBundleRowQuantityChange,
  onBundleRowRemove,
  bundlePriceTotal = 0,
  totalDurationMinutes = 0,
  onPrev,
  onChangeSelectedService,
  onChangePet,
  onChangeProvider,
  onChangeAddress,
  onChangeDateTime,
  onConfirm,
  isPending,
}: ReviewConfirmStepProps) {
  const { showToast } = useToast();
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [availableWalletCredits, setAvailableWalletCredits] = useState(0);
  const [applyCredits, setApplyCredits] = useState(false);
  const [showCashConfirmModal, setShowCashConfirmModal] = useState(false);

  useEffect(() => {
    fetch('/api/user/credit-wallet')
      .then((r) => r.json())
      .then((d: { balance?: { available_inr?: number } }) => {
        setAvailableWalletCredits(d.balance?.available_inr ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setApplyCredits(walletCreditsToApply > 0);
  }, [walletCreditsToApply]);

  function handleToggleCredits() {
    const next = !applyCredits;
    setApplyCredits(next);
    if (next) {
      const baseAmount = discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0;
      onWalletCreditsToApplyChange(Math.min(availableWalletCredits, baseAmount));
    } else {
      onWalletCreditsToApplyChange(0);
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      showToast('Enter a discount code', 'error');
      return;
    }

    setIsApplyingDiscount(true);
    await onApplyDiscount(discountCode);
    setIsApplyingDiscount(false);
  };

  const boardingNights =
    isBoardingBooking && bookingEndDate && bookingDate
      ? Math.max(
          1,
          Math.round(
            (new Date(`${bookingEndDate}T00:00:00`).getTime() -
              new Date(`${bookingDate}T00:00:00`).getTime()) /
              86400000,
          ),
        )
      : 1;

  // Use bundle aggregate price when multiple services selected, otherwise single-service price
  const singleServicePrice = discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0;
  const isMultiService = bookingBundleRows.length > 1 || totalSelectedServices > 1;
  const perUnitAmount = isMultiService && bundlePriceTotal > 0 ? bundlePriceTotal : singleServicePrice;
  const baseTotal = perUnitAmount * boardingNights;
  const totalAmount = Math.max(0, baseTotal - walletCreditsToApply);
  const selectedAddOnRows = addOns
    .filter((addon) => selectedAddOns[addon.id] > 0)
    .map((addon) => ({
      id: addon.id,
      name: addon.name,
      quantity: selectedAddOns[addon.id],
      amount: addon.price * selectedAddOns[addon.id],
    }));

  const paymentDescription =
    walletCreditsToApply > 0 && totalAmount === 0
      ? 'Your Dofurs Credits cover the full amount. No additional payment needed.'
      : paymentChoice === 'subscription_credit'
        ? 'Subscription credit will be applied when booking is confirmed.'
        : paymentChoice === 'cash'
          ? 'Cash will be collected after the service is completed.'
          : 'Secure Razorpay checkout is required before scheduling your booking.';

  const serviceLabel = selectedService?.service_type ?? bookingBundleRows[0]?.serviceType ?? 'Selected service';
  const serviceDurationLabel =
    typeof selectedService?.service_duration_minutes === 'number'
      ? `${selectedService.service_duration_minutes} mins`
      : 'Duration unavailable';
  const servicePriceLabel =
    typeof selectedService?.base_price === 'number' ? `₹${selectedService.base_price}` : 'Price unavailable';
  const serviceSummaryRows = bookingBundleRows
    .map((row) => `${row.petName}: ${row.serviceType}${row.quantity > 1 ? ` x${row.quantity}` : ''}`)
    .slice(0, 4);
  const petSummaryRows = (selectedPets.length > 0 ? selectedPets : selectedPet ? [selectedPet] : []).slice(0, 4);
  const totalSelectedPets = selectedPets.length > 0 ? selectedPets.length : selectedPet ? 1 : 0;

  return (
    <div className="premium-fade-up space-y-2 sm:space-y-7 rounded-2xl sm:rounded-3xl border border-[#e9d7c7] bg-[linear-gradient(165deg,#fffdfb_0%,#fff8f1_100%)] p-2.5 max-[380px]:p-2 sm:p-5 shadow-[0_10px_30px_rgba(79,47,25,0.08)] md:p-7">
      {/* Top navigation — hidden on mobile to save space, bottom nav handles it */}
      <div className="hidden sm:flex sm:flex-row sm:justify-between sm:gap-3">
        <button
          onClick={onPrev}
          className="rounded-full border-2 border-neutral-200 px-6 py-2.5 text-sm font-semibold text-neutral-950 transition-all hover:border-coral hover:text-coral sm:w-auto"
        >
          Back
        </button>
        <button
          onClick={() => {
            if (paymentChoice === 'cash') {
              setShowCashConfirmModal(true);
            } else {
              onConfirm();
            }
          }}
          disabled={isPending}
          className="rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-8 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(199,119,59,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(199,119,59,0.3)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isPending ? 'Processing...' : paymentChoice === 'online' ? 'Proceed To Payment & Schedule' : 'Confirm & Schedule Booking'}
        </button>
      </div>

      {/* Step indicator — hidden on mobile since BookingProgressBar already shows step info */}
      <div className="hidden sm:block">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a6a44]">Step 3 of 3</p>
        <h2 className="mt-1 sm:mt-2 text-lg sm:text-2xl font-semibold text-neutral-950">Review & Schedule</h2>
        <p className="mt-1 text-xs sm:text-sm text-[#6e4d35]">Confirm details, choose payment, and schedule.</p>
      </div>

      {/* Booking summary cards */}
      <div className="grid grid-cols-1 gap-1.5 max-[380px]:gap-1 sm:grid-cols-2 sm:gap-3">
        {/* Service card */}
        <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-2 sm:p-4">
          <p className="text-[10px] sm:text-xs font-semibold text-neutral-600 uppercase">Service</p>
          {isMultiService ? (
            <>
              <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-base font-semibold text-neutral-950 break-words">
                {totalSelectedServices} services selected
              </p>
              <div className="mt-1.5 space-y-0.5">
                {serviceSummaryRows.map((rowLabel, index) => (
                  <p key={`${rowLabel}-${index}`} className="text-[10px] sm:text-xs text-neutral-600 break-words">
                    {rowLabel}
                  </p>
                ))}
                {bookingBundleRows.length > serviceSummaryRows.length ? (
                  <p className="text-[10px] sm:text-xs text-neutral-500">
                    +{bookingBundleRows.length - serviceSummaryRows.length} more
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-base font-semibold text-neutral-950 break-words sm:line-clamp-2">{serviceLabel}</p>
              <p className="mt-0.5 text-[10px] sm:text-xs text-neutral-600">
                {serviceDurationLabel} • {servicePriceLabel}
              </p>
            </>
          )}
          <button
            type="button"
            onClick={onChangeSelectedService}
            className="mt-2 inline-flex rounded-full border border-[#e6c7af] bg-[#fff7f0] px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#9a5a2f] transition-colors hover:bg-[#ffeedf]"
          >
            Change selected service
          </button>
        </div>

        {/* Pet card */}
        <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-2 sm:p-4">
          <p className="text-[10px] sm:text-xs font-semibold text-neutral-600 uppercase">Pet</p>
          {totalSelectedPets > 1 ? (
            <>
              <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-base font-semibold text-neutral-950 break-words">
                {totalSelectedPets} pets selected
              </p>
              <div className="mt-1.5 space-y-0.5">
                {petSummaryRows.map((pet, index) => (
                  <p key={`${pet.id}-${index}`} className="text-[10px] sm:text-xs text-neutral-600 break-words">
                    {pet.name}{pet.breed?.trim() ? ` • ${pet.breed.trim()}` : ''}
                  </p>
                ))}
                {totalSelectedPets > petSummaryRows.length ? (
                  <p className="text-[10px] sm:text-xs text-neutral-500">
                    +{totalSelectedPets - petSummaryRows.length} more
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-base font-semibold text-neutral-950 break-words">{selectedPet?.name}</p>
              <p className="mt-0.5 text-[10px] sm:text-xs text-neutral-600">{selectedPet?.breed?.trim() || 'Pet profile ready'}</p>
            </>
          )}
          <button
            type="button"
            onClick={onChangePet}
            className="mt-2 inline-flex rounded-full border border-[#e6c7af] bg-[#fff7f0] px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#9a5a2f] transition-colors hover:bg-[#ffeedf]"
          >
            Change pet
          </button>
        </div>

        {/* Provider card — hidden for package bookings */}
        {!isPackageBooking && (
          <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-2 sm:p-4">
            <p className="text-[10px] sm:text-xs font-semibold text-neutral-600 uppercase">Provider</p>
            <p className="mt-0.5 text-[11px] font-semibold text-neutral-950 break-words sm:mt-1 sm:text-base sm:line-clamp-2">{selectedProvider?.name}</p>
            <p className="mt-0.5 text-[10px] sm:text-xs text-neutral-600">
              {selectedProvider?.provider_type || selectedProvider?.type || 'Provider'}
            </p>
            <button
              type="button"
              onClick={onChangeProvider}
              className="mt-2 inline-flex rounded-full border border-[#e6c7af] bg-[#fff7f0] px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#9a5a2f] transition-colors hover:bg-[#ffeedf]"
            >
              Change provider
            </button>
          </div>
        )}

        {/* Date & Time card */}
        <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-2 sm:p-4">
          <p className="text-[10px] sm:text-xs font-semibold text-neutral-600 uppercase">
            {isBoardingBooking ? 'Dates' : 'Date & Time'}
          </p>
          <p className="mt-1 text-xs sm:text-base font-semibold text-neutral-950">{formatDate(bookingDate)}</p>
          {isBoardingBooking && bookingEndDate ? (
            <p className="mt-0.5 text-xs font-medium text-neutral-700">to {formatDate(bookingEndDate)}</p>
          ) : null}
          {!isPackageBooking && slotStartTime ? (
            <p className="mt-0.5 text-[10px] sm:text-xs text-neutral-600">
              {slotStartTime}
              {totalDurationMinutes > 0 ? ` • ${totalDurationMinutes}m` : ''}
            </p>
          ) : null}
          {isMultiService && !isPackageBooking && (
            <p className="mt-0.5 text-[10px] text-neutral-500">
              Back-to-back from {slotStartTime}
            </p>
          )}
          <button
            type="button"
            onClick={onChangeDateTime}
            className="mt-2 inline-flex rounded-full border border-[#e6c7af] bg-[#fff7f0] px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#9a5a2f] transition-colors hover:bg-[#ffeedf]"
          >
            Change date & time
          </button>
        </div>
      </div>

      <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-2.5 sm:p-4">
        <p className="text-xs font-semibold text-neutral-600 uppercase">Booking Cart</p>
        <div className="mt-2 sm:mt-3 space-y-2">
          <p className="text-xs font-semibold text-[#8f4a1d]">{totalSelectedServices} services selected</p>
          {bookingBundleRows.map((row) => (
            <div key={`${row.petId}-${row.serviceType}`} className="flex flex-col items-start gap-2 rounded-lg border border-[#f0e4d6] bg-[#fffbf7] px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug text-neutral-800 break-words">{row.petName}: {row.serviceType}</p>
                {typeof row.unitBasePrice === 'number' && row.unitBasePrice > 0 ? (
                  <p className="mt-0.5 text-[11px] text-neutral-600">
                    ₹{row.unitBasePrice} x {row.quantity} = ₹{row.unitBasePrice * row.quantity}
                  </p>
                ) : null}
              </div>
              <div className="flex w-full items-center justify-end gap-1.5 shrink-0 sm:w-auto">
                {onBundleRowQuantityChange && (
                  <button
                    type="button"
                    onClick={() => row.quantity <= 1 ? onBundleRowRemove?.(row.petId, row.serviceType) : onBundleRowQuantityChange(row.petId, row.serviceType, row.quantity - 1)}
                    className="h-7 w-7 rounded-full bg-[#fff3e6] text-sm font-semibold text-[#8f4a1d]"
                  >
                    -
                  </button>
                )}
                <span className="min-w-5 text-center text-xs font-semibold text-neutral-900">x{row.quantity}</span>
                {onBundleRowQuantityChange && (
                  <button
                    type="button"
                    onClick={() => onBundleRowQuantityChange(row.petId, row.serviceType, row.quantity + 1)}
                    disabled={row.quantity >= 5}
                    className="h-7 w-7 rounded-full bg-[#fff3e6] text-sm font-semibold text-[#8f4a1d] disabled:opacity-40"
                  >
                    +
                  </button>
                )}
                {onBundleRowRemove && (
                  <button
                    type="button"
                    onClick={() => onBundleRowRemove(row.petId, row.serviceType)}
                    className="ml-1 h-7 w-7 rounded-full bg-red-50 text-xs font-semibold text-red-500 hover:bg-red-100"
                    title="Remove service"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
          {selectedAddOnRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between text-sm">
              <span className="text-neutral-700">{row.name} x{row.quantity}</span>
              <span className="font-semibold text-neutral-950">₹{row.amount}</span>
            </div>
          ))}
          {bookingBundleRows.length === 0 && selectedAddOnRows.length === 0 ? (
            <p className="text-xs text-neutral-500">No services selected. Go back to add services.</p>
          ) : null}
        </div>
      </div>

      {/* Location and notes */}
      <div className="space-y-1.5 sm:space-y-3">
        <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-2.5 max-[380px]:p-2 sm:p-4">
          <p className="text-[10px] sm:text-xs font-semibold text-neutral-600 uppercase">Booking Mode</p>
          <p className="mt-1 text-sm sm:text-base font-semibold text-neutral-950">
            {bookingMode === 'home_visit' && 'Home Visit'}
            {bookingMode === 'clinic_visit' && 'Clinic Visit'}
            {bookingMode === 'teleconsult' && 'Teleconsult'}
          </p>
          {bookingMode === 'home_visit' && locationAddress && (
            <p className="mt-1 text-[11px] sm:text-xs text-neutral-600 line-clamp-2">{locationAddress}</p>
          )}
          {bookingMode === 'home_visit' && (
            <button
              type="button"
              onClick={onChangeAddress}
              className="mt-2 inline-flex rounded-full border border-[#e6c7af] bg-[#fff7f0] px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#9a5a2f] transition-colors hover:bg-[#ffeedf]"
            >
              Change address
            </button>
          )}
        </div>

        {providerNotes && (
          <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-3 sm:p-4">
            <p className="text-xs font-semibold text-neutral-600 uppercase">Notes</p>
            <p className="mt-2 text-sm text-neutral-950">{providerNotes}</p>
          </div>
        )}
      </div>

      {/* Discount section */}
      <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-2.5 max-[380px]:p-2 sm:p-4">
        <p className="mb-2 sm:mb-3 text-xs sm:text-sm font-semibold text-neutral-950">Discount Code</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={discountCode}
            onChange={(e) => onDiscountCodeChange(e.target.value.toUpperCase())}
            placeholder="Enter discount code"
            className="flex-1 rounded-lg border-2 border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
          />
          <button
            onClick={handleApplyDiscount}
            disabled={isApplyingDiscount || !discountCode.trim()}
            className="w-full rounded-lg bg-[linear-gradient(115deg,#de9158,#c7773b)] px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Apply
          </button>
        </div>
        {discountPreview && (
          <p className="mt-2 text-xs font-medium text-green-700">
            ✓ Discount applied: {discountPreview.discountType === 'percentage' ? `${discountPreview.discountValue}%` : `₹${discountPreview.discountValue}`} off
          </p>
        )}
      </div>

      {/* Dofurs Credit Wallet */}
      {availableWalletCredits > 0 && (
        <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-3 sm:p-4">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-950">Dofurs Credits</p>
              <p className="text-xs text-neutral-500">₹{availableWalletCredits} available in your wallet</p>
            </div>
            <button
              type="button"
              onClick={handleToggleCredits}
              className={`w-full rounded-full px-4 py-1.5 text-xs font-semibold transition sm:w-auto ${
                applyCredits
                  ? 'bg-coral text-white'
                  : 'border border-[#e7c4a7] bg-[#fffaf6] text-ink hover:bg-white'
              }`}
            >
              {applyCredits ? `−₹${walletCreditsToApply} applied` : 'Apply credits'}
            </button>
            {applyCredits ? (
              <button
                type="button"
                onClick={() => {
                  setApplyCredits(false);
                  onWalletCreditsToApplyChange(0);
                }}
                className="w-full rounded-full border border-[#e7c4a7] bg-white px-4 py-1.5 text-xs font-semibold text-ink hover:bg-[#fffaf6] sm:w-auto"
              >
                Remove credits
              </button>
            ) : null}
          </div>
          {applyCredits && totalAmount === 0 && (
            <p className="mt-2 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
              ✓ Credits cover the full booking amount. No payment needed!
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-2.5 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Payment Option</p>
        <p className="mt-2 rounded-lg border border-[#e8c9ad] bg-[#fff4e9] px-3 py-2 text-xs font-medium text-[#8f4a1d]">
          Subscription credits can be used for regular services. Birthday and boarding bookings are excluded.
        </p>
        <label className="mt-2 flex items-start gap-2 text-sm sm:text-xs text-neutral-700">
          <input
            type="radio"
            name="payment-choice"
            checked={paymentChoice === 'online'}
            onChange={() => onPaymentChoiceChange('online')}
            className="mt-0.5"
          />
          <span>Pay online now (Razorpay)</span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm sm:text-xs text-neutral-700">
          <input
            type="radio"
            name="payment-choice"
            checked={paymentChoice === 'subscription_credit'}
            onChange={() => onPaymentChoiceChange('subscription_credit')}
            disabled={!creditEligibility?.eligible || isCheckingCreditEligibility}
            className="mt-0.5"
          />
          <span>
            Use subscription credit
            {subscriptionCreditUnavailableReason
              ? ` (${subscriptionCreditUnavailableReason})`
              : creditEligibility?.eligible
                ? ` (${creditEligibility.availableCredits} credits available)`
                : isCheckingCreditEligibility
                  ? ' (checking availability...)'
                  : ' (not available for this service)'}
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm sm:text-xs text-neutral-700">
          <input
            type="radio"
            name="payment-choice"
            checked={paymentChoice === 'cash'}
            onChange={() => onPaymentChoiceChange('cash')}
            className="mt-0.5"
          />
          <span>Pay in cash after service</span>
        </label>
        <p className="mt-2 text-xs text-neutral-500">{paymentDescription}</p>
      </div>

      {/* Price breakdown */}
      <div className="rounded-lg sm:rounded-xl border border-[#d6b79a] bg-[linear-gradient(165deg,#fff8ef_0%,#fff0e3_100%)] p-2.5 max-[380px]:p-2 sm:p-4">
        {!priceCalculation && !discountPreview ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-1/2 rounded bg-[#e8d5c0]" />
            <div className="h-6 w-1/3 rounded bg-[#e8d5c0]" />
          </div>
        ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">{boardingNights > 1 ? 'Price per night:' : isMultiService ? 'Services total:' : 'Base amount:'}</span>
            <span className="font-medium text-neutral-950">₹{isMultiService && bundlePriceTotal > 0 ? bundlePriceTotal : (discountPreview?.baseAmount ?? priceCalculation?.base_total ?? 0)}</span>
          </div>
          {boardingNights > 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">× {boardingNights} nights:</span>
              <span className="font-medium text-neutral-950">₹{(isMultiService && bundlePriceTotal > 0 ? bundlePriceTotal : (discountPreview?.baseAmount ?? priceCalculation?.base_total ?? 0)) * boardingNights}</span>
            </div>
          )}
          {(discountPreview?.discountAmount || priceCalculation?.discount_amount) ? (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Discount:</span>
              <span className="font-medium text-green-700">-₹{discountPreview?.discountAmount ?? priceCalculation?.discount_amount ?? 0}</span>
            </div>
          ) : null}
          {walletCreditsToApply > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Dofurs Credits:</span>
              <span className="font-medium text-green-700">-₹{walletCreditsToApply}</span>
            </div>
          )}
          <div className="border-t-2 border-coral/20 pt-2 flex justify-between">
            <span className="font-semibold text-neutral-950">Total to pay:</span>
            <span className="text-lg font-bold text-[#b25f27]">₹{totalAmount}</span>
          </div>
        </div>
        )}
        <p className="mt-3 text-xs text-neutral-600">
          Booking will be scheduled after this confirmation.
        </p>
      </div>

      {/* Navigation and submit */}
      <div className="flex flex-col-reverse gap-2 sm:gap-3 pt-2 sm:pt-4 sm:flex-row sm:justify-between">
        <button
          onClick={onPrev}
          className="w-full rounded-full border-2 border-neutral-200 px-6 py-2 sm:py-2.5 text-sm font-semibold text-neutral-950 transition-all hover:border-coral hover:text-coral sm:w-auto"
        >
          Back
        </button>
        <button
          onClick={() => {
            if (paymentChoice === 'cash') {
              setShowCashConfirmModal(true);
            } else {
              onConfirm();
            }
          }}
          disabled={isPending}
          className="w-full rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-8 py-2 sm:py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(199,119,59,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(199,119,59,0.3)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isPending ? 'Processing...' : paymentChoice === 'online' ? 'Proceed To Payment & Schedule' : 'Confirm & Schedule Booking'}
        </button>
      </div>

      {/* Cash payment confirmation modal */}
      {showCashConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-neutral-950">Confirm Cash Booking</h3>
            <p className="mt-2 text-sm text-neutral-600">
              You selected <span className="font-semibold">pay in cash</span>. The provider will collect <span className="font-semibold text-[#b25f27]">₹{totalAmount}</span> after the service.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCashConfirmModal(false)}
                className="flex-1 rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:border-coral"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCashConfirmModal(false);
                  onConfirm();
                }}
                className="flex-1 rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
