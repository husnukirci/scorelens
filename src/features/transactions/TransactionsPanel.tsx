import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { transactionsQueryKey, transactionsQueryOptions } from '@/api/queries'
import { Card } from '@/components/Card'
import { DataState } from '@/components/DataState'
import { useUiStore } from '@/state/uiStore'
import { queryErrorMessage, toDataStateStatus } from '@/utils/asyncStatus'

import { generateStressRecord } from './devStress'
import { FilterBar } from './FilterBar'
import { TransactionTable } from './TransactionTable'
import { useVisibleTransactions } from './useVisibleTransactions'

function EmptyFilterResult(): ReactElement {
  const clearFilters = useUiStore((state) => state.clearFilters)
  return (
    <div className="space-y-2 py-6 text-center text-sm text-ink-muted">
      <p>No transactions match the active filters.</p>
      <button
        type="button"
        onClick={clearFilters}
        className="rounded-md border border-ink/20 px-3 py-1 font-medium text-ink hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none"
      >
        Clear filters
      </button>
    </div>
  )
}

function DevStressButton({
  userId,
  windowFrom,
}: {
  userId: string
  windowFrom: string
}): ReactElement {
  const queryClient = useQueryClient()
  return (
    <button
      type="button"
      onClick={() =>
        queryClient.setQueryData(
          transactionsQueryKey(userId, windowFrom),
          generateStressRecord(25_000),
        )
      }
      className="rounded-md border border-dashed border-ink/30 px-2 py-1 text-xs text-ink-muted hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none"
    >
      dev: load 25k synthetic rows
    </button>
  )
}

export function TransactionsPanel({
  userId,
  windowFrom,
}: {
  userId: string
  windowFrom: string
}): ReactElement {
  const transactions = useQuery(transactionsQueryOptions(userId, windowFrom))
  const visible = useVisibleTransactions(transactions.data)
  const total = Object.keys(transactions.data ?? {}).length
  const baseStatus = toDataStateStatus(transactions)
  const status = baseStatus === 'ready' && total === 0 ? 'empty' : baseStatus

  return (
    <Card title="Transactions">
      <DataState
        status={status}
        errorMessage={queryErrorMessage(transactions)}
        onRetry={() => void transactions.refetch()}
        emptyMessage="No transactions in this scoring window."
      >
        <FilterBar visible={visible.length} total={total} />
        {visible.length === 0 ? <EmptyFilterResult /> : <TransactionTable transactions={visible} />}
        {import.meta.env.DEV && <DevStressButton userId={userId} windowFrom={windowFrom} />}
      </DataState>
    </Card>
  )
}
