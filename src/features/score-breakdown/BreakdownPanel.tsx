import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { reliabilityQueryOptions } from '@/api/queries'
import { Card } from '@/components/Card'
import { DataState } from '@/components/DataState'
import { signalMeta } from '@/domain/signals'
import { queryErrorMessage, toDataStateStatus } from '@/utils/asyncStatus'

import { BreakdownChart } from './BreakdownChart'
import { deriveContributions } from './deriveContributions'

export function BreakdownPanel({
  userId,
  windowFrom,
}: {
  userId: string
  windowFrom: string
}): ReactElement {
  const breakdown = useQuery({
    ...reliabilityQueryOptions(userId, windowFrom),
    // module-level function: Query memoizes the projection per response
    select: deriveContributions,
  })

  return (
    <Card title="Score breakdown">
      <DataState
        status={toDataStateStatus(breakdown)}
        errorMessage={queryErrorMessage(breakdown)}
        onRetry={() => void breakdown.refetch()}
      >
        {breakdown.data !== undefined && (
          <>
            <BreakdownChart contributions={breakdown.data.contributions} />
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              {breakdown.data.contributions.map((contribution) => {
                const meta = signalMeta(contribution.signalId)
                return (
                  <li key={contribution.signalId}>
                    <span className="text-ink-muted">{meta.label}: </span>
                    <span className="font-medium tabular-nums">
                      {contribution.points} / {meta.maxPoints}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">
              Contributions are derived by this tool from the reported metrics and drivers — the
              scoring service does not publish per-signal points.
              {breakdown.data.residualError !== 0 &&
                ` ${Math.abs(breakdown.data.residualError)} point(s) could not be attributed.`}
            </p>
          </>
        )}
      </DataState>
    </Card>
  )
}
