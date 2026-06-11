import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { ShellPanels } from '@/app/ShellPanels'

import { server } from '../test/server'

const base = 'http://localhost:3001'

function renderPanels(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ShellPanels userId="user_1001" windowFrom="2026-06-11" />
    </QueryClientProvider>,
  )
}

function serveHappyPath(): void {
  server.use(
    http.get(`${base}/api/users/user_1001/reliability`, () =>
      HttpResponse.json({
        user_id: 'user_1001',
        from: '2026-06-11',
        currency: 'EUR',
        reliability_index: 74,
        score_band: 'MEDIUM',
        metrics: {
          income_regularity: 0.83,
          income_coverage_ratio: 1.56,
          essential_payments_consistency: 0.83,
          good_months: 4,
          negative_balance_days: 38,
          late_fee_events: 0,
        },
        drivers: [],
      }),
    ),
    http.get(`${base}/api/users/user_1001/transactions`, () =>
      HttpResponse.json({
        transactions: [],
        total: 0,
        page: 1,
        limit: 200,
        total_pages: 1,
        has_more: false,
      }),
    ),
  )
}

describe('ShellPanels', () => {
  it('renders score and the transactions empty state through DataState', async () => {
    serveHappyPath()
    renderPanels()
    expect(await screen.findByTestId('shell-score')).toHaveTextContent('74')
    expect(await screen.findByText('No transactions in this scoring window.')).toBeInTheDocument()
  })

  it('maps server errors to the alert path with retry', async () => {
    server.use(
      http.get(`${base}/api/users/user_1001/reliability`, () =>
        HttpResponse.json({ error: 'User user_1001 not found' }, { status: 404 }),
      ),
      http.get(`${base}/api/users/user_1001/transactions`, () =>
        HttpResponse.json({ error: 'User user_1001 not found' }, { status: 404 }),
      ),
    )
    renderPanels()
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0]).toHaveTextContent('User user_1001 not found')
  })

  it('shows an honest offline message instead of an endless skeleton when paused', async () => {
    serveHappyPath()
    onlineManager.setOnline(false)
    try {
      renderPanels()
      const alerts = await screen.findAllByRole('alert')
      expect(alerts[0]).toHaveTextContent('You appear to be offline.')
    } finally {
      onlineManager.setOnline(true)
    }
  })
})
