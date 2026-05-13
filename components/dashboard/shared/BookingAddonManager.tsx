'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui';

export type BookingAddonItem = {
  id: string;
  name_snapshot: string;
  quantity: number;
  status: string;
  total_price_inr?: number | null;
  total_price_snapshot?: number | null;
};

export type BookingAddonOption = {
  id: string;
  mappingId: string;
  serviceId: string;
  addonTemplateId: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  durationMinutes: number | null;
  price: number;
  minQuantity: number;
  maxQuantity: number;
  defaultQuantity: number;
  isRequired: boolean;
};

type AddonPayload = {
  success?: boolean;
  error?: string;
  data?: {
    bookingStatus?: string;
    canMutate?: boolean;
    items?: BookingAddonItem[];
    options?: BookingAddonOption[];
  };
};

type Props = {
  bookingId: number;
  source: 'pre_service' | 'in_service' | 'admin_adjustment' | 'booking_flow';
  title?: string;
  interactionMode?: 'full' | 'add-only';
  addButtonLabel?: string;
  onUpdated?: () => void;
  onItemsChange?: (items: BookingAddonItem[]) => void;
};

const MUTABLE_ITEM_STATUSES = new Set(['selected', 'confirmed', 'fulfilled']);
const TERMINAL_ITEM_STATUSES = new Set(['cancelled', 'refunded']);

