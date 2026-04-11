import { useState } from 'react';

export function useOptimisticSelection<T>(initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [optimisticValue, setOptimisticValue] = useState<T>(initialValue);

  function update(next: T) {
    setOptimisticValue(next);
    setValue(next);
  }

  return {
    value,
    optimisticValue,
    update,
    setValue,
  };
}
