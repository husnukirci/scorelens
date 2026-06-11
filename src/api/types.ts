import type { components } from './types.gen'

/**
 * Domain refinements over the generated spec types (ADR-07).
 * The spec declares no `required` lists, so every generated property is
 * optional; live verification observed all fields present on every record
 * (docs/api/findings.md §4), so the domain types are the Required<> closure.
 * `types.gen.ts` itself is never edited — regenerate with `make types`.
 */

export type Transaction = Required<components['schemas']['Transaction']> & {
  type: 'debit' | 'credit'
}

export type ScoringMetrics = Required<components['schemas']['ScoringMetrics']>

export type ReliabilityResponse = Required<
  Omit<components['schemas']['ReliabilityResponse'], 'metrics' | 'score_band'>
> & {
  score_band: 'LOW' | 'MEDIUM' | 'HIGH'
  metrics: ScoringMetrics
}

/** Canonical client shape: normalized record, order always derived (ADR-03). */
export type TransactionRecord = Readonly<Record<string, Transaction>>

/**
 * Stream events as a discriminated union; the generated shape cannot express
 * that DELETED carries only `transaction_id` (verified in findings §6).
 */
export type TransactionEvent =
  | { type: 'TRANSACTION_ADDED'; transaction: Transaction }
  | { type: 'TRANSACTION_UPDATED'; transaction: Transaction }
  | { type: 'TRANSACTION_DELETED'; transaction_id: string }

export interface OffsetPage {
  transactions: Transaction[]
  total: number
  page: number
  limit: number
  total_pages: number
  has_more: boolean
}

export type ApiErrorKind =
  | 'http' // non-2xx status with or without a JSON error body
  | 'api' // an { error } body, including inside an HTTP 200 (findings §4)
  | 'network' // fetch rejected: offline, DNS, CORS
  | 'parse' // body was not the JSON we expected

/**
 * The one error type features see. `aborted` is deliberately absent: an
 * aborted request throws the native AbortError so TanStack Query can
 * distinguish cancellation from failure.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}
