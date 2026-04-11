import { useState, useCallback } from 'react';

export type AsyncState<T> = {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  data: T | null;
  isEmpty: boolean;
};

export type AsyncStateActions<T> = {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setData: (data: T | null) => void;
  reset: () => void;
};

const defaultAsyncState = <T,>(): AsyncState<T> => ({
  isLoading: false,
  isError: false,
  errorMessage: null,
  data: null,
  isEmpty: false,
});

/**
 * Hook for managing async state (loading, error, data, empty)
 * 
 * @param initialData - Initial data value
 * @returns Current state and action functions
 * 
 * @example
 * const { isLoading, isError, errorMessage, data, isEmpty, setLoading, setError, setData, reset } = useAsyncState<Pet[]>([]);
 * 
 * // During async operation
 * setLoading(true);
 * try {
 *   const result = await fetchPets();
 *   setData(result);
 * } catch (err) {
 *   setError(err instanceof Error ? err.message : 'Failed to load pets');
 * } finally {
 *   setLoading(false);
 * }
 */
export function useAsyncState<T>(initialData: T | null = null) {
  const [state, setState] = useState<AsyncState<T>>({
    ...defaultAsyncState<T>(),
    data: initialData,
    isEmpty: initialData === null || (Array.isArray(initialData) && initialData.length === 0),
  });

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({
      ...prev,
      isError: error !== null,
      errorMessage: error,
    }));
  }, []);

  const setData = useCallback((data: T | null) => {
    setState((prev) => ({
      ...prev,
      data,
      isEmpty: data === null || (Array.isArray(data) && data.length === 0),
      isError: false,
      errorMessage: null,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(defaultAsyncState<T>());
  }, []);

  return {
    ...state,
    setLoading,
    setError,
    setData,
    reset,
  };
}
