import {
  BACKOFF_BASE_MS,
  BACKOFF_CAP_MS,
  backoffDelayMs,
  CYCLE_RECONNECT_DELAY_MS,
  MIN_PRODUCTIVE_CYCLE_MS,
  openTransactionStream,
  unwrapEnvelope,
} from '@/api/sse/transport'
import type { StreamStatus } from '@/api/sse/transport'
import type { TransactionEvent } from '@/api/types'

import {
  addedWire,
  deletedWire,
  envelopeResponse,
  makeTransaction,
  resetSequence,
  sseStreamResponse,
  updatedWire,
} from '../../test/factories'

interface Recorder {
  events: TransactionEvent[]
  statuses: StreamStatus[]
  recoveries: () => number
  onEvent: (event: TransactionEvent) => void
  onStatus: (status: StreamStatus) => void
  onRecoveryConnect: () => void
}

function record(): Recorder {
  const events: TransactionEvent[] = []
  const statuses: StreamStatus[] = []
  let recoveryCount = 0
  return {
    events,
    statuses,
    recoveries: () => recoveryCount,
    onEvent: (event) => events.push(event),
    onStatus: (status) => statuses.push(status),
    onRecoveryConnect: () => {
      recoveryCount += 1
    },
  }
}

describe('backoffDelayMs', () => {
  it('doubles from 1s and caps at 30s', () => {
    const noJitter = (): number => 0
    expect(backoffDelayMs(1, noJitter)).toBe(BACKOFF_BASE_MS)
    expect(backoffDelayMs(2, noJitter)).toBe(2_000)
    expect(backoffDelayMs(3, noJitter)).toBe(4_000)
    expect(backoffDelayMs(6, noJitter)).toBe(30_000)
    expect(backoffDelayMs(10, noJitter)).toBe(BACKOFF_CAP_MS)
  })

  it('adds bounded jitter', () => {
    const maxJitter = (): number => 0.999999
    const delay = backoffDelayMs(1, maxJitter)
    expect(delay).toBeGreaterThan(BACKOFF_BASE_MS)
    expect(delay).toBeLessThan(BACKOFF_BASE_MS * 1.2 + 1)
  })
})

