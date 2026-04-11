export type DiscountType = 'percentage' | 'flat';

export function calculateDiscountAmount(
  discountType: DiscountType,
  discountValue: number,
  baseAmount: number,
  maxDiscountAmount?: number | null,
) {
  const raw = discountType === 'percentage' ? (baseAmount * discountValue) / 100 : discountValue;
  const bounded = maxDiscountAmount !== null && maxDiscountAmount !== undefined ? Math.min(raw, maxDiscountAmount) : raw;
  return roundCurrency(Math.max(0, bounded));
}

export function applyDiscount(baseAmount: number, discountAmount: number) {
  return roundCurrency(Math.max(0, baseAmount - Math.max(0, discountAmount)));
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
