import type { Transaction, TransactionRecord } from '@/api/types'
import type { DirectionFilter, SortState } from '@/state/uiStore'

export interface ExplorerView {
  categoryFilter: string | null
  directionFilter: DirectionFilter
  searchText: string
  sort: SortState
}

/** Ties always resolve (date asc, id asc) so direction toggles never shuffle peers. */
function tieBreak(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function primaryCompare(a: Transaction, b: Transaction, column: SortState['column']): number {
  switch (column) {
    case 'date':
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    case 'amount':
      return a.amount - b.amount
    case 'merchant': {
      const left = a.merchant_name.toLowerCase()
      const right = b.merchant_name.toLowerCase()
      return left < right ? -1 : left > right ? 1 : 0
    }
  }
}

function matches(transaction: Transaction, view: ExplorerView, needle: string): boolean {
  if (view.categoryFilter !== null && transaction.merchant_category_code !== view.categoryFilter) {
    return false
  }
  // the amount sign is truth; the type field is deliberately redundant (findings §7)
  if (view.directionFilter === 'credit' && transaction.amount <= 0) return false
  if (view.directionFilter === 'debit' && transaction.amount >= 0) return false
  if (needle !== '') {
    const haystack = `${transaction.merchant_name} ${transaction.description}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }
  return true
}

/**
 * The explorer derive pipeline (filter → search → sort) over the normalized
 * record. Pure; the wrapping hook memoizes it (designated hot path #2).
 */
export function deriveVisibleTransactions(
  record: TransactionRecord,
  view: ExplorerView,
): Transaction[] {
  const needle = view.searchText.trim().toLowerCase()
  const direction = view.sort.direction === 'asc' ? 1 : -1
  return Object.values(record)
    .filter((transaction) => matches(transaction, view, needle))
    .sort((a, b) => {
      const primary = primaryCompare(a, b, view.sort.column)
      return primary !== 0 ? primary * direction : tieBreak(a, b)
    })
}
