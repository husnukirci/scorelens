import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { reliabilityQueryOptions } from '@/api/queries'
import type { ReliabilityResponse } from '@/api/types'
import { Card } from '@/components/Card'
import { DataState } from '@/components/DataState'
import { SIGNALS } from '@/domain/signals'
import { queryErrorMessage, toDataStateStatus } from '@/utils/asyncStatus'

import { classifyDrivers } from './classifyDrivers'
import type { ClassifiedDrivers } from './classifyDrivers'

function selectDrivers(reliability: ReliabilityResponse): ClassifiedDrivers {
  return classifyDrivers(reliability.drivers)
}

function DriverList({ heading, drivers }: { heading: string; drivers: string[] }): ReactElement {
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">{heading}</h3>
      {drivers.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing detected in this window.</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {drivers.map((driver) => (
            <li key={driver}>{driver}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function ExplanationPanel({
  userId,
  windowFrom,
}: {
  userId: string
  windowFrom: string
}): ReactElement {
  const explanation = useQuery({
    ...reliabilityQueryOptions(userId, windowFrom),
    select: selectDrivers,
  })

  return (
    <Card title="Why this score?">
      <DataState
        status={toDataStateStatus(explanation)}
        errorMessage={queryErrorMessage(explanation)}
        onRetry={() => void explanation.refetch()}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <DriverList heading="What strengthens it" drivers={explanation.data?.strengths ?? []} />
          <DriverList heading="What weakens it" drivers={explanation.data?.risks ?? []} />
          <DriverList heading="Observations" drivers={explanation.data?.neutral ?? []} />
        </div>
        <section className="mt-4 border-t border-ink/10 pt-3">
          <h3 className="mb-1 text-sm font-semibold">How the score works</h3>
          <ul className="space-y-1 text-sm text-ink-muted">
            {SIGNALS.map((signal) => (
              <li key={signal.id}>
                <span className="font-medium text-ink">{signal.label}</span> — {signal.explanation}
              </li>
            ))}
          </ul>
        </section>
      </DataState>
    </Card>
  )
}
