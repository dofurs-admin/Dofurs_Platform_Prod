import { useMutation, useQuery, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';

export function useAppQuery<TData, TKey extends readonly unknown[]>(
  options: UseQueryOptions<TData, Error, TData, TKey>,
) {
  return useQuery(options);
}

export function useAppMutation<TData, TVariables = void>(
  options: UseMutationOptions<TData, Error, TVariables>,
) {
  return useMutation(options);
}