function isItemMutableStatus(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (MUTABLE_ITEM_STATUSES.has(normalized)) {
    return true;
  }

  return !TERMINAL_ITEM_STATUSES.has(normalized);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveItemTotal(item: BookingAddonItem) {
  return Math.max(0, Number(item.total_price_inr ?? item.total_price_snapshot ?? 0));
}

function prettyStatus(value: string) {
  return value.replace(/_/g, ' ');
}

export default function BookingAddonManager({
  bookingId,
  source,
  title = 'Add-ons',
  interactionMode = 'full',
  addButtonLabel = 'Add New Add-on',
  onUpdated,
  onItemsChange,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [mutatingItemId, setMutatingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BookingAddonItem[]>([]);
  const [options, setOptions] = useState<BookingAddonOption[]>([]);
  const [canMutate, setCanMutate] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [selectedMappingId, setSelectedMappingId] = useState<string>('');
  const [addQuantity, setAddQuantity] = useState(1);
  const [isAddComposerOpen, setIsAddComposerOpen] = useState(interactionMode === 'full');
  const onItemsChangeRef = useRef<Props['onItemsChange']>(onItemsChange);
  const onUpdatedRef = useRef<Props['onUpdated']>(onUpdated);

  const isAddOnlyMode = interactionMode === 'add-only';

  const selectedOption = useMemo(
    () => options.find((option) => option.mappingId === selectedMappingId) ?? null,
    [options, selectedMappingId],
  );

  const hasMutableItems = useMemo(() => items.some((item) => isItemMutableStatus(item.status)), [items]);

  const hasAddableOptions = canMutate && options.length > 0;
  const hasNoAddableOptions = canMutate && options.length === 0;

  useEffect(() => {
    onItemsChangeRef.current = onItemsChange;
  }, [onItemsChange]);

  useEffect(() => {
    onUpdatedRef.current = onUpdated;
  }, [onUpdated]);

  useEffect(() => {
    if (interactionMode === 'full') {
      setIsAddComposerOpen(true);
    }
  }, [interactionMode]);

  useEffect(() => {
    if (interactionMode === 'add-only') {
      setIsAddComposerOpen(false);
    }
  }, [bookingId, interactionMode]);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/bookings/${bookingId}/addons`, { cache: 'no-store' });
        const payload = (await response.json().catch(() => null)) as AddonPayload | null;

        if (!active) {
          return;
        }

        if (!response.ok || !payload?.success) {
          setItems([]);
          setOptions([]);
          setCanMutate(false);
          setBookingStatus(null);
          onItemsChangeRef.current?.([]);
          setError(payload?.error ?? 'Unable to load add-ons.');
          return;
        }

        const nextItems = payload.data?.items ?? [];
        setItems(nextItems);
        setOptions(payload.data?.options ?? []);
        setCanMutate(Boolean(payload.data?.canMutate));
        setBookingStatus(payload.data?.bookingStatus ?? null);
        onItemsChangeRef.current?.(nextItems);
      } catch {
        if (!active) {
          return;
        }

        setItems([]);
        setOptions([]);
        setCanMutate(false);
        setBookingStatus(null);
        onItemsChangeRef.current?.([]);
        setError('Unable to load add-ons.');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [bookingId]);

  useEffect(() => {
    if (options.length === 0) {
      setSelectedMappingId('');
      setAddQuantity(1);
      return;
    }

    if (!options.some((option) => option.mappingId === selectedMappingId)) {
      const first = options[0];
      const firstMin = Math.max(1, first.minQuantity);
      const firstMax = Math.max(firstMin, first.maxQuantity);
      const nextDefault = clamp(
        Math.max(first.defaultQuantity, first.isRequired ? 1 : firstMin),
        firstMin,
        firstMax,
      );
      setSelectedMappingId(first.mappingId);
      setAddQuantity(nextDefault);
      return;
    }

    const min = Math.max(1, selectedOption?.minQuantity ?? 1);
    const max = Math.max(min, selectedOption?.maxQuantity ?? 25);
    setAddQuantity((previous) => clamp(previous, min, max));
  }, [options, selectedMappingId, selectedOption]);

  async function reloadAfterMutation() {
    const response = await fetch(`/api/bookings/${bookingId}/addons`, { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as AddonPayload | null;

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error ?? 'Unable to refresh add-ons.');
    }

    const nextItems = payload.data?.items ?? [];
    setItems(nextItems);
    setOptions(payload.data?.options ?? []);
    setCanMutate(Boolean(payload.data?.canMutate));
    setBookingStatus(payload.data?.bookingStatus ?? null);
    onItemsChangeRef.current?.(nextItems);
    onUpdatedRef.current?.();
  }

  async function addAddon() {
    if (!selectedOption || isAdding || !canMutate) {
      return;
    }

    setError(null);

    const min = Math.max(1, selectedOption.minQuantity);
    const max = Math.max(min, selectedOption.maxQuantity);
    const quantity = clamp(addQuantity, min, max);
    const confirmationMessage = isAddOnlyMode
      ? `Add ${selectedOption.name} (Qty ${quantity}) to this booking?\n\nThis action is irreversible.`
      : `Add ${selectedOption.name} (Qty ${quantity}) to this booking?`;

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setIsAdding(true);

    try {
      const response = await fetch(`/api/bookings/${bookingId}/addons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mappingId: selectedOption.mappingId,
          quantity,
          source,
        }),
      });

      const payload = (await response.json().catch(() => null)) as AddonPayload | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? 'Unable to add add-on.');
      }

      await reloadAfterMutation();
      if (isAddOnlyMode) {
        setIsAddComposerOpen(false);
      }
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to add add-on.');
    } finally {
      setIsAdding(false);
    }
  }

  async function updateItem(itemId: string, payload: { quantity?: number; status?: string }) {
    if (mutatingItemId || !canMutate) {
      return;
    }

    setError(null);
    setMutatingItemId(itemId);

    try {
      const response = await fetch(`/api/bookings/${bookingId}/addons`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, ...payload }),
      });

      const responsePayload = (await response.json().catch(() => null)) as AddonPayload | null;

      if (!response.ok || !responsePayload?.success) {
        throw new Error(responsePayload?.error ?? 'Unable to update add-on.');
      }

      await reloadAfterMutation();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to update add-on.');
    } finally {
      setMutatingItemId(null);
    }
  }

  async function removeItem(item: BookingAddonItem) {
    if (mutatingItemId || !canMutate) {
      return;
    }

    const shouldRemove = window.confirm(
      `Remove ${item.name_snapshot} from this booking?\n\nThis action will cancel this add-on line item.`,
    );

    if (!shouldRemove) {
      return;
    }

    await updateItem(item.id, { status: 'cancelled' });
  }

  return (
    <div className="rounded-xl border border-[#ead3bf] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{title}</p>
        {bookingStatus ? (
          <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
            {prettyStatus(bookingStatus)}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-neutral-500">Loading add-ons...</p>
      ) : (
        <>
          {items.length > 0 ? (
            <div className="mt-3 space-y-2">
              {items.map((item) => {
                const itemIsMutable = !isAddOnlyMode && canMutate && isItemMutableStatus(item.status);
                const itemIsUpdating = mutatingItemId === item.id;

                return (
                  <div key={item.id} className="rounded-lg border border-[#efe2d7] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-neutral-700">{item.name_snapshot}</span>
                      <span className="font-semibold text-neutral-900">Rs. {resolveItemTotal(item)}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-neutral-500">
                        {prettyStatus(item.status)}
                      </span>

                      {itemIsMutable ? (
                        <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-1 py-0.5">
                          <button
                            type="button"
                            className="h-6 w-6 rounded-full border border-neutral-200 text-sm font-semibold text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => {
                              if (item.quantity <= 1) {
                                void removeItem(item);
                                return;
                              }

                              void updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) });
                            }}
                            disabled={itemIsUpdating}
                            aria-label={
                              item.quantity <= 1
                                ? `Remove ${item.name_snapshot}`
                                : `Decrease quantity for ${item.name_snapshot}`
                            }
                          >
                            -
                          </button>
                          <span className="min-w-7 text-center font-semibold text-neutral-700">{item.quantity}</span>
                          <button
                            type="button"
                            className="h-6 w-6 rounded-full border border-neutral-200 text-sm font-semibold text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => {
                              void updateItem(item.id, { quantity: item.quantity + 1 });
                            }}
                            disabled={itemIsUpdating}
                            aria-label={`Increase quantity for ${item.name_snapshot}`}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-neutral-500">
                          Qty {item.quantity}
                        </span>
                      )}

                      {itemIsMutable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          isLoading={itemIsUpdating}
                          onClick={() => {
                            void removeItem(item);
                          }}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">No add-ons added yet.</p>
          )}

          {hasAddableOptions ? (
            <div className="mt-4 space-y-3">
              {isAddOnlyMode && !isAddComposerOpen ? (
                <Button type="button" size="sm" variant="premium" onClick={() => setIsAddComposerOpen(true)}>
                  {addButtonLabel}
                </Button>
              ) : null}

              {(!isAddOnlyMode || isAddComposerOpen) ? (
                <div className="space-y-3 rounded-lg border border-[#efe2d7] bg-[#fffbf7] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Add New Add-on</p>

                  <label className="block text-xs font-medium text-neutral-600" htmlFor={`addon-option-${bookingId}`}>
                    Add-on
                  </label>
                  <select
                    id={`addon-option-${bookingId}`}
                    className="w-full rounded-lg border border-[#ead3bf] bg-white px-3 py-2 text-sm text-neutral-900"
                    value={selectedMappingId}
                    onChange={(event) => setSelectedMappingId(event.target.value)}
                    disabled={isAdding}
                  >
                    {options.map((option) => (
                      <option key={option.mappingId} value={option.mappingId}>
                        {option.name} (Rs. {Math.max(0, Number(option.price ?? 0))})
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-neutral-600">Quantity</span>
                    <button
                      type="button"
                      className="h-7 w-7 rounded-full border border-neutral-200 text-sm font-semibold text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => {
                        if (!selectedOption) {
                          return;
                        }
                        const min = Math.max(1, selectedOption.minQuantity);
                        setAddQuantity((previous) => Math.max(min, previous - 1));
                      }}
                      disabled={isAdding || !selectedOption}
                      aria-label="Decrease add-on quantity"
                    >
                      -
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold text-neutral-700">{addQuantity}</span>
                    <button
                      type="button"
                      className="h-7 w-7 rounded-full border border-neutral-200 text-sm font-semibold text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => {
                        if (!selectedOption) {
                          return;
                        }
                        const min = Math.max(1, selectedOption.minQuantity);
                        const max = Math.max(min, selectedOption.maxQuantity);
                        setAddQuantity((previous) => Math.min(max, previous + 1));
                      }}
                      disabled={isAdding || !selectedOption}
                      aria-label="Increase add-on quantity"
                    >
                      +
                    </button>
                  </div>

                  {selectedOption ? (
                    <p className="text-xs text-neutral-500">
                      Allowed quantity: {Math.max(1, selectedOption.minQuantity)} to {Math.max(Math.max(1, selectedOption.minQuantity), selectedOption.maxQuantity)}
                    </p>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    {isAddOnlyMode ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsAddComposerOpen(false)}
                        disabled={isAdding}
                      >
                        Close
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="premium" isLoading={isAdding} onClick={addAddon}>
                      Add Add-on
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {isAddOnlyMode && items.length > 0 && hasAddableOptions ? (
            <p className="mt-3 text-xs text-neutral-500">
              Selected add-ons cannot be reduced here. You can only add new add-ons.
            </p>
          ) : null}

          {isAddOnlyMode && hasNoAddableOptions ? (
            <p className="mt-3 text-xs text-neutral-500">
              No additional add-ons are available for this booking right now.
            </p>
          ) : null}

          {!canMutate && hasMutableItems ? (
            <p className="mt-3 text-xs text-neutral-500">
              Add-ons are locked because this booking is no longer editable.
            </p>
          ) : null}

          {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        </>
      )}
    </div>
  );
}
