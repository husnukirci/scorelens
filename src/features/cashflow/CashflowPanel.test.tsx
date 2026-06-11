import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { CashflowPanel } from '@/features/cashflow/CashflowPanel'

import { makeTransaction, resetSequence } from '../../test/factories'
import { server } from '../../test/server'

const base = 'http://localhost:3001'

beforeEach(() => {
  resetSequence()
  // happy-dom has no layout: ResponsiveContainer measures via offsets
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 256 })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 600 })
})

afterEach(() => {
  delete (HTMLElement.prototype as { offsetHeight?: unknown }).offsetHeight
  delete (HTMLElement.prototype as { offsetWidth?: unknown }).offsetWidth
})

describe('CashflowPanel', () => {
  it('renders the monthly chart with income, expense, and net series', async () => {
    server.use(
      http.get(`${base}/api/users/user_1001/transactions`, () =>
        HttpResponse.json({
          transactions: [
            makeTransaction({ date: '2026-05-28', amount: 3200 }),
            makeTransaction({ date: '2026-05-01', amount: -950 }),
            makeTransaction({ date: '2026-04-15', amount: -60 }),
          ],
          total: 3,
          page: 1,
          limit: 200,
          total_pages: 1,
          has_more: false,
        }),
      ),
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <CashflowPanel userId="user_1001" windowFrom="2026-06-11" />
      </QueryClientProvider>,
    )
    expect(await screen.findByTestId('cashflow-chart')).toBeInTheDocument()
    // legend proves all three series mounted
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Net')).toBeInTheDocument()
    // the window's months appear on the axis, including quiet zero-filled ones
    expect(container.textContent).toContain('2026-05')
    expect(container.textContent).toContain('2025-12')
  })

  it('renders the error state with retry when the fill fails', async () => {
    server.use(
      http.get(`${base}/api/users/user_1001/transactions`, () =>
        HttpResponse.json({ error: 'User user_1001 not found' }, { status: 404 }),
      ),
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <CashflowPanel userId="user_1001" windowFrom="2026-06-11" />
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('User user_1001 not found')
  })
})
