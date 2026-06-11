import type { ReactElement, ReactNode } from 'react'

import { Skeleton } from '@/components/Skeleton'
import type { DataStateStatus } from '@/utils/asyncStatus'

interface DataStateProps {
  status: DataStateStatus
  /** Plain-language description of what failed; never a raw stack. */
  errorMessage?: string
  onRetry?: () => void
  emptyMessage?: string
  /** Feature-shaped placeholder; defaults to three pulse lines. */
  skeleton?: ReactNode
  children: ReactNode
}

/**
 * The single rendering path for async data states (CLAUDE.md §3): every
 * feature maps its query to one of the four statuses and renders through
 * here. No bespoke spinners.
 */
export function DataState({
  status,
  errorMessage,
  onRetry,
  emptyMessage,
  skeleton,
  children,
}: DataStateProps): ReactElement {
  if (status === 'loading') {
    return (
      <div aria-busy="true" data-testid="data-state-loading">
        {skeleton ?? (
          <div className="space-y-2">
            <Skeleton />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p className="font-medium text-band-low">
          {errorMessage ?? 'Something went wrong while loading this data.'}
        </p>
        {onRetry !== undefined && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-ink/20 px-3 py-1 font-medium hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none"
          >
            Retry
          </button>
        )}
      </div>
    )
  }
  if (status === 'empty') {
    return <p className="text-sm text-ink-muted">{emptyMessage ?? 'Nothing to show yet.'}</p>
  }
  return <>{children}</>
}
