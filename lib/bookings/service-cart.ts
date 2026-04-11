export type ServiceCartStoragePayload = {
  serviceId?: string | null;
  serviceCount?: number;
  addOns?: Array<{ id?: string; quantity?: number }>;
};

export function parseServiceCartCount(cartRaw: string | null | undefined): number {
  if (!cartRaw) {
    return 0;
  }

  try {
    const parsed = JSON.parse(cartRaw) as ServiceCartStoragePayload;
    const addOnTotal = Array.isArray(parsed.addOns)
      ? parsed.addOns.reduce((sum, item) => sum + Number(item?.quantity ?? 0), 0)
      : 0;
    const serviceCount = Number.isFinite(Number(parsed.serviceCount))
      ? Math.max(0, Number(parsed.serviceCount))
      : parsed.serviceId
        ? 1
        : 0;

    return serviceCount + addOnTotal;
  } catch {
    return 0;
  }
}

export function getVisibleServiceCartCount(isAuthenticated: boolean, cartRaw: string | null | undefined): number {
  if (!isAuthenticated) {
    return 0;
  }

  return parseServiceCartCount(cartRaw);
}
