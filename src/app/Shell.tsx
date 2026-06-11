import { useEffect } from 'react'
import type { ReactElement } from 'react'

import { useTransactionStream } from '@/api/sse/useTransactionStream'
import { Card } from '@/components/Card'
import { DataState } from '@/components/DataState'
import { useUiStore } from '@/state/uiStore'
import { todayIso } from '@/utils/dates'

import { Header } from './Header'
import { ShellPanels } from './ShellPanels'

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
          <ShellPanels userId={selectedUserId} windowFrom={windowFrom} />
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
