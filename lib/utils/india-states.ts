/**
 * Indian states and union territories — shared across address forms.
 */

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

/** Known aliases the India Post API may return instead of official names. */
const STATE_ALIASES: Record<string, string> = {
  orissa: 'Odisha',
  uttaranchal: 'Uttarakhand',
  pondicherry: 'Puducherry',
  'daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'dadra and nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'jammu & kashmir': 'Jammu and Kashmir',
  'andaman and nicobar': 'Andaman and Nicobar Islands',
  'a & n islands': 'Andaman and Nicobar Islands',
};

/**
 * Match an API-returned state name to one of the official INDIAN_STATES values.
 * Returns null if no match is found.
 */
export function findMatchingState(apiStateName: string): string | null {
  const trimmed = apiStateName.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  // Exact match (case-insensitive)
  const exact = INDIAN_STATES.find((s) => s.toLowerCase() === lower);
  if (exact) return exact;

  // Alias match
  const alias = STATE_ALIASES[lower];
  if (alias) return alias;

  return null;
}
