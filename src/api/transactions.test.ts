import { delay, http, HttpResponse } from 'msw'

import { fetchAllTransactions, PAGE_LIMIT } from '@/api/transactions'
import { ApiError } from '@/api/types'
import type { OffsetPage, Transaction } from '@/api/types'

import { makeTransaction, resetSequence } from '../test/factories'
import { server } from '../test/server'

const base = 'http://localhost:3001'
const url = `${base}/api/users/user_1001/transactions`
const range = { from: '2025-09-01', to: '2026-06-11' }

function servePages(pages: Transaction[][]): Array<{ page: string | null; limit: string | null }> {
  const requests: Array<{ page: string | null; limit: string | null }> = []
  const total = pages.flat().length
  server.use(
    http.get(url, ({ request }) => {
      const params = new URL(request.url).searchParams
      requests.push({ page: params.get('page'), limit: params.get('limit') })
      const pageNumber = Number(params.get('page'))
      const body: OffsetPage = {
        transactions: pages[pageNumber - 1] ?? [],
        total,
        page: pageNumber,
        limit: Number(params.get('limit')),
        total_pages: pages.length,
        has_more: pageNumber < pages.length,
      }
      return HttpResponse.json(body)
    }),
  )
  return requests
}

describe('fetchAllTransactions', () => {
  beforeEach(() => {
    resetSequence()
  })

  it('assembles all pages into a record keyed by transaction id', async () => {
    const pages = [
      [makeTransaction(), makeTransaction()],
      [makeTransaction(), makeTransaction()],
      [makeTransaction()],
    ]
    servePages(pages)
    const record = await fetchAllTransactions('user_1001', {
      ...range,
      signal: new AbortController().signal,
    })
    expect(Object.keys(record)).toHaveLength(5)
    for (const transaction of pages.flat()) {
      expect(record[transaction.id]).toEqual(transaction)
    }
  })

  it('requests pages sequentially with an explicit limit on every request', async () => {
    const requests = servePages([[makeTransaction()], [makeTransaction()], [makeTransaction()]])
    await fetchAllTransactions('user_1001', { ...range, signal: new AbortController().signal })
    expect(requests).toEqual([
      { page: '1', limit: String(PAGE_LIMIT) },
      { page: '2', limit: String(PAGE_LIMIT) },
      { page: '3', limit: String(PAGE_LIMIT) },
    ])
  })

  it('stops after one request when the first page is the last', async () => {
    const requests = servePages([[makeTransaction()]])
    await fetchAllTransactions('user_1001', { ...range, signal: new AbortController().signal })
    expect(requests).toHaveLength(1)
  })

  it('returns an empty record for a user with no transactions in range', async () => {
    servePages([[]])
    const record = await fetchAllTransactions('user_1001', {
      ...range,
      signal: new AbortController().signal,
    })
    expect(record).toEqual({})
  })

  it('keeps the last occurrence when a transaction id repeats across pages', async () => {
    const original = makeTransaction({ id: 'txn_dup', amount: -10 })
    const updated = makeTransaction({ id: 'txn_dup', amount: -99 })
    servePages([[original], [updated]])
    const record = await fetchAllTransactions('user_1001', {
      ...range,
      signal: new AbortController().signal,
    })
    expect(Object.keys(record)).toHaveLength(1)
    expect(record['txn_dup']?.amount).toBe(-99)
  })

  it('propagates an ApiError from a mid-loop page and stops fetching', async () => {
    let requestCount = 0
    server.use(
      http.get(url, ({ request }) => {
        requestCount += 1
        const params = new URL(request.url).searchParams
        if (params.get('page') === '2') {
          return HttpResponse.json({ error: 'Banking API error: 429 Too Many Requests' })
        }
        return HttpResponse.json({
          transactions: [makeTransaction()],
          total: 400,
          page: 1,
          limit: PAGE_LIMIT,
          total_pages: 2,
          has_more: true,
        } satisfies OffsetPage)
      }),
    )
    await expect(
      fetchAllTransactions('user_1001', { ...range, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ name: 'ApiError', kind: 'api' })
    expect(requestCount).toBe(2)
  })

  it('rejects with AbortError when aborted mid-loop', async () => {
    const controller = new AbortController()
    server.use(
      http.get(url, async ({ request }) => {
        const params = new URL(request.url).searchParams
        if (params.get('page') === '2') {
          controller.abort()
          await delay(1_000)
        }
        return HttpResponse.json({
          transactions: [makeTransaction()],
          total: 400,
          page: Number(params.get('page')),
          limit: PAGE_LIMIT,
          total_pages: 3,
          has_more: true,
        } satisfies OffsetPage)
      }),
    )
    await expect(
      fetchAllTransactions('user_1001', { ...range, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('exposes ApiError instances for http failures (user not found)', async () => {
    server.use(
      http.get(url, () =>
        HttpResponse.json({ error: 'User user_1001 not found' }, { status: 404 }),
      ),
    )
    let caught: unknown
    try {
      await fetchAllTransactions('user_1001', { ...range, signal: new AbortController().signal })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(ApiError)
  })
})
