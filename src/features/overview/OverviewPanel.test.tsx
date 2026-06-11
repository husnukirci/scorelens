import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { OverviewPanel } from '@/features/overview/OverviewPanel'

import { makeReliability } from '../../test/factories'
import { server } from '../../test/server'

const base = 'http://localhost:3001'

function renderPanel(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <OverviewPanel userId="user_1001" windowFrom="2026-06-11" />
    </QueryClientProvider>,
  )
}

describe('OverviewPanel', () => {
  it('shows score, band as color plus text, window, and key metrics', async () => {
    server.use(
      http.get(`${base}/api/users/user_1001/reliability`, () =>
        HttpResponse.json(makeReliability()),
      ),
    )
    renderPanel()
    expect(await screen.findByTestId('overview-score')).toHaveTextContent('74')
    expect(screen.getByText('Medium reliability')).toBeInTheDocument()
    expect(screen.getByText(/scoring window ending 2026-06-11/)).toBeInTheDocument()
    expect(screen.getByText('4/6')).toBeInTheDocument()
    expect(screen.getByText('1.56×')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
  })

  it('renders an unknown band from the api through the neutral fallback', async () => {
    server.use(
      http.get(`${base}/api/users/user_1001/reliability`, () =>
        HttpResponse.json(makeReliability({ score_band: 'EXCEPTIONAL' as never })),
      ),
    )
    renderPanel()
    expect(await screen.findByText('EXCEPTIONAL')).toBeInTheDocument()
  })

  it('shows the offline error state when paused with nothing cached', async () => {
    server.use(
      http.get(`${base}/api/users/user_1001/reliability`, () =>
        HttpResponse.json(makeReliability()),
      ),
    )
    onlineManager.setOnline(false)
    try {
      renderPanel()
      expect(await screen.findByRole('alert')).toHaveTextContent(/offline/i)
    } finally {
      onlineManager.setOnline(true)
    }
  })
})
