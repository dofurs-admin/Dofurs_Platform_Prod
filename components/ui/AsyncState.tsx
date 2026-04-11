import type { ReactNode } from 'react';
import LoadingSkeleton from './LoadingSkeleton';

type AsyncStateProps = {
  isLoading: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  loadingFallback?: ReactNode;
  loadingLines?: number;
  emptyFallback?: ReactNode;
  isEmpty?: boolean;
  children: ReactNode;
};

/**
 * Reusable component for handling async states
 * 
 * Automatically renders appropriate UI based on:
 * - isLoading: Shows loading fallback or skeleton
 * - isError: Shows error message with styled error box
 * - isEmpty: Shows empty fallback message
 * - default: Shows children (success state)
 * 
 * @example
 * <AsyncState
 *   isLoading={isLoading}
 *   isError={hasError}
 *   errorMessage={errorMsg}
 *   isEmpty={data.length === 0}
 * >
 *   <DataList data={data} />
 * </AsyncState>
 */
export default function AsyncState({
  isLoading,
  isError = false,
  errorMessage,
  loadingFallback,
  loadingLines = 3,
  emptyFallback,
  isEmpty = false,
  children,
}: AsyncStateProps) {
  if (isLoading) {
    return (
      <>
        {loadingFallback ?? <LoadingSkeleton lines={loadingLines} />}
      </>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-[#ffd9d2] bg-[#fff3f0] p-3 text-sm text-[#b74129]">
        {errorMessage ?? 'Something went wrong.'}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <>
        {emptyFallback ?? <div className="text-sm text-[#6b6b6b]">No data found.</div>}
      </>
    );
  }

  return <>{children}</>;
}
