import { beforeEach, describe, expect, it } from 'vitest';
import { useBookingDraftStore } from './booking-draft-store';

describe('booking draft store lifecycle', () => {
  beforeEach(() => {
    useBookingDraftStore.getState().clearDraft();
  });

  it('accumulates service, pet, datetime, and address selections', () => {
    useBookingDraftStore.getState().setServiceSelection({
      providerServiceId: 'service-1',
      providerId: 42,
      bookingMode: 'home_visit',
    });
    useBookingDraftStore.getState().setPetSelection(7);
    useBookingDraftStore.getState().setDateTimeSelection({
      bookingDate: '2026-08-12',
      startTime: '10:30',
      bookingMode: 'home_visit',
    });
    useBookingDraftStore.getState().setAddressSelection({
      locationAddress: '12 MG Road, Bengaluru',
      latitude: 12.972,
      longitude: 77.594,
      pincode: '560001',
      selectedAddressId: 'address-1',
    });

    const draft = useBookingDraftStore.getState().draft;

    expect(draft.providerServiceId).toBe('service-1');
    expect(draft.providerId).toBe(42);
    expect(draft.petId).toBe(7);
    expect(draft.bookingDate).toBe('2026-08-12');
    expect(draft.startTime).toBe('10:30');
    expect(draft.bookingMode).toBe('home_visit');
    expect(draft.locationAddress).toBe('12 MG Road, Bengaluru');
    expect(draft.latitude).toBe(12.972);
    expect(draft.longitude).toBe(77.594);
    expect(draft.pincode).toBe('560001');
    expect(draft.selectedAddressId).toBe('address-1');
  });

  it('drops downstream fields when service changes', () => {
    useBookingDraftStore.getState().setServiceSelection({
      providerServiceId: 'service-1',
      providerId: 42,
      bookingMode: 'home_visit',
    });
    useBookingDraftStore.getState().setPetSelection(7);
    useBookingDraftStore.getState().setDateTimeSelection({
      bookingDate: '2026-08-12',
      startTime: '10:30',
      bookingMode: 'home_visit',
    });
    useBookingDraftStore.getState().setAddressSelection({
      locationAddress: '12 MG Road, Bengaluru',
      latitude: 12.972,
      longitude: 77.594,
    });

    useBookingDraftStore.getState().setServiceSelection({
      providerServiceId: 'service-2',
      providerId: 84,
      bookingMode: 'clinic_visit',
    });

    const draft = useBookingDraftStore.getState().draft;

    expect(draft.providerServiceId).toBe('service-2');
    expect(draft.providerId).toBe(84);
    expect(draft.bookingMode).toBe('clinic_visit');
    expect(draft.petId).toBeNull();
    expect(draft.bookingDate).toBeNull();
    expect(draft.startTime).toBeNull();
    expect(draft.locationAddress).toBeNull();
    expect(draft.latitude).toBeNull();
    expect(draft.longitude).toBeNull();
  });

  it('sanitizes pricing inputs and clears state on reset', () => {
    useBookingDraftStore.getState().setServiceSelection({
      providerServiceId: 'service-1',
      providerId: 42,
      bookingMode: 'home_visit',
    });

    useBookingDraftStore.getState().setPricingSelection({
      discountCode: ' SAVE100 ',
      providerNotes: ' gentle handling please ',
      walletCreditsAppliedInr: 120.4,
    });

    let draft = useBookingDraftStore.getState().draft;

    expect(draft.discountCode).toBe('SAVE100');
    expect(draft.providerNotes).toBe('gentle handling please');
    expect(draft.walletCreditsAppliedInr).toBe(120);

    useBookingDraftStore.getState().clearDraft();
    draft = useBookingDraftStore.getState().draft;

    expect(draft.providerServiceId).toBeNull();
    expect(draft.providerId).toBeNull();
    expect(draft.bookingMode).toBeNull();
    expect(draft.discountCode).toBeNull();
    expect(draft.providerNotes).toBeNull();
    expect(draft.walletCreditsAppliedInr).toBe(0);
  });

  it('clears stale slot, address, and pricing fields after slot conflict', () => {
    useBookingDraftStore.getState().setServiceSelection({
      providerServiceId: 'service-1',
      providerId: 42,
      bookingMode: 'home_visit',
    });
    useBookingDraftStore.getState().setPetSelection(7);
    useBookingDraftStore.getState().setDateTimeSelection({
      bookingDate: '2026-08-12',
      startTime: '10:30',
      bookingMode: 'home_visit',
    });
    useBookingDraftStore.getState().setAddressSelection({
      locationAddress: '12 MG Road, Bengaluru',
      latitude: 12.972,
      longitude: 77.594,
      pincode: '560001',
      selectedAddressId: 'address-1',
    });
    useBookingDraftStore.getState().setPricingSelection({
      discountCode: 'SAVE100',
      providerNotes: 'careful with nails',
      walletCreditsAppliedInr: 50,
    });

    useBookingDraftStore.getState().resetAfterSlotConflict();

    const draft = useBookingDraftStore.getState().draft;

    expect(draft.providerServiceId).toBe('service-1');
    expect(draft.providerId).toBe(42);
    expect(draft.petId).toBe(7);
    expect(draft.bookingDate).toBe('2026-08-12');
    expect(draft.startTime).toBeNull();
    expect(draft.locationAddress).toBeNull();
    expect(draft.latitude).toBeNull();
    expect(draft.longitude).toBeNull();
    expect(draft.pincode).toBeNull();
    expect(draft.selectedAddressId).toBeNull();
    expect(draft.discountCode).toBeNull();
    expect(draft.providerNotes).toBeNull();
    expect(draft.walletCreditsAppliedInr).toBe(0);
  });

  it('keeps operation keys stable across retries and rotates them when booking time changes', () => {
    useBookingDraftStore.getState().setServiceSelection({
      providerServiceId: 'service-1',
      providerId: 42,
      bookingMode: 'home_visit',
    });
    useBookingDraftStore.getState().setPetSelection(7);
    useBookingDraftStore.getState().setDateTimeSelection({
      bookingDate: '2026-08-12',
      startTime: '10:30',
      bookingMode: 'home_visit',
    });

    const directKey1 = useBookingDraftStore.getState().ensureDirectBookingOperationKey();
    const directKey2 = useBookingDraftStore.getState().ensureDirectBookingOperationKey();
    const orderKey1 = useBookingDraftStore.getState().ensureBookingOrderOperationKey();
    const orderKey2 = useBookingDraftStore.getState().ensureBookingOrderOperationKey();
    const verifyKey1 = useBookingDraftStore.getState().ensurePaymentVerificationOperationKey();
    const verifyKey2 = useBookingDraftStore.getState().ensurePaymentVerificationOperationKey();

    expect(directKey1).toBe(directKey2);
    expect(orderKey1).toBe(orderKey2);
    expect(verifyKey1).toBe(verifyKey2);

    useBookingDraftStore.getState().setDateTimeSelection({
      bookingDate: '2026-08-12',
      startTime: '11:00',
      bookingMode: 'home_visit',
    });

    const rotatedDirectKey = useBookingDraftStore.getState().ensureDirectBookingOperationKey();
    expect(rotatedDirectKey).not.toBe(directKey1);
  });

  it('tracks and clears pending payment order recovery metadata', () => {
    useBookingDraftStore.getState().setServiceSelection({
      providerServiceId: 'service-1',
      providerId: 42,
      bookingMode: 'home_visit',
    });

    useBookingDraftStore.getState().setPendingPaymentOrder({
      providerOrderId: 'order_12345',
      transactionId: 'tx_100',
    });

    let draft = useBookingDraftStore.getState().draft;
    expect(draft.pendingPaymentOrderId).toBe('order_12345');
    expect(draft.pendingPaymentTransactionId).toBe('tx_100');
    expect(typeof draft.pendingPaymentCreatedAt).toBe('string');

    useBookingDraftStore.getState().clearPendingPaymentOrder();
    draft = useBookingDraftStore.getState().draft;
    expect(draft.pendingPaymentOrderId).toBeNull();
    expect(draft.pendingPaymentTransactionId).toBeNull();
    expect(draft.pendingPaymentCreatedAt).toBeNull();
  });

  it('reconciles provider selection without clearing selected schedule and address context', () => {
    useBookingDraftStore.getState().setServiceSelection({
      providerServiceId: 'service-old',
      providerId: 11,
      bookingMode: 'home_visit',
    });
    useBookingDraftStore.getState().setPetSelection(7);
    useBookingDraftStore.getState().setDateTimeSelection({
      bookingDate: '2026-08-12',
      startTime: '10:30',
      bookingMode: 'home_visit',
    });
    useBookingDraftStore.getState().setAddressSelection({
      locationAddress: '12 MG Road, Bengaluru',
      latitude: 12.972,
      longitude: 77.594,
      pincode: '560001',
      selectedAddressId: 'address-1',
    });
    useBookingDraftStore.getState().setPendingPaymentOrder({
      providerOrderId: 'order_123',
      transactionId: 'tx_123',
    });

    useBookingDraftStore.getState().reconcileProviderSelection({
      providerServiceId: 'service-new',
      providerId: 22,
      bookingMode: 'home_visit',
    });

    const draft = useBookingDraftStore.getState().draft;

    expect(draft.providerServiceId).toBe('service-new');
    expect(draft.providerId).toBe(22);
    expect(draft.bookingDate).toBe('2026-08-12');
    expect(draft.startTime).toBe('10:30');
    expect(draft.locationAddress).toBe('12 MG Road, Bengaluru');
    expect(draft.selectedAddressId).toBe('address-1');
    expect(draft.pendingPaymentOrderId).toBeNull();
    expect(draft.pendingPaymentTransactionId).toBeNull();
    expect(draft.bookingOrderOperationKey).toBeNull();
    expect(draft.paymentVerificationOperationKey).toBeNull();
  });

  it('resets online payment attempt metadata and rotates order idempotency key', () => {
    useBookingDraftStore.getState().setServiceSelection({
      providerServiceId: 'service-1',
      providerId: 42,
      bookingMode: 'home_visit',
    });

    const initialOrderKey = useBookingDraftStore.getState().ensureBookingOrderOperationKey();
    useBookingDraftStore.getState().setPendingPaymentOrder({
      providerOrderId: 'order_abc',
      transactionId: 'tx_abc',
    });

    useBookingDraftStore.getState().resetOnlinePaymentAttempt();

    const draft = useBookingDraftStore.getState().draft;
    expect(draft.bookingOrderOperationKey).toBeNull();
    expect(draft.paymentVerificationOperationKey).toBeNull();
    expect(draft.pendingPaymentOrderId).toBeNull();
    expect(draft.pendingPaymentTransactionId).toBeNull();
    expect(draft.pendingPaymentCreatedAt).toBeNull();

    const nextOrderKey = useBookingDraftStore.getState().ensureBookingOrderOperationKey();
    expect(nextOrderKey).not.toBe(initialOrderKey);
  });

  it('stores add-on and payment choice selections and resets them when schedule is reselected', () => {
    useBookingDraftStore.getState().setServiceSelection({
      providerServiceId: 'service-1',
      providerId: 42,
      bookingMode: 'home_visit',
    });
    useBookingDraftStore.getState().setPetSelection(7);
    useBookingDraftStore.getState().setDateTimeSelection({
      bookingDate: '2026-08-12',
      startTime: '10:30',
      bookingMode: 'home_visit',
    });

    useBookingDraftStore.getState().setAddOnSelection({
      addOns: [{ id: 'addon-1', quantity: 2 }],
    });
    useBookingDraftStore.getState().setPaymentChoice('online');

    let draft = useBookingDraftStore.getState().draft;
    expect(draft.addOns).toEqual([{ id: 'addon-1', quantity: 2 }]);
    expect(draft.paymentChoice).toBe('online');

    useBookingDraftStore.getState().setDateTimeSelection({
      bookingDate: '2026-08-13',
      startTime: '11:00',
      bookingMode: 'home_visit',
    });

    draft = useBookingDraftStore.getState().draft;
    expect(draft.addOns).toEqual([]);
    expect(draft.paymentChoice).toBe('cash');
  });
});