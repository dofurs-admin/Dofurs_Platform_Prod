import { create } from 'zustand';
import { createIdempotencyKey } from '../utils/idempotency';

export type BookingMode = 'home_visit' | 'clinic_visit' | 'teleconsult';
export type BookingPaymentChoice = 'online' | 'cash' | 'subscription_credit';

export type BookingDraft = {
  providerServiceId: string | null;
  providerId: number | null;
  petId: number | null;
  selectedPetIds: number[];
  bundleSelections: Array<{ petId: number; providerServiceId: string; quantity: number }>;
  bookingDate: string | null;
  startTime: string | null;
  bookingMode: BookingMode | null;
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
  selectedAddressId: string | null;
  addOns: Array<{ id: string; quantity: number }>;
  discountCode: string | null;
  providerNotes: string | null;
  walletCreditsAppliedInr: number;
  paymentChoice: BookingPaymentChoice;
  directBookingOperationKey: string | null;
  bookingOrderOperationKey: string | null;
  paymentVerificationOperationKey: string | null;
  pendingPaymentOrderId: string | null;
  pendingPaymentTransactionId: string | null;
  pendingPaymentCreatedAt: string | null;
};

type PersistedBookingDraftV1 = {
  version: 1;
  savedAt: string;
  draft: {
    providerServiceId: string | null;
    providerId: number | null;
    petId: number | null;
    selectedPetIds?: number[];
    bundleSelections?: Array<{ petId: number; providerServiceId: string; quantity: number }>;
    bookingDate: string | null;
    startTime: string | null;
    bookingMode: BookingMode | null;
    selectedAddressId: string | null;
    addOns?: Array<{ id: string; quantity: number }>;
    discountCode: string | null;
    walletCreditsAppliedInr: number;
    paymentChoice?: BookingPaymentChoice;
    directBookingOperationKey: string | null;
    bookingOrderOperationKey: string | null;
    paymentVerificationOperationKey: string | null;
    pendingPaymentOrderId: string | null;
    pendingPaymentTransactionId: string | null;
    pendingPaymentCreatedAt: string | null;
  };
};

const BOOKING_DRAFT_STORAGE_KEY = 'current';
const BOOKING_DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type DraftStorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let cachedDraftStorageAdapter: DraftStorageAdapter | null = null;

function getWebStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

async function getDraftStorageAdapter(): Promise<DraftStorageAdapter> {
  if (cachedDraftStorageAdapter) {
    return cachedDraftStorageAdapter;
  }

  try {
    const secureStoreModule = await import('../auth/secure-store');
    cachedDraftStorageAdapter = secureStoreModule.createSecureStoreAdapter('dofurs.mobile.booking-draft');
    return cachedDraftStorageAdapter;
  } catch {
    const storage = getWebStorage();
    cachedDraftStorageAdapter = {
      async getItem(key) {
        return storage ? storage.getItem(`dofurs.mobile.booking-draft.${key}`) : null;
      },
      async setItem(key, value) {
        if (storage) {
          storage.setItem(`dofurs.mobile.booking-draft.${key}`, value);
        }
      },
      async removeItem(key) {
        if (storage) {
          storage.removeItem(`dofurs.mobile.booking-draft.${key}`);
        }
      },
    };
    return cachedDraftStorageAdapter;
  }
}

type BookingDraftState = {
  draft: BookingDraft;
  hasHydratedDraft: boolean;
  hydrateDraftFromStorage: () => Promise<void>;
  setServiceSelection: (input: {
    providerServiceId: string;
    providerId: number;
    bookingMode: BookingMode;
  }) => void;
  setPetSelection: (petId: number) => void;
  setBundleSelections: (input: {
    selectedPetIds: number[];
    bundleSelections: Array<{ petId: number; providerServiceId: string; quantity: number }>;
  }) => void;
  setDateTimeSelection: (input: {
    bookingDate: string;
    startTime: string;
    bookingMode: BookingMode;
  }) => void;
  setAddressSelection: (input: {
    locationAddress?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    pincode?: string | null;
    selectedAddressId?: string | null;
  }) => void;
  setAddOnSelection: (input: {
    addOns: Array<{ id: string; quantity: number }>;
  }) => void;
  reconcileProviderSelection: (input: {
    providerServiceId: string;
    providerId: number;
    bookingMode?: BookingMode | null;
  }) => void;
  setPricingSelection: (input: {
    discountCode?: string | null;
    providerNotes?: string | null;
    walletCreditsAppliedInr?: number;
  }) => void;
  setPaymentChoice: (choice: BookingPaymentChoice) => void;
  setPendingPaymentOrder: (input: {
    providerOrderId: string;
    transactionId?: string | null;
  }) => void;
  clearPendingPaymentOrder: () => void;
  resetOnlinePaymentAttempt: () => void;
  ensureDirectBookingOperationKey: () => string;
  ensureBookingOrderOperationKey: () => string;
  ensurePaymentVerificationOperationKey: () => string;
  resetAfterSlotConflict: () => void;
  clearDraft: () => void;
};

