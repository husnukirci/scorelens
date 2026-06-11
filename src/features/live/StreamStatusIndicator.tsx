import type { ReactElement } from 'react'

import { useUiStore } from '@/state/uiStore'
import { cn } from '@/utils/cn'

/**
 * The `delayed` copy carries the measured cadence (docs/api/findings.md §6:
 * the deployed stream delivers one ~30s buffered batch per cycle) — analysts
 * see what "live" actually means, never a bare label (ADR-17 §4).
 */
const STATUS_PRESENTATION = {
  live: { label: 'Live', dotClass: 'bg-band-high' },
  delayed: { label: 'Live (delayed) — updates ~every 30s', dotClass: 'bg-band-medium' },
  reconnecting: { label: 'Reconnecting…', dotClass: 'bg-band-medium' },
  offline: { label: 'Offline', dotClass: 'bg-ink-muted' },
} as const

export function StreamStatusIndicator(): ReactElement {
  const status = useUiStore((state) => state.streamStatus)
  const presentation = STATUS_PRESENTATION[status]
  return (
    <p
      aria-live="polite"
      data-testid="stream-status"
      className="flex items-center gap-2 text-sm text-ink-muted"
    >
      <span aria-hidden="true" className={cn('size-2 rounded-full', presentation.dotClass)} />
      {presentation.label}
    </p>
  )
}
