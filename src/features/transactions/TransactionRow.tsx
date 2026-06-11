import { memo } from 'react'
import type { ReactElement } from 'react'

import type { Transaction } from '@/api/types'
import { categoryLabel } from '@/domain/categories'
import { formatMoney } from '@/utils/formatMoney'
import { logEvent } from '@/utils/log'

/**
 * Designated hot path #1 (ADR-13): memoized and fed stable references from
 * the normalized record, so a single-row SSE update re-renders exactly one
 * row. The dev-gated render log is the evidence trail for that claim.
 */
export const TransactionRow = memo(function TransactionRow({
  transaction,
}: {
  transaction: Transaction
}): ReactElement {
  // intentional render-phase counter (dev-gated, StrictMode-doubled): the
  // evidence instrument behind the single-row re-render claim
  if (import.meta.env.DEV) {
    logEvent('profiler.row-render', { id: transaction.id })
  }
  const credit = transaction.amount > 0
  return (
    <>
      <div role="gridcell" className="px-3 py-2 whitespace-nowrap tabular-nums">
        {transaction.date}
      </div>
      <div role="gridcell" className="truncate px-3 py-2" title={transaction.description}>
        <span className="font-medium">{transaction.merchant_name}</span>
        <span className="ml-2 hidden text-ink-muted sm:inline">{transaction.description}</span>
      </div>
      <div role="gridcell" className="truncate px-3 py-2 text-ink-muted">
        {categoryLabel(transaction.merchant_category_code)}
      </div>
      <div
        role="gridcell"
        className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${
          credit ? 'text-flow-positive' : 'text-flow-negative'
        }`}
      >
        {formatMoney(transaction.amount, transaction.currency)}
      </div>
    </>
  )
})
