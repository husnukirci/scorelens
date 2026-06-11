import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import type { MockInstance } from 'vitest'

import { reliabilityQueryKey, transactionsQueryKey } from '@/api/queries'
import { BACKOFF_BASE_MS, CYCLE_RECONNECT_DELAY_MS } from '@/api/sse/transport'
import {
  RELIABILITY_INVALIDATE_DEBOUNCE_MS,
  SAFETY_RECONCILE_MS,
  useTransactionStream,
} from '@/api/sse/useTransactionStream'
import type { TransactionRecord } from '@/api/types'
import { useUiStore } from '@/state/uiStore'

import {
  addedWire,
  deletedWire,
  envelopeResponse,
  makeTransaction,
  resetSequence,
} from '../../test/factories'

const KEY = transactionsQueryKey('user_1001', '2026-06-11')
const RELIABILITY_KEY = reliabilityQueryKey('user_1001', '2026-06-11')
const initialUiState = useUiStore.getState()

function setup(fetchMock: ReturnType<typeof vi.fn>): {
  queryClient: QueryClient
  invalidateSpy: MockInstance<QueryClient['invalidateQueries']>
  unmount: () => void
} {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { unmount } = renderHook(() => useTransactionStream('user_1001', '2026-06-11'), {
    wrapper,
  })
  return { queryClient, invalidateSpy, unmount }
}

describe('useTransactionStream', () => {
  beforeEach(() => {
    resetSequence()
    useUiStore.setState(initialUiState, true)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('applies stream events to the transactions cache via setQueryData', async () => {
    const transaction = makeTransaction()
    const fetchMock = vi.fn().mockResolvedValue(envelopeResponse(addedWire(1, transaction)))
    const { queryClient, unmount } = setup(fetchMock)
    queryClient.setQueryData(KEY, {})
    await vi.advanceTimersByTimeAsync(0)
    expect(queryClient.getQueryData<TransactionRecord>(KEY)?.[transaction.id]).toEqual(transaction)
    unmount()
  })

  it('ignores events until the initial fill has landed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelopeResponse(addedWire(1, makeTransaction())))
    const { queryClient, unmount } = setup(fetchMock)
    await vi.advanceTimersByTimeAsync(0)
    expect(queryClient.getQueryData(KEY)).toBeUndefined()
    unmount()
  })

  it('no-op events leave the cache reference untouched', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelopeResponse(deletedWire(1, 'txn_never_existed')))
    const { queryClient, unmount } = setup(fetchMock)
    const seeded: TransactionRecord = { txn_a: makeTransaction({ id: 'txn_a' }) }
    queryClient.setQueryData(KEY, seeded)
    await vi.advanceTimersByTimeAsync(0)
    expect(queryClient.getQueryData(KEY)).toBe(seeded)
    unmount()
  })

  it('surfaces stream status to the ui store and resets to offline on unmount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelopeResponse(addedWire(1, makeTransaction())))
    const { unmount } = setup(fetchMock)
    await vi.advanceTimersByTimeAsync(0)
    expect(useUiStore.getState().streamStatus).toBe('delayed')
    unmount()
    expect(useUiStore.getState().streamStatus).toBe('offline')
  })

  it('debounces the reliability invalidation across an event burst', async () => {
    const a = makeTransaction()
    const b = makeTransaction()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelopeResponse(`${addedWire(1, a)}${addedWire(2, b)}`))
    const { queryClient, invalidateSpy, unmount } = setup(fetchMock)
    queryClient.setQueryData(KEY, {})
    await vi.advanceTimersByTimeAsync(0)
    expect(invalidateSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(RELIABILITY_INVALIDATE_DEBOUNCE_MS)
    const reliabilityCalls = invalidateSpy.mock.calls.filter(
      ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(RELIABILITY_KEY),
    )
    expect(reliabilityCalls).toHaveLength(1)
    unmount()
  })

  it('clean cycles do not reconcile; recovery reconnects do', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelopeResponse(addedWire(1, makeTransaction())))
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValue(envelopeResponse(addedWire(2, makeTransaction())))
    const { invalidateSpy, unmount } = setup(fetchMock)
    const transactionsInvalidations = (): number =>
      invalidateSpy.mock.calls.filter(
        ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(KEY),
      ).length

    await vi.advanceTimersByTimeAsync(0)
    // clean cycle boundary: prompt reconnect, no reconcile
    await vi.advanceTimersByTimeAsync(CYCLE_RECONNECT_DELAY_MS)
    expect(transactionsInvalidations()).toBe(0)
    // the second connect failed -> backoff -> recovery connect reconciles once
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS * 1.2 + 1)
    expect(transactionsInvalidations()).toBe(1)
    unmount()
  })

  it('runs the degraded-mode safety reconcile at most once per interval', async () => {
    const transaction = makeTransaction()
    // a Response body is single-use; every reconnect cycle needs a fresh one
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(envelopeResponse(addedWire(1, transaction))))
    const { invalidateSpy, unmount } = setup(fetchMock)
    await vi.advanceTimersByTimeAsync(0)
    expect(useUiStore.getState().streamStatus).toBe('delayed')
    await vi.advanceTimersByTimeAsync(SAFETY_RECONCILE_MS)
    const transactionsInvalidations = invalidateSpy.mock.calls.filter(
      ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(KEY),
    )
    expect(transactionsInvalidations).toHaveLength(1)
    unmount()
  })

  it('opens nothing when user or window is missing', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    renderHook(() => useTransactionStream(null, null), { wrapper })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