function createEmptyDraft(): BookingDraft {
  return {
    providerServiceId: null,
    providerId: null,
    petId: null,
    selectedPetIds: [],
    bundleSelections: [],
    bookingDate: null,
    startTime: null,
    bookingMode: null,
    locationAddress: null,
    latitude: null,
    longitude: null,
    pincode: null,
    selectedAddressId: null,
    addOns: [],
    discountCode: null,
    providerNotes: null,
    walletCreditsAppliedInr: 0,
    paymentChoice: 'cash',
    directBookingOperationKey: null,
    bookingOrderOperationKey: null,
    paymentVerificationOperationKey: null,
    pendingPaymentOrderId: null,
    pendingPaymentTransactionId: null,
    pendingPaymentCreatedAt: null,
  };
}

function createOperationKey(kind: 'direct' | 'order' | 'verify') {
  return createIdempotencyKey(`mobile-booking-${kind}`);
}

function isPersistableDraft(draft: BookingDraft) {
  return typeof draft.providerServiceId === 'string' && draft.providerServiceId.length > 0;
}

function toPersistedBookingDraft(draft: BookingDraft): PersistedBookingDraftV1 {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    draft: {
      providerServiceId: draft.providerServiceId,
      providerId: draft.providerId,
      petId: draft.petId,
      selectedPetIds: draft.selectedPetIds,
      bundleSelections: draft.bundleSelections,
      bookingDate: draft.bookingDate,
      startTime: draft.startTime,
      bookingMode: draft.bookingMode,
      selectedAddressId: draft.selectedAddressId,
      addOns: draft.addOns,
      discountCode: draft.discountCode,
      walletCreditsAppliedInr: draft.walletCreditsAppliedInr,
      paymentChoice: draft.paymentChoice,
      directBookingOperationKey: draft.directBookingOperationKey,
      bookingOrderOperationKey: draft.bookingOrderOperationKey,
      paymentVerificationOperationKey: draft.paymentVerificationOperationKey,
      pendingPaymentOrderId: draft.pendingPaymentOrderId,
      pendingPaymentTransactionId: draft.pendingPaymentTransactionId,
      pendingPaymentCreatedAt: draft.pendingPaymentCreatedAt,
    },
  };
}

