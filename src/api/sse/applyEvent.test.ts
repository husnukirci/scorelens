import { applyEvent } from '@/api/sse/applyEvent'
import type { Transaction, TransactionEvent, TransactionRecord } from '@/api/types'

import { makeTransaction, resetSequence } from '../../test/factories'

function added(transaction: Transaction): TransactionEvent {
  return { type: 'TRANSACTION_ADDED', transaction }
}
function updated(transaction: Transaction): TransactionEvent {
  return { type: 'TRANSACTION_UPDATED', transaction }
}
function deleted(transactionId: string): TransactionEvent {
  return { type: 'TRANSACTION_DELETED', transaction_id: transactionId }
}

describe('applyEvent', () => {
  beforeEach(() => {
    resetSequence()
  })

  describe('ADDED', () => {
    it('inserts a new transaction', () => {
      const transaction = makeTransaction()
      const next = applyEvent({}, added(transaction))
      expect(next[transaction.id]).toEqual(transaction)
    })

    it('does not mutate the input record', () => {
      const record: TransactionRecord = {}
      applyEvent(record, added(makeTransaction()))
      expect(record).toEqual({})
    })

    it('replaces an existing transaction when the payload differs (upsert)', () => {
      const original = makeTransaction({ id: 'txn_x', amount: -10 })
      const replacement = makeTransaction({ id: 'txn_x', amount: -99 })
      const next = applyEvent({ txn_x: original }, added(replacement))
      expect(next['txn_x']?.amount).toBe(-99)
    })

    it('replayed duplicate with identical payload returns the same reference (zero renders)', () => {
      const transaction = makeTransaction()
      const record = applyEvent({}, added(transaction))
      const replayed = applyEvent(record, added({ ...transaction }))
      expect(replayed).toBe(record)
    })

    it('treats a replay differing only in synced_at as a no-op', () => {
      // the server stamps synced_at per fetch (findings §8) — it carries no
      // client meaning, and the live stream re-stamps it every ~30s cycle
      const transaction = makeTransaction({ synced_at: '2026-06-11T12:00:00.000Z' })
      const record = applyEvent({}, added(transaction))
      const restamped = applyEvent(
        record,
        added({ ...transaction, synced_at: '2026-06-11T12:00:30.000Z' }),
      )
      expect(restamped).toBe(record)
    })
  })

  describe('UPDATED', () => {
    it('replaces the existing transaction', () => {
      const original = makeTransaction({ id: 'txn_x', description: 'REWE MARKT EINKAUF' })
      const corrected = makeTransaction({
        id: 'txn_x',
        description: 'REWE MARKT EINKAUF (KORREKTUR)',
        amount: -52.3,
      })
      const next = applyEvent({ txn_x: original }, updated(corrected))
      expect(next['txn_x']).toEqual(corrected)
    })

    it('treats an unknown id as ADDED — the payload is complete (ADR-05)', () => {
      const transaction = makeTransaction()
      const next = applyEvent({}, updated(transaction))
      expect(next[transaction.id]).toEqual(transaction)
    })

    it('identical replay returns the same reference', () => {
      const transaction = makeTransaction()
      const record = applyEvent({}, updated(transaction))
      expect(applyEvent(record, updated({ ...transaction }))).toBe(record)
    })

    it('preserves identity of untouched entries when another entry changes', () => {
      const stable = makeTransaction({ id: 'txn_stable' })
      const moving = makeTransaction({ id: 'txn_moving', amount: -1 })
      const record = applyEvent(applyEvent({}, added(stable)), added(moving))
      const next = applyEvent(record, updated(makeTransaction({ id: 'txn_moving', amount: -2 })))
      expect(next['txn_stable']).toBe(record['txn_stable'])
    })
  })

  describe('DELETED', () => {
    it('removes the transaction', () => {
      const transaction = makeTransaction()
      const record = applyEvent({}, added(transaction))
      const next = applyEvent(record, deleted(transaction.id))
      expect(next[transaction.id]).toBeUndefined()
      expect(Object.keys(next)).toHaveLength(0)
    })

    it('returns the same reference when deleting an unknown transaction id', () => {
      const record = applyEvent({}, added(makeTransaction()))
      // the live stream's script does exactly this (findings §6, event id 4)
      expect(applyEvent(record, deleted('evt_txn_dup_user_1001'))).toBe(record)
    })

    it('double delete: the second is a no-op returning the same reference', () => {
      const transaction = makeTransaction()
      const record = applyEvent({}, added(transaction))
      const afterFirst = applyEvent(record, deleted(transaction.id))
      expect(applyEvent(afterFirst, deleted(transaction.id))).toBe(afterFirst)
    })

    it('does not mutate the input record', () => {
      const transaction = makeTransaction()
      const record = applyEvent({}, added(transaction))
      applyEvent(record, deleted(transaction.id))
      expect(record[transaction.id]).toEqual(transaction)
    })
  })

  describe('out-of-order and replayed sequences', () => {
    it('delete-then-update resurrects the transaction (update of unknown id = add)', () => {
      const transaction = makeTransaction({ id: 'txn_x' })
      const record = applyEvent(applyEvent({}, added(transaction)), deleted('txn_x'))
      const next = applyEvent(record, updated(transaction))
      expect(next['txn_x']).toEqual(transaction)
    })

    it('a replayed full sequence converges to the same state (idempotent by construction)', () => {
      const a = makeTransaction({ id: 'txn_a' })
      const b = makeTransaction({ id: 'txn_b' })
      const sequence: TransactionEvent[] = [
        added(a),
        updated({ ...a, amount: -52.3 }),
        added(b),
        deleted('evt_txn_unknown'),
        updated({ ...b, description: 'GEHALT' }),
      ]
      const once = sequence.reduce(applyEvent, {})
      const twice = [...sequence, ...sequence].reduce(applyEvent, {})
      expect(twice).toEqual(once)
    })

    it('replaying an already-applied sequence causes zero new references', () => {
      const a = makeTransaction({ id: 'txn_a' })
      const sequence: TransactionEvent[] = [added(a), deleted('txn_never_existed')]
      const once = sequence.reduce(applyEvent, {})
      expect(sequence.reduce(applyEvent, once)).toBe(once)
    })
  })
})
