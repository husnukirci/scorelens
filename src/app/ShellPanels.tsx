// Interim shell panels: they demonstrate the Phase 3 exit criteria (user and
// window switches refetch; network loss degrades sanely through DataState)
// and are replaced by the real feature slices in Phases 4–6.
import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { reliabilityQueryOptions, transactionsQueryOptions } from '@/api/queries'
import { ApiError } from '@/api/types'
import { Card } from '@/components/Card'
import { DataState } from '@/components/DataState'
import type { DataStateStatus } from '@/components/DataState'

function toDataStateStatus(query: UseQueryResult<unknown>): DataStateStatus {
  if (query.status === 'pending') {
    // offline with nothing cached: Query pauses the fetch — an endless
    // skeleton would lie, so surface it as a retryable error state
    return query.fetchStatus === 'paused' ? 'error' : 'loading'
  }
  if (query.status === 'error') return 'error'
  return 'ready'
}

function errorMessageOf(query: UseQueryResult<unknown>): string | undefined {
  if (query.status === 'pending' && query.fetchStatus === 'paused') {
    return 'You appear to be offline. Data loads automatically when the connection returns.'
  }
  return query.error instanceof ApiError ? query.error.message : undefined
}

export function ShellPanels({
  userId,
  windowFrom,
}: {
  userId: string
  windowFrom: string
}): ReactElement {
  const reliability = useQuery(reliabilityQueryOptions(userId, windowFrom))
  const transactions = useQuery(transactionsQueryOptions(userId, windowFrom))
  const transactionCount = Object.keys(transactions.data ?? {}).length

  return (
    <>
      <Card title="Reliability">
        <DataState
          status={toDataStateStatus(reliability)}
          errorMessage={errorMessageOf(reliability)}
          onRetry={() => void reliability.refetch()}
        >
          <p className="text-3xl font-semibold" data-testid="shell-score">
            {reliability.data?.reliability_index}
            <span className="ml-2 align-middle text-sm font-medium text-ink-muted">
              {reliability.data?.score_band}
            </span>
          </p>
        </DataState>
      </Card>
      <Card title="Transactions">
        <DataState
          status={
            toDataStateStatus(transactions) === 'ready' && transactionCount === 0
              ? 'empty'
              : toDataStateStatus(transactions)
          }
          errorMessage={errorMessageOf(transactions)}
          onRetry={() => void transactions.refetch()}
          emptyMessage="No transactions in this scoring window."
        >
          <p className="text-sm" data-testid="shell-txn-count">
            {transactionCount} transactions loaded for the 6-month window ending {windowFrom}.
          </p>
        </DataState>
      </Card>
    </>
  )
}
