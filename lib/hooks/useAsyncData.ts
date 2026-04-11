import { useEffect, useCallback } from 'react';
import { useAsyncState } from './useAsyncState';

/**
 * Hook for managing async data fetching with automatic state management
 * 
 * Handles loading, error, and empty states automatically
 * Includes automatic cleanup to prevent memory leaks
 * 
 * @param fetcher - Async function that returns data
 * @param deps - Dependencies array (like useEffect)
 * @returns Async state and data
 * 
 * @example
 * const { isLoading, isError, errorMessage, data, isEmpty } = useAsyncData(
 *   async () => {
 *     const res = await fetch('/api/pets');
 *     if (!res.ok) throw new Error('Failed to load pets');
 *     return res.json();
 *   },
 *   [userId]
 * );
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
) {
  const asyncState = useAsyncState<T>(null);

  const fetchData = useCallback(async () => {
    let isMounted = true;

    try {
      asyncState.setLoading(true);
      asyncState.setError(null);
      const result = await fetcher();
      
      if (isMounted) {
        asyncState.setData(result);
      }
    } catch (err) {
      if (isMounted) {
        const errorMsg = err instanceof Error ? err.message : 'An error occurred';
        asyncState.setError(errorMsg);
      }
    } finally {
      if (isMounted) {
        asyncState.setLoading(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [asyncState, fetcher]);

  useEffect(() => {
    const cleanup = fetchData();
    return () => {
      if (cleanup instanceof Promise) {
        cleanup.then((fn) => fn?.());
      }
    };
  }, [fetchData, deps]);

  return asyncState;
}
