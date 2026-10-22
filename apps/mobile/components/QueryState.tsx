import React from 'react';
import { QueryObserverResult, RefetchOptions } from '@tanstack/react-query';
import { ErrorState, LoadingState, OfflineIndicator, StaleLabel } from './ui';
import { isNetworkError } from '../lib/api-client';

export function QueryState<T>({
  query,
  children,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    data: T | undefined;
    dataUpdatedAt: number;
    refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<T, Error>>;
  };
  children: (data: T) => React.ReactNode;
}) {
  const isOffline = query.isError && isNetworkError(query.error);

  if (query.isLoading && !query.data) return <LoadingState />;

  if (query.isError && !query.data) {
    const message = isOffline
      ? 'Network unavailable. You are currently offline.'
      : query.error instanceof Error
      ? query.error.message
      : 'Request failed';
    return <ErrorState message={message} retry={() => { void query.refetch(); }} />;
  }

  if (!query.data) return <LoadingState />;

  const isStale = !isOffline && (query.isError || Date.now() - query.dataUpdatedAt > 60_000);

  return (
    <>
      <OfflineIndicator visible={isOffline} />
      {children(query.data)}
      <StaleLabel visible={isStale} />
    </>
  );
}
