import type { ReactElement } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { Card } from '@/components/Card'
import { useUiStore } from '@/state/uiStore'
import type { StreamFeedEntry } from '@/state/uiStore'

const TYPE_LABELS: Record<StreamFeedEntry['type'], string> = {
  TRANSACTION_ADDED: 'Added',
  TRANSACTION_UPDATED: 'Updated',
  TRANSACTION_DELETED: 'Removed',
}

function entryTime(at: string): string {
  return new Date(at).toLocaleTimeString('de-DE', { hour12: false })
}

/**
 * Session activity log: what the stream actually changed (no-op replays
 * never appear — idempotency made visible). Ephemeral by design.
 */
export function EventFeedPanel(): ReactElement {
  const events = useUiStore(useShallow((state) => state.streamEvents))

  return (
    <Card title="Live activity">
      {events.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No applied stream events yet this session. Replayed duplicates are absorbed silently —
          only real changes appear here.
        </p>
      ) : (
        <ul aria-live="polite" className="space-y-1 text-sm">
          {events.map((entry) => (
            <li key={`${entry.at}-${entry.transactionId}-${entry.type}`} className="flex gap-3">
              <span className="text-ink-muted tabular-nums">{entryTime(entry.at)}</span>
              <span className="w-16 font-medium">{TYPE_LABELS[entry.type]}</span>
              <span className="truncate">{entry.merchant ?? entry.transactionId}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
