import type { TransactionRecord } from '@/api/types'

export interface MonthlyCashflow {
  /** Calendar month as YYYY-MM. */
  month: string
  income: number
  expenses: number
  net: number
}

export interface CashflowWindow {
  from: string
  to: string
}

function* monthsBetween(fromIso: string, toIso: string): Generator<string> {
  let [year, month] = [Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7))]
  const last = toIso.slice(0, 7)
  for (;;) {
    const label = `${String(year)}-${String(month).padStart(2, '0')}`
    yield label
    if (label === last) return
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
}

/**
 * Monthly income/expense/net over the normalized record, zero-filling every
 * month of the window so quiet months stay visible. Pure; the panel memoizes
 * it (hot path #2 — stable references keep the chart from re-animating).
 * Sums run in integer cents to avoid floating point drift.
 */
export function aggregateMonthly(
  record: TransactionRecord,
  window: CashflowWindow,
): MonthlyCashflow[] {
  const incomeCents = new Map<string, number>()
  const expenseCents = new Map<string, number>()
  for (const month of monthsBetween(window.from, window.to)) {
    incomeCents.set(month, 0)
    expenseCents.set(month, 0)
  }

  for (const transaction of Object.values(record)) {
    if (transaction.date < window.from || transaction.date > window.to) continue
    const month = transaction.date.slice(0, 7)
    const cents = Math.round(transaction.amount * 100)
    if (cents >= 0) {
      incomeCents.set(month, (incomeCents.get(month) ?? 0) + cents)
    } else {
      expenseCents.set(month, (expenseCents.get(month) ?? 0) - cents)
    }
  }

  return [...incomeCents.keys()].map((month) => {
    const income = (incomeCents.get(month) ?? 0) / 100
    const expenses = (expenseCents.get(month) ?? 0) / 100
    return { month, income, expenses, net: (income * 100 - expenses * 100) / 100 }
  })
}
