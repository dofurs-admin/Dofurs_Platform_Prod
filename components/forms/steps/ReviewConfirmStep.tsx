'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/ToastProvider';
import Modal from '@/components/ui/Modal';

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
type PricingBreakdown = {
  base_total: number;
  addon_total: number;
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

function formatCreditAmount(value: number) {
  return `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
}

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
  onChangeAddress: () => void;
  onChangeDateTime: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export default function ReviewConfirmStep({
  selectedService,
  selectedPet,
  selectedPets = [],
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
  bundlePriceTotal = 0,
  totalDurationMinutes = 0,
  onPrev,
  onChangeSelectedService,
  onChangePet,
  onChangeAddress,
  onChangeDateTime,
  onConfirm,
  isPending,
}: ReviewConfirmStepProps) {
  const { showToast } = useToast();
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [availableWalletCredits, setAvailableWalletCredits] = useState(0);
  const [applyCredits, setApplyCredits] = useState(false);
  const [showDiscountEditor, setShowDiscountEditor] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

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

  useEffect(() => {
    if (discountPreview || discountCode.trim()) {
      setShowDiscountEditor(true);
    }
  }, [discountCode, discountPreview]);

  function handleToggleCredits() {
    const next = !applyCredits;
    setApplyCredits(next);
    if (next) {
      onWalletCreditsToApplyChange(Math.min(availableWalletCredits, amountAfterDiscount));
    } else {
      onWalletCreditsToApplyChange(0);
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTimeLabel = (value: string) => {
    const parts = value.split(':');
    if (parts.length < 2) {
      return value;
    }

    const hours = Number.parseInt(parts[0], 10);
    const minutes = Number.parseInt(parts[1], 10);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return value;
    }

    const normalized = new Date();
    normalized.setHours(hours, minutes, 0, 0);
    return normalized.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
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

  const isMultiService = bookingBundleRows.length > 1 || totalSelectedServices > 1;

  const selectedAddOnRows = addOns
    .filter((addon) => selectedAddOns[addon.id] > 0)
    .map((addon) => ({
      id: addon.id,
      name: addon.name,
      quantity: selectedAddOns[addon.id],
      amount: addon.price * selectedAddOns[addon.id],
    }));
  const selectedAddOnsTotal = selectedAddOnRows.reduce((sum, row) => sum + row.amount, 0);

  const servicesUnitTotal = isMultiService
    ? bundlePriceTotal
    : (priceCalculation?.base_total ?? selectedService?.base_price ?? bundlePriceTotal ?? 0);

  const addOnsUnitTotal = priceCalculation?.addon_total ?? selectedAddOnsTotal;

  const subtotalBeforeDiscount = (servicesUnitTotal + addOnsUnitTotal) * boardingNights;
  const discountAmount = discountPreview?.discountAmount ?? priceCalculation?.discount_amount ?? 0;
  const amountAfterDiscount = Math.max(0, subtotalBeforeDiscount - discountAmount);
  const totalAmount = Math.max(0, amountAfterDiscount - walletCreditsToApply);
  const hasPriceData =
    subtotalBeforeDiscount > 0 ||
    Boolean(priceCalculation) ||
    Boolean(discountPreview) ||
    bookingBundleRows.length > 0 ||
    selectedAddOnRows.length > 0;

  const paymentDescription =
    walletCreditsToApply > 0 && totalAmount === 0
      ? 'Your Dofurs Credits cover the full amount. No additional payment needed.'
      : paymentChoice === 'subscription_credit'
        ? 'Subscription credit value is reserved when booking is created and restored if the booking is cancelled.'
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
    .map((row) => ({
      id: `${row.petId}-${row.serviceType}`,
      label: `${row.petName}: ${row.serviceType}${row.quantity > 1 ? ` x${row.quantity}` : ''}`,
      amount: Math.max(0, (row.unitBasePrice ?? 0) * row.quantity),
    }))
    .slice(0, 4);
  const petSummaryRows = (selectedPets.length > 0 ? selectedPets : selectedPet ? [selectedPet] : []).slice(0, 4);
  const totalSelectedPets = selectedPets.length > 0 ? selectedPets.length : selectedPet ? 1 : 0;

  return (
    <div className="premium-fade-up space-y-2 sm:space-y-7 rounded-2xl sm:rounded-3xl border border-[#e9d7c7] bg-[linear-gradient(165deg,#fffdfb_0%,#fff8f1_100%)] p-2.5 max-[380px]:p-2 sm:p-5 shadow-[0_10px_30px_rgba(79,47,25,0.08)] md:p-7">
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
                {serviceSummaryRows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-2 text-[10px] sm:text-xs text-neutral-600">
                    <span className="break-words">{row.label}</span>
                    <span className="shrink-0 font-medium text-neutral-700">₹{row.amount}</span>
                  </div>
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
          {selectedAddOnRows.length > 0 ? (
            <div className="mt-1.5 rounded-lg border border-[#efcfb4] bg-[linear-gradient(165deg,#fffaf6_0%,#fff4ea_100%)] p-1.5 shadow-[0_6px_16px_rgba(154,90,47,0.08)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8c4a22]">Included add-ons</p>
                <span className="rounded-full border border-[#e9c3a3] bg-white/90 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-semibold text-[#7a3c1a]">
                  +₹{selectedAddOnsTotal}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {selectedAddOnRows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-2 text-[9px] sm:text-[10px] text-[#6c4328]">
                    <span className="truncate">{row.name} × {row.quantity}</span>
                    <span className="shrink-0 font-semibold text-[#7a3c1a]">₹{row.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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
              {formatTimeLabel(slotStartTime)}
              {totalDurationMinutes > 0 ? ` • ${totalDurationMinutes}m` : ''}
            </p>
          ) : null}
          {isMultiService && !isPackageBooking && (
            <p className="mt-0.5 text-[10px] text-neutral-500">
              Back-to-back from {formatTimeLabel(slotStartTime)}
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

      {/* Location and notes */}
      <div className="space-y-1.5 sm:space-y-3">
        {bookingMode === 'home_visit' && locationAddress ? (
          <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-2.5 max-[380px]:p-2 sm:p-4">
            <p className="text-[10px] sm:text-xs font-semibold text-neutral-600 uppercase">Service Address</p>
            <p className="mt-1 text-[11px] sm:text-xs text-neutral-600 line-clamp-2">{locationAddress}</p>
            <button
              type="button"
              onClick={onChangeAddress}
              className="mt-2 inline-flex rounded-full border border-[#e6c7af] bg-[#fff7f0] px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#9a5a2f] transition-colors hover:bg-[#ffeedf]"
            >
              Change address
            </button>
          </div>
        ) : null}

        {providerNotes && (
          <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-3 sm:p-4">
            <p className="text-xs font-semibold text-neutral-600 uppercase">Notes</p>
            <p className="mt-2 text-sm text-neutral-950">{providerNotes}</p>
          </div>
        )}
      </div>

      {/* Discount section */}
      <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-2.5 max-[380px]:p-2 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm font-semibold text-neutral-950">Discount Code</p>
          <button
            type="button"
            onClick={() => setShowDiscountEditor((prev) => !prev)}
            className="rounded-full border border-[#e7c4a7] bg-[#fffaf6] px-3 py-1 text-[11px] font-semibold text-[#8f4a1d]"
          >
            {showDiscountEditor ? 'Hide' : 'Add code'}
          </button>
        </div>

        {showDiscountEditor ? (
          <div className="mt-2.5">
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
        ) : null}
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
        <label className="mt-2 flex items-start gap-2 text-sm sm:text-xs text-neutral-700">
          <input
            type="radio"
            name="payment-choice"
            checked={paymentChoice === 'online'}
            onChange={() => onPaymentChoiceChange('online')}
            className="mt-0.5"
          />
          <span>
            Pay online now (Razorpay)
          </span>
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
                ? ` (${formatCreditAmount(creditEligibility.availableCredits)} credit value available)`
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
        <p className="mt-2 text-[9px] leading-tight text-neutral-500/90 sm:text-[10px]">{paymentDescription}</p>
        <p className="mt-1 text-[9px] leading-tight text-neutral-500/90 sm:text-[10px]">
          Subscription credits can be used for eligible grooming services. Birthday and boarding bookings are excluded.
        </p>
      </div>

      {/* Price breakdown */}
      <div className="rounded-lg sm:rounded-xl border border-[#d6b79a] bg-[linear-gradient(165deg,#fff8ef_0%,#fff0e3_100%)] p-2.5 max-[380px]:p-2 sm:p-4">
        {!hasPriceData ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-1/2 rounded bg-[#e8d5c0]" />
            <div className="h-6 w-1/3 rounded bg-[#e8d5c0]" />
          </div>
        ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">{boardingNights > 1 ? 'Services per night:' : isMultiService ? 'Services subtotal:' : 'Base service amount:'}</span>
            <span className="font-medium text-neutral-950">₹{servicesUnitTotal}</span>
          </div>
          {addOnsUnitTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Add-ons subtotal:</span>
              <span className="font-medium text-neutral-950">₹{addOnsUnitTotal}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Subtotal before discount:</span>
            <span className="font-medium text-neutral-950">₹{subtotalBeforeDiscount}</span>
          </div>
          {boardingNights > 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">× {boardingNights} nights:</span>
              <span className="font-medium text-neutral-950">Included above</span>
            </div>
          )}
          {discountAmount > 0 ? (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Discount:</span>
              <span className="font-medium text-green-700">-₹{discountAmount}</span>
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

      <div className="rounded-lg sm:rounded-xl border border-[#e7d3c1] bg-white p-2.5 max-[380px]:p-2 sm:p-4">
        <p className="text-[11px] leading-relaxed text-neutral-700 sm:text-xs">
          By clicking {paymentChoice === 'online' ? 'Proceed to Payment' : 'Confirm Booking'}, you accept the{' '}
          <button
            type="button"
            onClick={() => setShowTermsModal(true)}
            className="font-semibold text-[#8f4a1d] underline underline-offset-2 hover:text-[#7a3f1a]"
          >
            Dofurs Terms &amp; Conditions
          </button>{' '}
          including the pet safety and aggressive behaviour liability clauses.
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
          onClick={onConfirm}
          disabled={isPending}
          className="w-full rounded-full bg-[linear-gradient(115deg,#de9158,#c7773b)] px-8 py-2 sm:py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(199,119,59,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(199,119,59,0.3)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isPending ? 'Processing...' : paymentChoice === 'online' ? 'Proceed to Payment' : 'Confirm Booking'}
        </button>
      </div>

      <Modal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Terms & Conditions"
        description="Key booking conditions for Dofurs services"
        size="lg"
      >
        <div className="space-y-3 text-sm text-neutral-700">
          <p className="font-semibold text-neutral-900">Important safety and liability points</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Dofurs does not service pets that are known to be aggressive or unsafe to handle.</li>
            <li>If aggression is undisclosed or discovered during the visit, service may be refused or stopped.</li>
            <li>Applicable visit, slot-blocking, or cancellation charges may still apply in such situations.</li>
            <li>
              The booking customer is responsible for losses caused by aggressive pet behaviour, including bites,
              injuries, and property or equipment damage.
            </li>
          </ul>
          <p className="text-xs text-neutral-500">
            This popup is a booking summary. The full legal terms apply to every booking.
          </p>
          <Link
            href="/terms-conditions"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setShowTermsModal(false)}
            className="inline-flex rounded-full border border-[#e7c4a7] bg-[#fff7ef] px-4 py-2 text-xs font-semibold text-[#8f4a1d] transition hover:bg-[#ffefdf]"
          >
            Open full Terms &amp; Conditions
          </Link>
        </div>
      </Modal>
    </div>
  );
}