describe('unwrapEnvelope', () => {
  it('extracts events from a valid envelope', () => {
    const transaction = makeTransaction()
    const body = JSON.stringify({
      statusCode: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: addedWire(1, transaction),
    })
    expect(unwrapEnvelope(body)).toEqual([{ type: 'TRANSACTION_ADDED', transaction }])
  })

  it('rejects a body that is not JSON', () => {
    expect(() => unwrapEnvelope(': connected')).toThrow(/neither SSE nor a JSON envelope/)
  })

  it('rejects an envelope with a non-200 inner status', () => {
    const body = JSON.stringify({ statusCode: 500, headers: {}, body: '' })
    expect(() => unwrapEnvelope(body)).toThrow(/malformed or carries a non-200/)
  })

  it('rejects JSON that is not envelope-shaped', () => {
    expect(() => unwrapEnvelope('{"transactions":[]}')).toThrow(/malformed/)
  })

  it('rejects an envelope whose inner body is not an SSE document', () => {
    const body = JSON.stringify({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(() => unwrapEnvelope(body)).toThrow(/not an SSE document/)
  })
})

describe('openTransactionStream', () => {
  beforeEach(() => {
    resetSequence()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('streaming path: dispatches events incrementally and reports live', async () => {
    const transaction = makeTransaction()
    const recorded = record()
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(sseStreamResponse([': connected\n\n', addedWire(1, transaction)]))
    const handle = openTransactionStream({ userId: 'user_1001', ...recorded, fetchFn })
    await vi.advanceTimersByTimeAsync(0)
    expect(recorded.statuses[0]).toBe('live')
    expect(recorded.events).toEqual([{ type: 'TRANSACTION_ADDED', transaction }])
    handle.close()
  })

  it('envelope path: reports delayed and dispatches the batch after completion', async () => {
    const a = makeTransaction()
    const b = makeTransaction()
    const recorded = record()
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        envelopeResponse(
          `: connected\n\n${addedWire(1, a)}${updatedWire(2, b)}${deletedWire(3, 'evt_txn_dup')}: stream ended\n\n`,
        ),
      )
    const handle = openTransactionStream({ userId: 'user_1001', ...recorded, fetchFn })
    await vi.advanceTimersByTimeAsync(0)
    expect(recorded.statuses[0]).toBe('delayed')
    expect(recorded.events).toEqual([
      { type: 'TRANSACTION_ADDED', transaction: a },
      { type: 'TRANSACTION_UPDATED', transaction: b },
      { type: 'TRANSACTION_DELETED', transaction_id: 'evt_txn_dup' },
    ])
    handle.close()
  })

  it('clean envelope completion cycles promptly without backoff or recovery', async () => {
    const recorded = record()
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(envelopeResponse(addedWire(1, makeTransaction()))))
    const handle = openTransactionStream({ userId: 'user_1001', ...recorded, fetchFn })
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(CYCLE_RECONNECT_DELAY_MS)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(recorded.recoveries()).toBe(0)
    expect(recorded.statuses).not.toContain('reconnecting')
    handle.close()
  })

  it('error then success: backoff, recovery signal, then delayed', async () => {
    const recorded = record()
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValue(envelopeResponse(addedWire(1, makeTransaction())))
    const handle = openTransactionStream({ userId: 'user_1001', ...recorded, fetchFn })
    await vi.advanceTimersByTimeAsync(0)
    expect(recorded.statuses).toEqual(['reconnecting'])
    expect(recorded.recoveries()).toBe(0)
    // jitter-bounded backoff: base + at most 20%
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 1.2 + 1)
    expect(recorded.recoveries()).toBe(1)
    expect(recorded.statuses).toEqual(['reconnecting', 'delayed'])
    handle.close()
  })

  it('non-2xx and malformed envelopes take the recovery route', async () => {
    const recorded = record()
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('<html>not sse</html>'))
      .mockResolvedValue(envelopeResponse(addedWire(1, makeTransaction())))
    const handle = openTransactionStream({ userId: 'user_1001', ...recorded, fetchFn })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 1.2 + 1)
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 2 * 1.2 + 1)
    expect(recorded.statuses).toEqual(['reconnecting', 'reconnecting', 'delayed'])
    expect(recorded.recoveries()).toBe(1)
    handle.close()
  })

  it('drops malformed event payloads without killing the stream', async () => {
    const good = makeTransaction()
    const recorded = record()
    const wire =
      'event: TRANSACTION_ADDED\ndata: not json\n\n' +
      'event: TRANSACTION_ADDED\ndata: {"type":"TRANSACTION_UPDATED","transaction":{"id":"x"}}\n\n' +
      'event: SOMETHING_ELSE\ndata: {}\n\n' +
      addedWire(1, good)
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(envelopeResponse(wire))
    const handle = openTransactionStream({ userId: 'user_1001', ...recorded, fetchFn })
    await vi.advanceTimersByTimeAsync(0)
    expect(recorded.events).toEqual([{ type: 'TRANSACTION_ADDED', transaction: good }])
    handle.close()
  })

  it('an implausibly fast empty clean cycle routes through backoff, not the fast cycle', async () => {
    const recorded = record()
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(envelopeResponse(': connected\n\n: stream ended\n\n')),
      )
    const handle = openTransactionStream({ userId: 'user_1001', ...recorded, fetchFn })
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(recorded.statuses).toEqual(['delayed', 'reconnecting'])
    // the fast cycle slot passes without a poll...
    await vi.advanceTimersByTimeAsync(CYCLE_RECONNECT_DELAY_MS)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    // ...the retry arrives on the backoff schedule instead
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 1.2 + 1)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    handle.close()
  })

  it('a slow empty clean cycle still takes the fast cycle reconnect', async () => {
    const recorded = record()
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          setTimeout(() => {
            resolve(envelopeResponse(': stream ended\n\n'))
          }, MIN_PRODUCTIVE_CYCLE_MS)
        }),
    )
    const handle = openTransactionStream({ userId: 'user_1001', ...recorded, fetchFn })
    await vi.advanceTimersByTimeAsync(MIN_PRODUCTIVE_CYCLE_MS)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(CYCLE_RECONNECT_DELAY_MS)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(recorded.recoveries()).toBe(0)
    expect(recorded.statuses).not.toContain('reconnecting')
    handle.close()
  })

  it('a streaming response without a body takes the recovery route', async () => {
    const recorded = record()
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { headers: { 'content-type': 'text/event-stream' } }))
    const handle = openTransactionStream({ userId: 'user_1001', ...recorded, fetchFn })
    await vi.advanceTimersByTimeAsync(0)
    expect(recorded.statuses).toContain('reconnecting')
    handle.close()
  })

  it('close() aborts the request, reports offline, and stops the cycle', async () => {
    const recorded = record()
    const signals: AbortSignal[] = []
    const fetchFn = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      if (init?.signal instanceof AbortSignal) signals.push(init.signal)
      return Promise.resolve(envelopeResponse(addedWire(1, makeTransaction())))
    })
    const handle = openTransactionStream({ userId: 'user_1001', ...recorded, fetchFn })
    await vi.advanceTimersByTimeAsync(0)
    handle.close()
    expect(signals[0]?.aborted).toBe(true)
    expect(recorded.statuses.at(-1)).toBe('offline')
    await vi.advanceTimersByTimeAsync(CYCLE_RECONNECT_DELAY_MS * 10)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