function fromPersistedBookingDraft(input: unknown): BookingDraft | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const payload = input as Partial<PersistedBookingDraftV1>;
  if (payload.version !== 1 || typeof payload.savedAt !== 'string' || !payload.draft || typeof payload.draft !== 'object') {
    return null;
  }

  const savedAtMs = Date.parse(payload.savedAt);
  if (!Number.isFinite(savedAtMs)) {
    return null;
  }

  if (Date.now() - savedAtMs > BOOKING_DRAFT_MAX_AGE_MS) {
    return null;
  }

  const draft = payload.draft;

  const parsedAddOns = Array.isArray(draft.addOns)
    ? draft.addOns
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }

          const id = typeof (entry as { id?: unknown }).id === 'string' ? (entry as { id: string }).id.trim() : '';
          const quantityRaw = Number((entry as { quantity?: unknown }).quantity ?? NaN);
          const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.round(quantityRaw)) : NaN;

          if (!id || !Number.isFinite(quantity) || quantity <= 0) {
            return null;
          }

          return { id, quantity };
        })
        .filter((entry): entry is { id: string; quantity: number } => Boolean(entry))
    : [];

  const paymentChoice: BookingPaymentChoice =
    draft.paymentChoice === 'online' || draft.paymentChoice === 'subscription_credit' || draft.paymentChoice === 'cash'
      ? draft.paymentChoice
      : 'cash';

  const selectedPetIds = Array.isArray(draft.selectedPetIds)
    ? draft.selectedPetIds
        .map((value) => Number(value))
        .filter((value, index, array) => Number.isInteger(value) && value > 0 && array.indexOf(value) === index)
    : [];

  const parsedBundleSelections = Array.isArray(draft.bundleSelections)
    ? draft.bundleSelections
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }

          const petId = Number((entry as { petId?: unknown }).petId ?? NaN);
          const providerServiceId =
            typeof (entry as { providerServiceId?: unknown }).providerServiceId === 'string'
              ? (entry as { providerServiceId: string }).providerServiceId.trim()
              : '';
          const quantityRaw = Number((entry as { quantity?: unknown }).quantity ?? NaN);
          const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.min(2, Math.round(quantityRaw))) : NaN;

          if (!Number.isInteger(petId) || petId <= 0 || providerServiceId.length === 0 || !Number.isFinite(quantity)) {
            return null;
          }

          return { petId, providerServiceId, quantity };
        })
        .filter((entry): entry is { petId: number; providerServiceId: string; quantity: number } => Boolean(entry))
    : [];

  return {
    ...createEmptyDraft(),
    providerServiceId: typeof draft.providerServiceId === 'string' && draft.providerServiceId.length > 0 ? draft.providerServiceId : null,
    providerId: Number.isFinite(draft.providerId) ? Number(draft.providerId) : null,
    petId: Number.isFinite(draft.petId) ? Number(draft.petId) : null,
    selectedPetIds,
    bundleSelections: parsedBundleSelections,
    bookingDate: typeof draft.bookingDate === 'string' && draft.bookingDate.length > 0 ? draft.bookingDate : null,
    startTime: typeof draft.startTime === 'string' && draft.startTime.length > 0 ? draft.startTime : null,
    bookingMode:
      draft.bookingMode === 'clinic_visit' || draft.bookingMode === 'teleconsult' || draft.bookingMode === 'home_visit'
        ? draft.bookingMode
        : null,
    selectedAddressId: typeof draft.selectedAddressId === 'string' && draft.selectedAddressId.length > 0 ? draft.selectedAddressId : null,
    addOns: parsedAddOns,
    discountCode: typeof draft.discountCode === 'string' && draft.discountCode.length > 0 ? draft.discountCode : null,
    walletCreditsAppliedInr:
      Number.isFinite(draft.walletCreditsAppliedInr) && Number(draft.walletCreditsAppliedInr) > 0
        ? Math.round(Number(draft.walletCreditsAppliedInr))
        : 0,
    paymentChoice,
    directBookingOperationKey:
      typeof draft.directBookingOperationKey === 'string' && draft.directBookingOperationKey.length > 0
        ? draft.directBookingOperationKey
        : null,
    bookingOrderOperationKey:
      typeof draft.bookingOrderOperationKey === 'string' && draft.bookingOrderOperationKey.length > 0
        ? draft.bookingOrderOperationKey
        : null,
    paymentVerificationOperationKey:
      typeof draft.paymentVerificationOperationKey === 'string' && draft.paymentVerificationOperationKey.length > 0
        ? draft.paymentVerificationOperationKey
        : null,
    pendingPaymentOrderId:
      typeof draft.pendingPaymentOrderId === 'string' && draft.pendingPaymentOrderId.length > 0
        ? draft.pendingPaymentOrderId
        : null,
    pendingPaymentTransactionId:
      typeof draft.pendingPaymentTransactionId === 'string' && draft.pendingPaymentTransactionId.length > 0
        ? draft.pendingPaymentTransactionId
        : null,
    pendingPaymentCreatedAt:
      typeof draft.pendingPaymentCreatedAt === 'string' && draft.pendingPaymentCreatedAt.length > 0
        ? draft.pendingPaymentCreatedAt
        : null,
  };
}

async function persistDraft(draft: BookingDraft) {
  const storageAdapter = await getDraftStorageAdapter();

  if (!isPersistableDraft(draft)) {
    await storageAdapter.removeItem(BOOKING_DRAFT_STORAGE_KEY);
    return;
  }

  const serialized = JSON.stringify(toPersistedBookingDraft(draft));
  await storageAdapter.setItem(BOOKING_DRAFT_STORAGE_KEY, serialized);
}

async function clearPersistedDraft() {
  const storageAdapter = await getDraftStorageAdapter();
  await storageAdapter.removeItem(BOOKING_DRAFT_STORAGE_KEY);
}

function persistDraftAsync(draft: BookingDraft) {
  void persistDraft(draft).catch(() => null);
}

function normalizeBookingMode(mode: BookingMode): BookingMode {
  if (mode === 'clinic_visit' || mode === 'teleconsult') {
    return mode;
  }

  return 'home_visit';
}

