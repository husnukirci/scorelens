import type { TransactionRecord } from '@/api/types'
import { deriveVisibleTransactions } from '@/features/transactions/deriveVisibleTransactions'
import type { ExplorerView } from '@/features/transactions/deriveVisibleTransactions'

import { makeTransaction, resetSequence } from '../../test/factories'

const defaultView: ExplorerView = {
  categoryFilter: null,
  directionFilter: 'all',
  searchText: '',
  sort: { column: 'date', direction: 'desc' },
}

function recordOf(...transactions: ReturnType<typeof makeTransaction>[]): TransactionRecord {
  return Object.fromEntries(transactions.map((transaction) => [transaction.id, transaction]))
}

describe('deriveVisibleTransactions', () => {
  beforeEach(() => {
    resetSequence()
  })

  it('derives order from data, never from record insertion order', () => {
    const older = makeTransaction({ id: 'txn_b', date: '2026-01-05' })
    const newer = makeTransaction({ id: 'txn_a', date: '2026-03-01' })
    // wire/insertion order is oldest-first; date desc must invert it
    const result = deriveVisibleTransactions(recordOf(older, newer), defaultView)
    expect(result.map((transaction) => transaction.id)).toEqual(['txn_a', 'txn_b'])
  })

  it('breaks date ties by id ascending regardless of sort direction', () => {
    const sameDayB = makeTransaction({ id: 'txn_2', date: '2026-03-01' })
    const sameDayA = makeTransaction({ id: 'txn_1', date: '2026-03-01' })
    const record = recordOf(sameDayB, sameDayA)
    const desc = deriveVisibleTransactions(record, defaultView)
    const asc = deriveVisibleTransactions(record, {
      ...defaultView,
      sort: { column: 'date', direction: 'asc' },
    })
    expect(desc.map((transaction) => transaction.id)).toEqual(['txn_1', 'txn_2'])
    expect(asc.map((transaction) => transaction.id)).toEqual(['txn_1', 'txn_2'])
  })

  it('sorts by amount with sign-aware ordering', () => {
    const salary = makeTransaction({ id: 'txn_s', amount: 3200, type: 'credit' })
    const rent = makeTransaction({ id: 'txn_r', amount: -800 })
    const coffee = makeTransaction({ id: 'txn_c', amount: -3.5 })
    const result = deriveVisibleTransactions(recordOf(salary, rent, coffee), {
      ...defaultView,
      sort: { column: 'amount', direction: 'desc' },
    })
    expect(result.map((transaction) => transaction.id)).toEqual(['txn_s', 'txn_c', 'txn_r'])
  })

  it('sorts by merchant case-insensitively', () => {
    const aldi = makeTransaction({ id: 'txn_a', merchant_name: 'aldi' })
    const bvg = makeTransaction({ id: 'txn_b', merchant_name: 'BVG' })
    const result = deriveVisibleTransactions(recordOf(bvg, aldi), {
      ...defaultView,
      sort: { column: 'merchant', direction: 'asc' },
    })
    expect(result.map((transaction) => transaction.id)).toEqual(['txn_a', 'txn_b'])
  })

  it('filters by category code', () => {
    const groceries = makeTransaction({ merchant_category_code: '5411' })
    const rent = makeTransaction({ merchant_category_code: '6513' })
    const result = deriveVisibleTransactions(recordOf(groceries, rent), {
      ...defaultView,
      categoryFilter: '5411',
    })
    expect(result).toEqual([groceries])
  })

  it('filters by direction using the amount sign, not the redundant type field', () => {
    // findings §7: `type` is deliberately redundant; amount is truth
    const credit = makeTransaction({ amount: 3200, type: 'debit' })
    const debit = makeTransaction({ amount: -12, type: 'credit' })
    const record = recordOf(credit, debit)
    expect(
      deriveVisibleTransactions(record, { ...defaultView, directionFilter: 'credit' }),
    ).toEqual([credit])
    expect(deriveVisibleTransactions(record, { ...defaultView, directionFilter: 'debit' })).toEqual(
      [debit],
    )
  })

  it('searches merchant name and description case-insensitively', () => {
    const rewe = makeTransaction({ merchant_name: 'REWE Markt', description: 'REWE EINKAUF' })
    const byDescription = makeTransaction({
      merchant_name: 'Hausverwaltung',
      description: 'RENT PAYMENT',
    })
    const other = makeTransaction({ merchant_name: 'BVG', description: 'MONATSTICKET' })
    const record = recordOf(rewe, byDescription, other)
    expect(deriveVisibleTransactions(record, { ...defaultView, searchText: 'rewe' })).toEqual([
      rewe,
    ])
    expect(deriveVisibleTransactions(record, { ...defaultView, searchText: 'rent pay' })).toEqual([
      byDescription,
    ])
  })

  it('trims surrounding whitespace from the search text', () => {
    const rewe = makeTransaction({ merchant_name: 'REWE Markt' })
    const record = recordOf(
      rewe,
      makeTransaction({ merchant_name: 'BVG', description: 'MONATSTICKET' }),
    )
    expect(deriveVisibleTransactions(record, { ...defaultView, searchText: '  rewe ' })).toEqual([
      rewe,
    ])
  })

  it('composes filter, search, and sort', () => {
    const lidlOld = makeTransaction({
      id: 'txn_1',
      date: '2026-01-10',
      merchant_category_code: '5411',
      merchant_name: 'Lidl',
      amount: -20,
    })
    const lidlNew = makeTransaction({
      id: 'txn_2',
      date: '2026-04-02',
      merchant_category_code: '5411',
      merchant_name: 'Lidl',
      amount: -35,
    })
    const aldi = makeTransaction({
      id: 'txn_3',
      date: '2026-05-01',
      merchant_category_code: '5411',
      merchant_name: 'Aldi',
      amount: -15,
    })
    const cinema = makeTransaction({
      id: 'txn_4',
      merchant_category_code: '7832',
      merchant_name: 'Lidl Cinema',
    })
    const result = deriveVisibleTransactions(recordOf(lidlOld, lidlNew, aldi, cinema), {
      categoryFilter: '5411',
      directionFilter: 'debit',
      searchText: 'lidl',
      sort: { column: 'date', direction: 'desc' },
    })
    expect(result.map((transaction) => transaction.id)).toEqual(['txn_2', 'txn_1'])
  })

  it('returns an empty array when nothing matches', () => {
    const record = recordOf(makeTransaction({ merchant_name: 'BVG' }))
    expect(deriveVisibleTransactions(record, { ...defaultView, searchText: 'nomatch' })).toEqual([])
  })

  it('returns an empty array for an empty record', () => {
    expect(deriveVisibleTransactions({}, defaultView)).toEqual([])
  })
})
