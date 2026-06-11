import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useUiStore } from '@/state/uiStore'

import { reliabilityQueryKey, transactionsQueryKey } from '../queries'
import type { TransactionRecord } from '../types'
import { applyEvent } from './applyEvent'
import { openTransactionStream } from './transport'
import type { StreamStatus } from './transport'

/** Score must follow its underlying data, but not on every event of a burst. */
export const RELIABILITY_INVALIDATE_DEBOUNCE_MS = 2_000
/** Degraded-mode drift net (ADR-17): reconcile at most this often across cycles. */
export const SAFETY_RECONCILE_MS = 5 * 60 * 1_000

/**
 * Owns one stream connection per selected user+window (ADR-06/17): opened on
 * mount and identity change, closed on cleanup. Events land exclusively via
 * `queryClient.setQueryData` on the transactions key — Query stays the single
 * home of server truth. Recovery reconnects reconcile against REST; clean
 * cycles do not (the stream carried the events).
 */
export function useTransactionStream(userId: string | null, windowFrom: string | null): void {
  const queryClient = useQueryClient()
  const setStreamStatus = useUiStore((state) => state.setStreamStatus)

  useEffect(() => {
    if (userId === null || windowFrom === null) return
    const transactionsKey = transactionsQueryKey(userId, windowFrom)
    const reliabilityKey = reliabilityQueryKey(userId, windowFrom)
    let reliabilityTimer: ReturnType<typeof setTimeout> | null = null
    let lastStatus: StreamStatus = 'offline'

    const scheduleReliabilityInvalidation = (): void => {
      if (reliabilityTimer !== null) clearTimeout(reliabilityTimer)
      reliabilityTimer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: reliabilityKey })
      }, RELIABILITY_INVALIDATE_DEBOUNCE_MS)
    }

    const handle = openTransactionStream({
      userId,
      onEvent: (event) => {
        const current = queryClient.getQueryData<TransactionRecord>(transactionsKey)
        // before the initial fill lands there is nothing to patch; the fill is truth
        if (current === undefined) return
        const next = applyEvent(current, event)
        // no-op events produce zero cache writes and therefore zero renders
        if (next === current) return
        queryClient.setQueryData(transactionsKey, next)
        scheduleReliabilityInvalidation()
      },
      onStatus: (status) => {
        lastStatus = status
        setStreamStatus(status)
      },
      onRecoveryConnect: () => {
        void queryClient.invalidateQueries({ queryKey: transactionsKey })
      },
    })

    const safetyTimer = setInterval(() => {
      if (lastStatus === 'delayed') {
        void queryClient.invalidateQueries({ queryKey: transactionsKey })
      }
    }, SAFETY_RECONCILE_MS)

    return () => {
      clearInterval(safetyTimer)
      if (reliabilityTimer !== null) clearTimeout(reliabilityTimer)
      handle.close()
    }
  }, [userId, windowFrom, queryClient, setStreamStatus])
}
