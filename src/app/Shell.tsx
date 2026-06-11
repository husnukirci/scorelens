import { useEffect } from 'react'
import type { ReactElement } from 'react'

import { useTransactionStream } from '@/api/sse/useTransactionStream'
import { Card } from '@/components/Card'
import { DataState } from '@/components/DataState'
import { CashflowPanel } from '@/features/cashflow/CashflowPanel'
import { ExplanationPanel } from '@/features/explanation/ExplanationPanel'
import { EventFeedPanel } from '@/features/live/EventFeedPanel'
import { OverviewPanel } from '@/features/overview/OverviewPanel'
import { BreakdownPanel } from '@/features/score-breakdown/BreakdownPanel'
import { TransactionsPanel } from '@/features/transactions/TransactionsPanel'
import { useUiStore } from '@/state/uiStore'
import { todayIso } from '@/utils/dates'

import { Header } from './Header'

export function Shell(): ReactElement {
  const selectedUserId = useUiStore((state) => state.selectedUserId)
  const windowFrom = useUiStore((state) => state.windowFrom)
  const setWindowFrom = useUiStore((state) => state.setWindowFrom)

  useEffect(() => {
    if (windowFrom === null) setWindowFrom(todayIso())
  }, [windowFrom, setWindowFrom])

  useTransactionStream(selectedUserId, windowFrom)

  return (
    <div className="min-h-screen bg-surface text-ink">
      <Header />
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        {selectedUserId !== null && windowFrom !== null ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <OverviewPanel userId={selectedUserId} windowFrom={windowFrom} />
              <BreakdownPanel userId={selectedUserId} windowFrom={windowFrom} />
            </div>
            <ExplanationPanel userId={selectedUserId} windowFrom={windowFrom} />
            <CashflowPanel userId={selectedUserId} windowFrom={windowFrom} />
            <TransactionsPanel userId={selectedUserId} windowFrom={windowFrom} />
            <EventFeedPanel />
          </>
        ) : (
          <Card>
            <DataState status="empty" emptyMessage="Select a user to begin.">
              {null}
            </DataState>
          </Card>
        )}
      </main>
    </div>
  )
}
