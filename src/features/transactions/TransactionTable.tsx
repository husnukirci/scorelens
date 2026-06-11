import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import type { ReactElement } from 'react'

import type { Transaction } from '@/api/types'
import { useUiStore } from '@/state/uiStore'
import type { SortColumn } from '@/state/uiStore'
import { cn } from '@/utils/cn'

import { TransactionRow } from './TransactionRow'

const ROW_HEIGHT_PX = 40
const GRID_COLUMNS = 'grid grid-cols-[7rem_minmax(12rem,1fr)_11rem_8rem]'

const SORTABLE_COLUMNS: ReadonlyArray<{ column: SortColumn; label: string; align?: string }> = [
  { column: 'date', label: 'Date' },
  { column: 'merchant', label: 'Merchant' },
]

/**
 * Virtualized grid (ADR-09): constant DOM cost at any dataset size, with grid
 * semantics preserved for screen readers (grid/row/columnheader/gridcell,
 * aria-rowcount/rowindex, aria-sort) and keyboard-sortable headers.
 */
export function TransactionTable({ transactions }: { transactions: Transaction[] }): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sort = useUiStore((state) => state.sort)
  const toggleSort = useUiStore((state) => state.toggleSort)
  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 10,
  })

  const headerCell = (column: SortColumn, label: string, alignRight = false): ReactElement => (
    <div
      key={column}
      role="columnheader"
      aria-sort={
        sort.column === column ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className={cn('px-1 py-1', alignRight && 'text-right')}
    >
      <button
        type="button"
        onClick={() => toggleSort(column)}
        className="rounded px-2 py-1 text-xs font-semibold tracking-wide text-ink-muted uppercase hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none"
      >
        {label}
        <span aria-hidden="true" className="ml-1">
          {sort.column === column ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
        </span>
      </button>
    </div>
  )

  return (
    <div role="grid" aria-label="Transactions" aria-rowcount={transactions.length + 1}>
      <div role="row" aria-rowindex={1} className={cn(GRID_COLUMNS, 'border-b border-ink/10')}>
        {SORTABLE_COLUMNS.map(({ column, label }) => headerCell(column, label))}
        <div
          role="columnheader"
          aria-sort="none"
          className="px-3 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase"
        >
          Category
        </div>
        {headerCell('amount', 'Amount', true)}
      </div>
      <div ref={scrollRef} className="max-h-[28rem] overflow-auto" data-testid="transaction-scroll">
        <div
          // virtualizer geometry is runtime-computed — the one place static
          // classes cannot express layout (total height + per-row offset)
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const transaction = transactions[item.index]
            if (transaction === undefined) return null
            return (
              <div
                key={transaction.id}
                role="row"
                aria-rowindex={item.index + 2}
                className={cn(
                  GRID_COLUMNS,
                  'absolute top-0 left-0 w-full border-b border-ink/5 text-sm',
                )}
                style={{ height: item.size, transform: `translateY(${item.start}px)` }}
              >
                <TransactionRow transaction={transaction} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
