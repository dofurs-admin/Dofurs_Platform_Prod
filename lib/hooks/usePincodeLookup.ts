'use client';

import { useEffect, useState } from 'react';
import { isValidIndianPincode, lookupPincode } from '@/lib/utils/india-pincode';

/**
 * Debounced pincode lookup hook.
 * When pincode reaches 6 valid digits, fetches city/state from the API.
 * Returns null values until a successful lookup; isAutoFilled indicates a result is ready.
 */
export function usePincodeLookup(pincode: string) {
  const [city, setCity] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoFilled, setIsAutoFilled] = useState(false);

  useEffect(() => {
    if (!isValidIndianPincode(pincode)) {
      setCity(null);
      setState(null);
      setCountry(null);
      setIsAutoFilled(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      const result = await lookupPincode(pincode);

      if (cancelled) return;

      if (result) {
        setCity(result.city);
        setState(result.state);
        setCountry(result.country);
        setIsAutoFilled(true);
      } else {
        setCity(null);
        setState(null);
        setCountry(null);
        setIsAutoFilled(false);
      }

      setIsLoading(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pincode]);

  return { city, state, country, isLoading, isAutoFilled };
}
