import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { reliabilityQueryOptions } from '@/api/queries'
import type { ReliabilityResponse } from '@/api/types'
import { Badge } from '@/components/Badge'
import type { BadgeTone } from '@/components/Badge'
import { Card } from '@/components/Card'
import { DataState } from '@/components/DataState'
import { bandMeta } from '@/domain/scoreBands'
import { queryErrorMessage, toDataStateStatus } from '@/utils/asyncStatus'

/** Module-level so TanStack Query can memoize the projection. */
function selectOverview(reliability: ReliabilityResponse): {
  index: number
  band: string
  goodMonths: number
  negativeBalanceDays: number
  lateFeeEvents: number
  coverageRatio: number
} {
  return {
    index: reliability.reliability_index,
    band: reliability.score_band,
    goodMonths: reliability.metrics.good_months,
    negativeBalanceDays: reliability.metrics.negative_balance_days,
    lateFeeEvents: reliability.metrics.late_fee_events,
    coverageRatio: reliability.metrics.income_coverage_ratio,
  }
}

const TONE_BY_TOKEN: Record<string, BadgeTone> = {
  'band-low': 'low',
  'band-medium': 'medium',
  'band-high': 'high',
}

export function OverviewPanel({
  userId,
  windowFrom,
}: {
  userId: string
  windowFrom: string
}): ReactElement {
  const overview = useQuery({
    ...reliabilityQueryOptions(userId, windowFrom),
    select: selectOverview,
  })
  const band = bandMeta(overview.data?.band ?? '')

  return (
    <Card title="Reliability overview">
      <DataState
        status={toDataStateStatus(overview)}
        errorMessage={queryErrorMessage(overview)}
        onRetry={() => void overview.refetch()}
      >
        <div className="flex items-center gap-4">
          <p className="text-5xl font-semibold tabular-nums" data-testid="overview-score">
            {overview.data?.index}
          </p>
          <div className="space-y-1">
            <Badge label={band.label} tone={TONE_BY_TOKEN[band.colorToken] ?? 'neutral'} />
            <p className="text-sm text-ink-muted">6-month scoring window ending {windowFrom}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-ink-muted">Good cashflow months</dt>
            <dd className="font-medium">{overview.data?.goodMonths}/6</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Income coverage</dt>
            <dd className="font-medium">{overview.data?.coverageRatio}×</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Negative balance days</dt>
            <dd className="font-medium">{overview.data?.negativeBalanceDays}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Late fee events</dt>
            <dd className="font-medium">{overview.data?.lateFeeEvents}</dd>
          </div>
        </dl>
      </DataState>
    </Card>
  )
}
