/**
 * India pincode utilities — validation and city/state lookup via server proxy.
 */

const cache = new Map<string, { city: string; state: string; country: string }>();

/** Returns true if the string is a valid 6-digit Indian pincode. */
export function isValidIndianPincode(pincode: string): boolean {
  return /^[1-9]\d{5}$/.test(pincode);
}

/**
 * Look up city, state, and country for an Indian pincode.
 * Calls the internal `/api/pincode/[pincode]` proxy route.
 * Returns null on any failure — callers should fall back to manual entry.
 */
export async function lookupPincode(
  pincode: string,
): Promise<{ city: string; state: string; country: string } | null> {
  if (!isValidIndianPincode(pincode)) return null;

  const cached = cache.get(pincode);
  if (cached) return cached;

  try {
    const response = await fetch(`/api/pincode/${encodeURIComponent(pincode)}`);
    if (!response.ok) return null;

    const data = (await response.json()) as { city: string | null; state: string | null; country: string | null };
    if (!data.city || !data.state) return null;

    const result = { city: data.city, state: data.state, country: data.country || 'India' };
    cache.set(pincode, result);
    return result;
  } catch (err) { console.error(err);
    return null;
  }
}
