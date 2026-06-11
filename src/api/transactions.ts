import { logEvent } from '@/utils/log'

import { apiFetch } from './client'
import type { OffsetPage, Transaction, TransactionRecord } from './types'

/**
 * 200 keeps the largest observed dataset (631, user_1001) at 4 sequential
 * pages while bounding payloads if datasets grow (docs/api/findings.md §4).
 */
export const PAGE_LIMIT = 200

export interface FetchAllTransactionsOptions {
  from: string
  to: string
  signal: AbortSignal
}

/**
 * Loads a user's complete transaction set for the window through the offset
 * pagination loop (ADR-04). Every request carries explicit page+limit — the
 * API silently returns ALL rows when pagination params are absent, and
 * silently ignores a bare `limit` (findings §4). Pages are fetched
 * sequentially: the upstream banking API rate-limits bursts.
 */
export async function fetchAllTransactions(
  userId: string,
  options: FetchAllTransactionsOptions,
): Promise<TransactionRecord> {
  const record: Record<string, Transaction> = {}
  const startedAt = Date.now()
  let page = 1
  for (;;) {
    const body = await apiFetch<OffsetPage>(`/api/users/${userId}/transactions`, {
      signal: options.signal,
      query: {
        from: options.from,
        to: options.to,
        page: String(page),
        limit: String(PAGE_LIMIT),
      },
    })
    for (const transaction of body.transactions) {
      record[transaction.id] = transaction
    }
    if (!body.has_more) break
    page += 1
  }
  logEvent('transactions.fill', {
    userId,
    pages: page,
    total: Object.keys(record).length,
    durationMs: Date.now() - startedAt,
  })
  return record
}
