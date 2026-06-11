import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { BreakdownChart } from '@/features/score-breakdown/BreakdownChart'
import { BreakdownPanel } from '@/features/score-breakdown/BreakdownPanel'

import { makeReliability } from '../../test/factories'
import { server } from '../../test/server'

const base = 'http://localhost:3001'

beforeEach(() => {
  // happy-dom has no layout: ResponsiveContainer measures via offsets
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 224 })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 600 })
})

afterEach(() => {
  delete (HTMLElement.prototype as { offsetHeight?: unknown }).offsetHeight
  delete (HTMLElement.prototype as { offsetWidth?: unknown }).offsetWidth
})

describe('BreakdownPanel', () => {
  it('renders all four signals with derived points and the derivation caption', async () => {
    server.use(
      http.get(`${base}/api/users/user_1001/reliability`, () =>
        HttpResponse.json(makeReliability()),
      ),
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <BreakdownPanel userId="user_1001" windowFrom="2026-06-11" />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Income regularity:')).toBeInTheDocument()
    // regularity, consistency, and the coverage residual all derive to 21 here
    expect(screen.getAllByText('21 / 25')).toHaveLength(3)
    expect(screen.getByText('Resilience:')).toBeInTheDocument()
    expect(screen.getByText('11 / 25')).toBeInTheDocument()
    expect(screen.getByText(/derived by this tool/)).toBeInTheDocument()
    expect(screen.getByTestId('breakdown-chart')).toBeInTheDocument()
  })
})

describe('BreakdownChart', () => {
  it('renders an unknown signal id through the fallback path instead of crashing (ADR-12)', () => {
    const { container } = render(
      <BreakdownChart
        contributions={[
          { signalId: 'income_regularity', points: 21 },
          { signalId: 'brand_new_signal', points: 7 },
        ]}
      />,
    )
    // the raw id appears as the axis label via the neutral fallback meta
    // (recharts splits svg labels into tspans, so match on textContent)
    expect(container.textContent).toContain('brand_new_signal')
    expect(container.textContent).toContain('Income regularity')
  })
})
