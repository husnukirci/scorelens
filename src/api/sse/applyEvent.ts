import type { Transaction, TransactionEvent, TransactionRecord } from '../types'

/**
 * Transactions are flat, so field-level equality is a cheap full comparison.
 * synced_at is excluded: the server re-stamps it per fetch and per stream
 * cycle (findings §8) — it carries no client meaning, and counting it would
 * defeat no-op detection for every replayed event.
 */
function sameTransaction(a: Transaction, b: Transaction): boolean {
  const keys = Object.keys(b) as Array<keyof Transaction>
  return (
    Object.keys(a).length === keys.length &&
    keys.every((key) => key === 'synced_at' || a[key] === b[key])
  )
}

/**
 * Pure reducer for stream events into the normalized record (ADR-05).
 * ADDED and UPDATED are both upserts — an UPDATED for an unknown id carries a
 * complete payload, so it is an add. DELETED of an unknown id is a no-op.
 * No-ops return the SAME reference, which is what makes replayed and
 * duplicated events cause zero renders downstream.
 */
export function applyEvent(record: TransactionRecord, event: TransactionEvent): TransactionRecord {
  switch (event.type) {
    case 'TRANSACTION_ADDED':
    case 'TRANSACTION_UPDATED': {
      const existing = record[event.transaction.id]
      if (existing !== undefined && sameTransaction(existing, event.transaction)) {
        return record
      }
      return { ...record, [event.transaction.id]: event.transaction }
    }
    case 'TRANSACTION_DELETED': {
      if (!(event.transaction_id in record)) {
        return record
      }
      const next: Record<string, Transaction> = { ...record }
      delete next[event.transaction_id]
      return next
    }
  }
}