export const useBookingDraftStore = create<BookingDraftState>((set, get) => ({
  draft: createEmptyDraft(),
  hasHydratedDraft: false,

  hydrateDraftFromStorage: async () => {
    if (get().hasHydratedDraft) {
      return;
    }

    try {
      const storageAdapter = await getDraftStorageAdapter();
      const rawValue = await storageAdapter.getItem(BOOKING_DRAFT_STORAGE_KEY);
      if (!rawValue) {
        set({ hasHydratedDraft: true });
        return;
      }

      const parsed = JSON.parse(rawValue) as unknown;
      const hydratedDraft = fromPersistedBookingDraft(parsed);

      if (!hydratedDraft) {
        await clearPersistedDraft();
        set({ hasHydratedDraft: true });
        return;
      }

      set((state) => {
        if (isPersistableDraft(state.draft)) {
          return { hasHydratedDraft: true };
        }

        return {
          draft: hydratedDraft,
          hasHydratedDraft: true,
        };
      });
    } catch {
      set({ hasHydratedDraft: true });
    }
  },

  setServiceSelection: ({ providerServiceId, providerId, bookingMode }) => {
    const nextDraft = {
        ...createEmptyDraft(),
        providerServiceId,
        providerId,
        bookingMode: normalizeBookingMode(bookingMode),
      };

    set({ draft: nextDraft });
    persistDraftAsync(nextDraft);
  },

  setPetSelection: (petId) => {
    set((state) => {
      const nextDraft = {
        ...state.draft,
        petId,
        selectedPetIds:
          state.draft.selectedPetIds.length > 0
            ? state.draft.selectedPetIds
            : (Number.isInteger(petId) && petId > 0 ? [petId] : []),
        bookingDate: null,
        startTime: null,
        locationAddress: null,
        latitude: null,
        longitude: null,
        pincode: null,
        selectedAddressId: null,
        addOns: [],
        discountCode: null,
        providerNotes: null,
        walletCreditsAppliedInr: 0,
        paymentChoice: 'cash' as const,
        directBookingOperationKey: null,
        bookingOrderOperationKey: null,
        paymentVerificationOperationKey: null,
        pendingPaymentOrderId: null,
        pendingPaymentTransactionId: null,
        pendingPaymentCreatedAt: null,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  setBundleSelections: ({ selectedPetIds, bundleSelections }) => {
    set((state) => {
      const normalizedSelectedPetIds = selectedPetIds
        .map((value) => Number(value))
        .filter((value, index, array) => Number.isInteger(value) && value > 0 && array.indexOf(value) === index);

      const normalizedBundleSelections = bundleSelections
        .map((entry) => {
          const petId = Number(entry.petId);
          const providerServiceId = typeof entry.providerServiceId === 'string' ? entry.providerServiceId.trim() : '';
          const quantityRaw = Number(entry.quantity);
          const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.min(2, Math.round(quantityRaw))) : 0;

          if (
            !Number.isInteger(petId) ||
            petId <= 0 ||
            providerServiceId.length === 0 ||
            quantity <= 0 ||
            !normalizedSelectedPetIds.includes(petId)
          ) {
            return null;
          }

          return { petId, providerServiceId, quantity };
        })
        .filter((entry): entry is { petId: number; providerServiceId: string; quantity: number } => Boolean(entry));

      const nextDraft = {
        ...state.draft,
        selectedPetIds: normalizedSelectedPetIds,
        bundleSelections: normalizedBundleSelections,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  setDateTimeSelection: ({ bookingDate, startTime, bookingMode }) => {
    set((state) => {
      const nextDraft = {
        ...state.draft,
        bookingDate,
        startTime,
        bookingMode: normalizeBookingMode(bookingMode),
        locationAddress: null,
        latitude: null,
        longitude: null,
        pincode: null,
        selectedAddressId: null,
        addOns: [],
        discountCode: null,
        providerNotes: null,
        walletCreditsAppliedInr: 0,
        paymentChoice: 'cash' as const,
        directBookingOperationKey: null,
        bookingOrderOperationKey: null,
        paymentVerificationOperationKey: null,
        pendingPaymentOrderId: null,
        pendingPaymentTransactionId: null,
        pendingPaymentCreatedAt: null,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  setPendingPaymentOrder: ({ providerOrderId, transactionId }) => {
    set((state) => {
      const nextDraft = {
        ...state.draft,
        pendingPaymentOrderId: providerOrderId.trim() || null,
        pendingPaymentTransactionId: transactionId?.trim() || null,
        pendingPaymentCreatedAt: new Date().toISOString(),
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  clearPendingPaymentOrder: () => {
    set((state) => {
      const nextDraft = {
        ...state.draft,
        pendingPaymentOrderId: null,
        pendingPaymentTransactionId: null,
        pendingPaymentCreatedAt: null,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  resetOnlinePaymentAttempt: () => {
    set((state) => {
      const nextDraft = {
        ...state.draft,
        bookingOrderOperationKey: null,
        paymentVerificationOperationKey: null,
        pendingPaymentOrderId: null,
        pendingPaymentTransactionId: null,
        pendingPaymentCreatedAt: null,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  setAddressSelection: ({ locationAddress, latitude, longitude, pincode, selectedAddressId }) => {
    set((state) => {
      const nextDraft = {
        ...state.draft,
        locationAddress: locationAddress?.trim() || null,
        latitude: Number.isFinite(latitude) ? Number(latitude) : null,
        longitude: Number.isFinite(longitude) ? Number(longitude) : null,
        pincode: pincode?.trim() || null,
        selectedAddressId: selectedAddressId?.trim() || null,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  reconcileProviderSelection: ({ providerServiceId, providerId, bookingMode }) => {
    set((state) => {
      const previousProviderServiceId = state.draft.providerServiceId;
      const nextDraft = {
        ...state.draft,
        providerServiceId,
        providerId,
        bundleSelections: state.draft.bundleSelections.map((entry) => (
          entry.providerServiceId === previousProviderServiceId
            ? { ...entry, providerServiceId }
            : entry
        )),
        bookingMode: bookingMode ? normalizeBookingMode(bookingMode) : state.draft.bookingMode,
        directBookingOperationKey: null,
        bookingOrderOperationKey: null,
        paymentVerificationOperationKey: null,
        pendingPaymentOrderId: null,
        pendingPaymentTransactionId: null,
        pendingPaymentCreatedAt: null,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  setAddOnSelection: ({ addOns }) => {
    set((state) => {
      const normalized = addOns
        .map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id.trim() : '',
          quantity: Number.isFinite(entry.quantity) ? Math.max(1, Math.round(entry.quantity)) : 0,
        }))
        .filter((entry) => entry.id.length > 0 && entry.quantity > 0);

      const nextDraft = {
        ...state.draft,
        addOns: normalized,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  setPricingSelection: ({ discountCode, providerNotes, walletCreditsAppliedInr }) => {
    set((state) => {
      const nextDraft = {
        ...state.draft,
        discountCode: discountCode?.trim() || null,
        providerNotes: providerNotes?.trim() || null,
        walletCreditsAppliedInr:
          Number.isFinite(walletCreditsAppliedInr) && (walletCreditsAppliedInr ?? 0) > 0
            ? Math.round(walletCreditsAppliedInr ?? 0)
            : 0,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  setPaymentChoice: (choice) => {
    set((state) => {
      const nextDraft = {
        ...state.draft,
        paymentChoice: choice,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  ensureDirectBookingOperationKey: () => {
    const existing = get().draft.directBookingOperationKey;
    if (typeof existing === 'string' && existing.length > 0) {
      return existing;
    }

    const created = createOperationKey('direct');
    set((state) => {
      const nextDraft = {
        ...state.draft,
        directBookingOperationKey: created,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });

    return created;
  },

  ensureBookingOrderOperationKey: () => {
    const existing = get().draft.bookingOrderOperationKey;
    if (typeof existing === 'string' && existing.length > 0) {
      return existing;
    }

    const created = createOperationKey('order');
    set((state) => {
      const nextDraft = {
        ...state.draft,
        bookingOrderOperationKey: created,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });

    return created;
  },

  ensurePaymentVerificationOperationKey: () => {
    const existing = get().draft.paymentVerificationOperationKey;
    if (typeof existing === 'string' && existing.length > 0) {
      return existing;
    }

    const created = createOperationKey('verify');
    set((state) => {
      const nextDraft = {
        ...state.draft,
        paymentVerificationOperationKey: created,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });

    return created;
  },

  resetAfterSlotConflict: () => {
    set((state) => {
      const nextDraft = {
        ...state.draft,
        startTime: null,
        locationAddress: null,
        latitude: null,
        longitude: null,
        pincode: null,
        selectedAddressId: null,
        addOns: [],
        discountCode: null,
        providerNotes: null,
        walletCreditsAppliedInr: 0,
        paymentChoice: 'cash' as const,
        directBookingOperationKey: null,
        bookingOrderOperationKey: null,
        paymentVerificationOperationKey: null,
        pendingPaymentOrderId: null,
        pendingPaymentTransactionId: null,
        pendingPaymentCreatedAt: null,
      };

      persistDraftAsync(nextDraft);
      return { draft: nextDraft };
    });
  },

  clearDraft: () => {
    set({ draft: createEmptyDraft() });
    void clearPersistedDraft().catch(() => null);
  },
}));