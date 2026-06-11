import { queryOptions } from '@tanstack/react-query'

import { subtractCalendarMonths } from '@/utils/dates'

import { apiFetch } from './client'
import { fetchAllTransactions } from './transactions'
import type { ReliabilityResponse } from './types'

export const SCORING_WINDOW_MONTHS = 6

/**
 * Query keys are built from client state only (ADR-02): user + window.
 * Filters/search/sort never enter keys — they are client-side derives.
 * The SSE write path uses the same builders (one key source of truth).
 */
export function transactionsQueryKey(
  userId: string,
  windowFrom: string,
): readonly ['transactions', string, string] {
  return ['transactions', userId, windowFrom] as const
}

export function reliabilityQueryKey(
  userId: string,
  windowFrom: string,
): readonly ['reliability', string, string] {
  return ['reliability', userId, windowFrom] as const
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types -- queryOptions' inferred DataTag return type is the contract; naming it would erase the key/data inference it exists to provide
export function transactionsQueryOptions(userId: string, windowFrom: string) {
  return queryOptions({
    queryKey: transactionsQueryKey(userId, windowFrom),
    queryFn: ({ signal }) =>
      fetchAllTransactions(userId, {
        from: subtractCalendarMonths(windowFrom, SCORING_WINDOW_MONTHS),
        to: windowFrom,
        signal,
      }),
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types -- same DataTag inference rationale as transactionsQueryOptions
export function reliabilityQueryOptions(userId: string, windowFrom: string) {
  return queryOptions({
    queryKey: reliabilityQueryKey(userId, windowFrom),
    queryFn: ({ signal }) =>
      apiFetch<ReliabilityResponse>(`/api/users/${userId}/reliability`, {
        signal,
        query: { from: windowFrom },
      }),
  })
}
