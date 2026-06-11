import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import type { Transaction, TransactionRecord } from '@/api/types'
import { useUiStore } from '@/state/uiStore'

import { deriveVisibleTransactions } from './deriveVisibleTransactions'

/**
 * Designated hot path #2: the memoized derive. The useShallow slice keeps the
 * view object referentially stable across unrelated store updates (e.g.
 * stream status), so SSE no-ops cause zero re-derives.
 */
export function useVisibleTransactions(record: TransactionRecord | undefined): Transaction[] {
  const view = useUiStore(
    useShallow((state) => ({
      categoryFilter: state.categoryFilter,
      directionFilter: state.directionFilter,
      searchText: state.searchText,
      sort: state.sort,
    })),
  )
  return useMemo(() => deriveVisibleTransactions(record ?? {}, view), [record, view])
}
