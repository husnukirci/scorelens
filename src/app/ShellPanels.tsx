// Interim shell panels: they demonstrate the Phase 3 exit criteria (user and
// window switches refetch; network loss degrades sanely through DataState)
// and are replaced by the real feature slices in Phases 4–6.
import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { reliabilityQueryOptions } from '@/api/queries'
import { Card } from '@/components/Card'
import { DataState } from '@/components/DataState'
import { TransactionsPanel } from '@/features/transactions/TransactionsPanel'
import { queryErrorMessage, toDataStateStatus } from '@/utils/asyncStatus'

export function ShellPanels({
  userId,
  windowFrom,
}: {
  userId: string
  windowFrom: string
}): ReactElement {
  const reliability = useQuery(reliabilityQueryOptions(userId, windowFrom))

  return (
    <>
      <Card title="Reliability">
        <DataState
          status={toDataStateStatus(reliability)}
          errorMessage={queryErrorMessage(reliability)}
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
      <TransactionsPanel userId={userId} windowFrom={windowFrom} />
    </>
  )
}
