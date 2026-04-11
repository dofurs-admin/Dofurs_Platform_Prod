import { describe, it, expect } from 'vitest';
import { calculateDiscountAmount, applyDiscount, roundCurrency } from './discountEngine';

describe('discountEngine', () => {
  describe('calculateDiscountAmount', () => {
    it('should calculate percentage discount correctly', () => {
      expect(calculateDiscountAmount('percentage', 10, 1000)).toBe(100);
      expect(calculateDiscountAmount('percentage', 25, 500)).toBe(125);
      expect(calculateDiscountAmount('percentage', 50, 200)).toBe(100);
    });

    it('should calculate flat discount correctly', () => {
      expect(calculateDiscountAmount('flat', 50, 1000)).toBe(50);
      expect(calculateDiscountAmount('flat', 100, 500)).toBe(100);
      expect(calculateDiscountAmount('flat', 25, 200)).toBe(25);
    });

    it('should apply max discount cap for percentage discounts', () => {
      // 20% of 1000 = 200, but capped at 150
      expect(calculateDiscountAmount('percentage', 20, 1000, 150)).toBe(150);
      
      // 50% of 500 = 250, but capped at 100
      expect(calculateDiscountAmount('percentage', 50, 500, 100)).toBe(100);
      
      // 10% of 1000 = 100, max cap 200 (no effect)
      expect(calculateDiscountAmount('percentage', 10, 1000, 200)).toBe(100);
    });

    it('should apply max discount cap for flat discounts', () => {
      // Flat 200 capped at 150
      expect(calculateDiscountAmount('flat', 200, 1000, 150)).toBe(150);
      
      // Flat 50 capped at 100 (no effect)
      expect(calculateDiscountAmount('flat', 50, 500, 100)).toBe(50);
    });

    it('should handle zero discount value', () => {
      expect(calculateDiscountAmount('percentage', 0, 1000)).toBe(0);
      expect(calculateDiscountAmount('flat', 0, 1000)).toBe(0);
    });

    it('should handle zero base amount', () => {
      expect(calculateDiscountAmount('percentage', 10, 0)).toBe(0);
      expect(calculateDiscountAmount('flat', 50, 0)).toBe(50);
    });

    it('should never return negative discount', () => {
      expect(calculateDiscountAmount('percentage', -10, 1000)).toBe(0);
      expect(calculateDiscountAmount('flat', -50, 1000)).toBe(0);
    });

    it('should handle null/undefined max discount cap', () => {
      expect(calculateDiscountAmount('percentage', 20, 1000, null)).toBe(200);
      expect(calculateDiscountAmount('percentage', 20, 1000, undefined)).toBe(200);
    });

    it('should round currency values correctly', () => {
      // 15% of 333.33 = 49.9995, should round to 50.00
      expect(calculateDiscountAmount('percentage', 15, 333.33)).toBe(50);
      
      // 33% of 100 = 33
      expect(calculateDiscountAmount('percentage', 33, 100)).toBe(33);
    });
  });

  describe('applyDiscount', () => {
    it('should subtract discount from base amount', () => {
      expect(applyDiscount(1000, 100)).toBe(900);
      expect(applyDiscount(500, 50)).toBe(450);
      expect(applyDiscount(250, 25)).toBe(225);
    });

    it('should never return negative final amount', () => {
      expect(applyDiscount(100, 150)).toBe(0);
      expect(applyDiscount(50, 100)).toBe(0);
      expect(applyDiscount(0, 50)).toBe(0);
    });

    it('should handle zero discount', () => {
      expect(applyDiscount(1000, 0)).toBe(1000);
    });

    it('should handle exact discount (final = 0)', () => {
      expect(applyDiscount(100, 100)).toBe(0);
    });

    it('should round currency correctly', () => {
      expect(applyDiscount(100.999, 50.555)).toBe(50.44);
      expect(applyDiscount(333.33, 111.11)).toBe(222.22);
    });

    it('should handle negative discount as zero', () => {
      expect(applyDiscount(100, -50)).toBe(100);
    });
  });

  describe('roundCurrency', () => {
    it('should round to 2 decimal places', () => {
      expect(roundCurrency(10.123)).toBe(10.12);
      expect(roundCurrency(10.125)).toBe(10.13);
      expect(roundCurrency(10.126)).toBe(10.13);
      expect(roundCurrency(10.129)).toBe(10.13);
    });

    it('should handle integers', () => {
      expect(roundCurrency(100)).toBe(100);
      expect(roundCurrency(0)).toBe(0);
    });

    it('should handle negative values', () => {
      expect(roundCurrency(-10.123)).toBe(-10.12);
      expect(roundCurrency(-10.129)).toBe(-10.13);
    });

    it('should handle edge cases', () => {
      expect(roundCurrency(0.001)).toBe(0);
      expect(roundCurrency(0.005)).toBe(0.01);
      expect(roundCurrency(0.004)).toBe(0);
    });
  });

  describe('Integration: Full Discount Flow', () => {
    it('should calculate and apply percentage discount with cap', () => {
      const baseAmount = 1000;
      const discountAmount = calculateDiscountAmount('percentage', 20, baseAmount, 150);
      const finalPrice = applyDiscount(baseAmount, discountAmount);
      
      expect(discountAmount).toBe(150); // 200 capped to 150
      expect(finalPrice).toBe(850);     // 1000 - 150
    });

    it('should calculate and apply flat discount', () => {
      const baseAmount = 500;
      const discountAmount = calculateDiscountAmount('flat', 75, baseAmount);
      const finalPrice = applyDiscount(baseAmount, discountAmount);
      
      expect(discountAmount).toBe(75);
      expect(finalPrice).toBe(425);
    });

    it('should handle edge case: discount equals base amount', () => {
      const baseAmount = 100;
      const discountAmount = calculateDiscountAmount('flat', 100, baseAmount);
      const finalPrice = applyDiscount(baseAmount, discountAmount);
      
      expect(discountAmount).toBe(100);
      expect(finalPrice).toBe(0);
    });

    it('should handle edge case: discount exceeds base amount', () => {
      const baseAmount = 50;
      const discountAmount = calculateDiscountAmount('flat', 100, baseAmount);
      const finalPrice = applyDiscount(baseAmount, discountAmount);
      
      expect(discountAmount).toBe(100);
      expect(finalPrice).toBe(0); // Floor at 0
    });

    it('should handle first-booking discount scenario', () => {
      // Common use case: 30% off first booking, max ₹200
      const bookingAmount = 800;
      const discount = calculateDiscountAmount('percentage', 30, bookingAmount, 200);
      const final = applyDiscount(bookingAmount, discount);
      
      expect(discount).toBe(200); // 240 capped to 200
      expect(final).toBe(600);
    });

    it('should handle seasonal discount scenario', () => {
      // Example: Flat ₹100 off weekday bookings
      const bookingAmount = 450;
      const discount = calculateDiscountAmount('flat', 100, bookingAmount);
      const final = applyDiscount(bookingAmount, discount);
      
      expect(discount).toBe(100);
      expect(final).toBe(350);
    });
  });
});
