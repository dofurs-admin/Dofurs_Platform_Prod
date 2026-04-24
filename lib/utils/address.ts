export type SavedAddressLike = {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
};

function normalizeSegment(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function collectUniqueAddressSegments(parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of parts) {
    if (typeof part !== 'string') {
      continue;
    }

    const segments = part
      .split(',')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    for (const segment of segments) {
      const normalized = normalizeSegment(segment);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(segment);
    }
  }

  return result;
}

export function formatAddressParts(parts: Array<string | null | undefined>): string {
  return collectUniqueAddressSegments(parts).join(', ');
}

export function formatSavedAddress(address: SavedAddressLike): string {
  return formatAddressParts([
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]);
}

export function sanitizeAddressText(address: string | null | undefined): string | null {
  if (typeof address !== 'string') {
    return null;
  }

  const normalized = formatAddressParts([address]);
  return normalized.length > 0 ? normalized : null;
}