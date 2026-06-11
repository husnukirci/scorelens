import { config } from '@/config'

import { ApiError } from '../types'
import type { Transaction, TransactionEvent } from '../types'
import { feedSseChunk, initialSseBuffer } from './parser'
import type { SseFrame } from './parser'

/**
 * Dual-path stream transport (ADR-17).
 *
 * Streaming path: the response presents text/event-stream → incremental
 * parse, events dispatched as bytes arrive, status `live`. This is the path
 * the deployment takes the moment the backend enables response streaming.
 *
 * Envelope path (degraded, what production does today — findings §6): the
 * Lambda URL buffers the whole ~30s script into a JSON proxy envelope with
 * the SSE document inside `body`. We buffer, validate, unwrap, and dispatch
 * the events as one batch, status `delayed`.
 *
 * Reconnect semantics: a CLEAN completion of either path is the normal
 * operating cycle (the server's script self-terminates) → prompt reconnect,
 * no backoff, no recovery signal. Only errors and abnormal termination take
 * the recovery route: exponential backoff with jitter, and
 * `onRecoveryConnect` on the next successful connection so the owner can
 * reconcile against REST.
 */

export type StreamStatus = 'live' | 'delayed' | 'reconnecting' | 'offline'

export const CYCLE_RECONNECT_DELAY_MS = 500
/**
 * A clean cycle earns the fast reconnect only if it delivered events or ran
 * at least this long. A faster-and-empty completion looks like a misbehaving
 * endpoint; polling it at 2 req/s forever is not acceptable — it routes
 * through backoff instead (ADR-17 cycle/recovery correctness).
 */
export const MIN_PRODUCTIVE_CYCLE_MS = 5_000
export const BACKOFF_BASE_MS = 1_000
export const BACKOFF_CAP_MS = 30_000
const BACKOFF_JITTER_RATIO = 0.2

export function backoffDelayMs(failedAttempts: number, random: () => number = Math.random): number {
  const exponential = Math.min(BACKOFF_BASE_MS * 2 ** (failedAttempts - 1), BACKOFF_CAP_MS)
  return exponential + Math.floor(exponential * BACKOFF_JITTER_RATIO * random())
}

export interface TransactionStreamOptions {
  userId: string
  onEvent: (event: TransactionEvent) => void
  onStatus: (status: StreamStatus) => void
  /** A connection opened after failures — the owner reconciles against REST. */
  onRecoveryConnect: () => void
  fetchFn?: typeof fetch
}

export interface TransactionStreamHandle {
  close: () => void
}

const EVENT_TYPES: ReadonlySet<string> = new Set([
  'TRANSACTION_ADDED',
  'TRANSACTION_UPDATED',
  'TRANSACTION_DELETED',
])

function isTransaction(value: unknown): value is Transaction {
  // Trust boundary: id presence is the only check; field-level validation is
  // deliberately delegated to the backend contract (README assumptions).
  // cast widens to optional-unknown properties only — every read stays checked
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string'
  )
}

/** Malformed frames are dropped, never thrown: one bad event must not kill the stream. */
export function toTransactionEvent(frame: SseFrame): TransactionEvent | null {
  if (frame.event === undefined || !EVENT_TYPES.has(frame.event)) return null
  let payload: unknown
  try {
    payload = JSON.parse(frame.data)
  } catch {
    return null
  }
  if (typeof payload !== 'object' || payload === null) return null
  // cast widens to optional-unknown properties only — every read stays checked
  const candidate = payload as { type?: unknown; transaction?: unknown; transaction_id?: unknown }
  if (candidate.type !== frame.event) return null
  if (frame.event === 'TRANSACTION_DELETED') {
    return typeof candidate.transaction_id === 'string'
      ? { type: 'TRANSACTION_DELETED', transaction_id: candidate.transaction_id }
      : null
  }
  if (!isTransaction(candidate.transaction)) return null
  return frame.event === 'TRANSACTION_ADDED'
    ? { type: 'TRANSACTION_ADDED', transaction: candidate.transaction }
    : { type: 'TRANSACTION_UPDATED', transaction: candidate.transaction }
}

