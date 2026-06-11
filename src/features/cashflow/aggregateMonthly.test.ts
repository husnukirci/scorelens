import type { TransactionRecord } from '@/api/types'
import { aggregateMonthly } from '@/features/cashflow/aggregateMonthly'

import { makeTransaction, resetSequence } from '../../test/factories'

function recordOf(...transactions: ReturnType<typeof makeTransaction>[]): TransactionRecord {
  return Object.fromEntries(transactions.map((transaction) => [transaction.id, transaction]))
}

describe('aggregateMonthly', () => {
  beforeEach(() => {
    resetSequence()
  })

  it('groups income and expenses by calendar month with net per month', () => {
    const record = recordOf(
      makeTransaction({ date: '2026-01-28', amount: 3200 }),
      makeTransaction({ date: '2026-01-05', amount: -950 }),
      makeTransaction({ date: '2026-01-12', amount: -50.5 }),
      makeTransaction({ date: '2026-02-28', amount: 3200 }),
      makeTransaction({ date: '2026-02-14', amount: -200 }),
    )
    const months = aggregateMonthly(record, { from: '2026-01-01', to: '2026-02-28' })
    expect(months).toEqual([
      { month: '2026-01', income: 3200, expenses: 1000.5, net: 2199.5 },
      { month: '2026-02', income: 3200, expenses: 200, net: 3000 },
    ])
  })

  it('zero-fills months inside the window that have no transactions', () => {
    const record = recordOf(makeTransaction({ date: '2026-03-10', amount: -100 }))
    const months = aggregateMonthly(record, { from: '2026-01-15', to: '2026-04-02' })
    expect(months.map((entry) => entry.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04'])
    expect(months[0]).toEqual({ month: '2026-01', income: 0, expenses: 0, net: 0 })
    expect(months[2]?.expenses).toBe(100)
  })

  it('spans year boundaries in ascending order', () => {
    const record = recordOf(
      makeTransaction({ date: '2025-12-20', amount: -10 }),
      makeTransaction({ date: '2026-01-04', amount: 20 }),
    )
    const months = aggregateMonthly(record, { from: '2025-11-05', to: '2026-01-31' })
    expect(months.map((entry) => entry.month)).toEqual(['2025-11', '2025-12', '2026-01'])
  })

  it('ignores transactions outside the window', () => {
    const record = recordOf(
      makeTransaction({ date: '2025-10-01', amount: -999 }),
      makeTransaction({ date: '2026-01-10', amount: -10 }),
    )
    const months = aggregateMonthly(record, { from: '2026-01-01', to: '2026-01-31' })
    expect(months).toHaveLength(1)
    expect(months[0]?.expenses).toBe(10)
  })

  it('avoids floating point drift by working in cents', () => {
    const record = recordOf(
      makeTransaction({ date: '2026-01-01', amount: -0.1 }),
      makeTransaction({ date: '2026-01-02', amount: -0.2 }),
    )
    const months = aggregateMonthly(record, { from: '2026-01-01', to: '2026-01-31' })
    expect(months[0]?.expenses).toBe(0.3)
    expect(months[0]?.net).toBe(-0.3)
  })

  it('returns zero-filled months for an empty record', () => {
    const months = aggregateMonthly({}, { from: '2026-01-01', to: '2026-02-28' })
    expect(months).toEqual([
      { month: '2026-01', income: 0, expenses: 0, net: 0 },
      { month: '2026-02', income: 0, expenses: 0, net: 0 },
    ])
  })
})
