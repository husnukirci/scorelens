import type { Transaction } from '@/api/types'

/**
 * Test-data factories (CLAUDE.md §7: never inline object literals for test
 * data). All factories draw ids from one sequence so test data never collides
 * within a test file.
 */

let sequence = 0

export function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}_${String(sequence).padStart(5, '0')}`
}

export function resetSequence(): void {
  sequence = 0
}

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: nextId('txn'),
    account_id: 'acc_1001_chk',
    user_id: 'user_1001',
    amount: -47.8,
    currency: 'EUR',
    date: '2026-06-11',
    description: 'REWE MARKT EINKAUF',
    merchant_category_code: '5411',
    merchant_name: 'REWE Markt',
    type: 'debit',
    synced_at: '2026-06-11T09:33:11.466Z',
    ...overrides,
  }
}

/** SSE wire-format builders for stream transport tests. */
export function addedWire(id: number, transaction: Transaction): string {
  return `id: ${id}\nevent: TRANSACTION_ADDED\ndata: ${JSON.stringify({
    type: 'TRANSACTION_ADDED',
    transaction,
  })}\n\n`
}

export function updatedWire(id: number, transaction: Transaction): string {
  return `id: ${id}\nevent: TRANSACTION_UPDATED\ndata: ${JSON.stringify({
    type: 'TRANSACTION_UPDATED',
    transaction,
  })}\n\n`
}

export function deletedWire(id: number, transactionId: string): string {
  return `id: ${id}\nevent: TRANSACTION_DELETED\ndata: ${JSON.stringify({
    type: 'TRANSACTION_DELETED',
    transaction_id: transactionId,
  })}\n\n`
}

/** A streaming-path Response: real text/event-stream chunks. */
export function sseStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } })
}

/** An envelope-path Response: the buffered Lambda proxy JSON observed live. */
export function envelopeResponse(sseBody: string): Response {
  return new Response(
    JSON.stringify({
      statusCode: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: sseBody,
    }),
    { headers: { 'content-type': 'application/octet-stream' } },
  )
}