interface LambdaEnvelope {
  statusCode: number
  headers: Record<string, string>
  body: string
}

function isLambdaEnvelope(value: unknown): value is LambdaEnvelope {
  if (typeof value !== 'object' || value === null) return false
  // cast widens to optional-unknown properties only — every read stays checked
  const candidate = value as { statusCode?: unknown; headers?: unknown; body?: unknown }
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.headers === 'object' &&
    candidate.headers !== null &&
    typeof candidate.body === 'string'
  )
}

export function unwrapEnvelope(text: string): TransactionEvent[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ApiError('parse', 'stream returned a body that is neither SSE nor a JSON envelope')
  }
  if (!isLambdaEnvelope(parsed) || parsed.statusCode !== 200) {
    throw new ApiError('parse', 'stream envelope is malformed or carries a non-200 status')
  }
  const innerContentType = parsed.headers['content-type'] ?? ''
  if (!innerContentType.includes('text/event-stream')) {
    throw new ApiError('parse', 'stream envelope body is not an SSE document')
  }
  // '\n\n' flushes a final frame the script may not have terminated
  const { frames } = feedSseChunk(initialSseBuffer, `${parsed.body}\n\n`)
  return frames.map(toTransactionEvent).filter((event): event is TransactionEvent => event !== null)
}

export function openTransactionStream(options: TransactionStreamOptions): TransactionStreamHandle {
  const fetchFn = options.fetchFn ?? fetch
  const url = `${config.sseBaseUrl}/api/users/${options.userId}/transaction-events`
  let closed = false
  let controller: AbortController | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let failedAttempts = 0

  function scheduleConnect(delayMs: number): void {
    if (closed) return
    reconnectTimer = setTimeout(() => {
      void connect()
    }, delayMs)
  }

  async function readStreaming(response: Response): Promise<number> {
    if (response.body === null) {
      throw new ApiError('parse', 'streaming response carried no body')
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = initialSseBuffer
    let delivered = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return delivered
      const result = feedSseChunk(buffer, decoder.decode(value, { stream: true }))
      buffer = result.buffer
      for (const frame of result.frames) {
        const event = toTransactionEvent(frame)
        if (event !== null && !closed) {
          options.onEvent(event)
          delivered += 1
        }
      }
    }
  }

  async function connect(): Promise<void> {
    if (closed) return
    controller = new AbortController()
    const recovering = failedAttempts > 0
    const startedAt = Date.now()
    let delivered = 0
    try {
      const response = await fetchFn(url, {
        signal: controller.signal,
        headers: { Accept: 'text/event-stream' },
      })
      if (!response.ok) {
        throw new ApiError('http', `stream responded ${response.status}`, response.status)
      }
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('text/event-stream')) {
        failedAttempts = 0
        if (recovering) options.onRecoveryConnect()
        if (!closed) options.onStatus('live')
        delivered = await readStreaming(response)
      } else {
        const events = unwrapEnvelope(await response.text())
        failedAttempts = 0
        if (recovering) options.onRecoveryConnect()
        if (!closed) options.onStatus('delayed')
        for (const event of events) {
          if (!closed) options.onEvent(event)
        }
        delivered = events.length
      }
      if (closed) return
      if (delivered > 0 || Date.now() - startedAt >= MIN_PRODUCTIVE_CYCLE_MS) {
        // clean productive cycle: the normal loop — prompt reconnect, no backoff
        scheduleConnect(CYCLE_RECONNECT_DELAY_MS)
      } else {
        // clean but implausibly fast and empty: treat as misbehavior (see MIN_PRODUCTIVE_CYCLE_MS)
        failedAttempts += 1
        options.onStatus('reconnecting')
        scheduleConnect(backoffDelayMs(failedAttempts))
      }
    } catch (error) {
      if (closed || (error instanceof Error && error.name === 'AbortError')) return
      failedAttempts += 1
      options.onStatus('reconnecting')
      scheduleConnect(backoffDelayMs(failedAttempts))
    }
  }

  void connect()

  return {
    close: () => {
      closed = true
      if (reconnectTimer !== null) clearTimeout(reconnectTimer)
      controller?.abort()
      options.onStatus('offline')
    },
  }
}
