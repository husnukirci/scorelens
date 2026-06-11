import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { useUiStore } from '@/state/uiStore'
import type { StreamFeedEntry } from '@/state/uiStore'
import { logEvent } from '@/utils/log'

import { reliabilityQueryKey, transactionsQueryKey } from '../queries'
import type { TransactionEvent, TransactionRecord } from '../types'
import { applyEvent } from './applyEvent'
import { openTransactionStream } from './transport'
import type { StreamStatus } from './transport'

/** Score must follow its underlying data, but not on every event of a burst. */
export const RELIABILITY_INVALIDATE_DEBOUNCE_MS = 2_000
/** Degraded-mode drift net (ADR-17): reconcile at most this often across cycles. */
export const SAFETY_RECONCILE_MS = 5 * 60 * 1_000

function toFeedEntry(event: TransactionEvent): StreamFeedEntry {
  return event.type === 'TRANSACTION_DELETED'
    ? { at: new Date().toISOString(), type: event.type, transactionId: event.transaction_id }
    : {
        at: new Date().toISOString(),
        type: event.type,
        transactionId: event.transaction.id,
        merchant: event.transaction.merchant_name,
      }
}

/**
 * Owns one stream connection per selected user+window (ADR-06/17): opened on
 * mount and identity change, closed on cleanup and while the tab is hidden.
 * Events land exclusively via `queryClient.setQueryData` on the transactions
 * key — Query stays the single home of server truth. Recovery reconnects and
 * tab-visibility resumes reconcile against REST; clean cycles do not (the
 * stream carried the events).
 */
export function useTransactionStream(userId: string | null, windowFrom: string | null): void {
  const queryClient = useQueryClient()
  const setStreamStatus = useUiStore((state) => state.setStreamStatus)
  const pushStreamEvent = useUiStore((state) => state.pushStreamEvent)
  const [visible, setVisible] = useState(() => !document.hidden)
  // set during cleanup: was the teardown caused by the tab hiding?
  const hiddenTeardownRef = useRef(false)

  useEffect(() => {
    const onVisibilityChange = (): void => {
      setVisible(!document.hidden)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (userId === null || windowFrom === null) return
    if (!visible) {
      // hidden tab: no connection, honest status (ADR-06 Tier 2)
      setStreamStatus('offline')
      return
    }
    const transactionsKey = transactionsQueryKey(userId, windowFrom)
    const reliabilityKey = reliabilityQueryKey(userId, windowFrom)
    let reliabilityTimer: ReturnType<typeof setTimeout> | null = null
    let lastStatus: StreamStatus = 'offline'

    if (hiddenTeardownRef.current) {
      // resume after a hidden stretch: reconcile — we may have missed events
      hiddenTeardownRef.current = false
      logEvent('stream.reconciled', { userId, reason: 'visibility-resume' })
      void queryClient.invalidateQueries({ queryKey: transactionsKey })
    }

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
        // no-op events produce zero cache writes, zero renders, no feed entry
        if (next === current) return
        queryClient.setQueryData(transactionsKey, next)
        pushStreamEvent(toFeedEntry(event))
        scheduleReliabilityInvalidation()
      },
      onStatus: (status) => {
        lastStatus = status
        setStreamStatus(status)
      },
      onRecoveryConnect: () => {
        logEvent('stream.reconciled', { userId, reason: 'recovery' })
        void queryClient.invalidateQueries({ queryKey: transactionsKey })
      },
    })

    const safetyTimer = setInterval(() => {
      if (lastStatus === 'delayed') {
        logEvent('stream.reconciled', { userId, reason: 'safety-interval' })
        void queryClient.invalidateQueries({ queryKey: transactionsKey })
      }
    }, SAFETY_RECONCILE_MS)

    return () => {
      clearInterval(safetyTimer)
      if (reliabilityTimer !== null) clearTimeout(reliabilityTimer)
      hiddenTeardownRef.current = document.hidden
      handle.close()
    }
  }, [userId, windowFrom, visible, queryClient, setStreamStatus, pushStreamEvent])
}
