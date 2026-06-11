/**
 * Maps TanStack Query result shapes onto the app's four async UI states.
 * Structural types only — utils import nothing internal, and the queries
 * themselves never reach this layer.
 */

export type DataStateStatus = 'loading' | 'error' | 'empty' | 'ready'

export interface QueryStateLike {
  status: 'pending' | 'error' | 'success'
  fetchStatus: 'fetching' | 'paused' | 'idle'
  error: unknown
}

const OFFLINE_MESSAGE =
  'You appear to be offline. Data loads automatically when the connection returns.'

function isPausedOffline(query: QueryStateLike): boolean {
  // offline with nothing cached: the fetch is paused — an endless skeleton
  // would lie, so it surfaces as a retryable error state
  return query.status === 'pending' && query.fetchStatus === 'paused'
}

export function toDataStateStatus(query: QueryStateLike): DataStateStatus {
  if (query.status === 'pending') return isPausedOffline(query) ? 'error' : 'loading'
  if (query.status === 'error') return 'error'
  return 'ready'
}

export function queryErrorMessage(query: QueryStateLike): string | undefined {
  if (isPausedOffline(query)) return OFFLINE_MESSAGE
  return query.error instanceof Error ? query.error.message : undefined
}
