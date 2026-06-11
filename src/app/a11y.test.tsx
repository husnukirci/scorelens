import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { axe } from 'vitest-axe'
import * as axeMatchers from 'vitest-axe/matchers'

import { Shell } from '@/app/Shell'
import { useUiStore } from '@/state/uiStore'

import { makeReliability, makeTransaction, resetSequence } from '../test/factories'
import { server } from '../test/server'

expect.extend(axeMatchers)

const base = 'http://localhost:3001'
const sseBase = 'http://localhost:3002'
const initialUiState = useUiStore.getState()

/** The one assembled-view axe smoke test (ADR-14). */
describe('main view accessibility', () => {
  beforeEach(() => {
    resetSequence()
    useUiStore.setState(initialUiState, true)
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 480 })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 900 })
  })

  afterEach(() => {
    delete (HTMLElement.prototype as { offsetHeight?: unknown }).offsetHeight
    delete (HTMLElement.prototype as { offsetWidth?: unknown }).offsetWidth
  })

  it('the assembled main view has no axe violations', async () => {
    server.use(
      http.get(`${base}/api/users/user_1001/reliability`, () =>
        HttpResponse.json(makeReliability()),
      ),
      http.get(`${base}/api/users/user_1001/transactions`, () =>
        HttpResponse.json({
          transactions: [
            makeTransaction({ date: '2026-05-28', amount: 3200 }),
            makeTransaction({ date: '2026-05-01', amount: -950 }),
          ],
          total: 2,
          page: 1,
          limit: 200,
          total_pages: 1,
          has_more: false,
        }),
      ),
      http.get(`${sseBase}/api/users/user_1001/transaction-events`, () =>
        HttpResponse.json({
          statusCode: 200,
          headers: { 'content-type': 'text/event-stream' },
          body: ': stream ended\n\n',
        }),
      ),
    )
    useUiStore.getState().selectUser('user_1001')
    useUiStore.getState().setWindowFrom('2026-06-11')

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Shell />
      </QueryClientProvider>,
    )
    await screen.findByTestId('overview-score')
    await screen.findByRole('grid', { name: 'Transactions' })

    expect(await axe(container)).toHaveNoViolations()
  }, 30_000)
})
