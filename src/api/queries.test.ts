import { QueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

import { reliabilityQueryOptions, transactionsQueryOptions } from '@/api/queries'

import { server } from '../test/server'

const base = 'http://localhost:3001'

describe('query options', () => {
  it('keys are built from client state: user id and window end', () => {
    expect(transactionsQueryOptions('user_1001', '2026-06-11').queryKey).toEqual([
      'transactions',
      'user_1001',
      '2026-06-11',
    ])
    expect(reliabilityQueryOptions('user_1001', '2026-06-11').queryKey).toEqual([
      'reliability',
      'user_1001',
      '2026-06-11',
    ])
  })

  it('transactions query fetches the 6-month window ending at windowFrom', async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get(`${base}/api/users/user_1001/transactions`, ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json({
          transactions: [],
          total: 0,
          page: 1,
          limit: 200,
          total_pages: 1,
          has_more: false,
        })
      }),
    )
    const client = new QueryClient()
    await client.fetchQuery(transactionsQueryOptions('user_1001', '2026-06-11'))
    expect(requests[0]?.get('from')).toBe('2025-12-11')
    expect(requests[0]?.get('to')).toBe('2026-06-11')
  })

  it('reliability query passes windowFrom straight through', async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get(`${base}/api/users/user_1001/reliability`, ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json({ reliability_index: 74 })
      }),
    )
    const client = new QueryClient()
    await client.fetchQuery(reliabilityQueryOptions('user_1001', '2026-06-11'))
    expect(requests[0]?.get('from')).toBe('2026-06-11')
  })
})
