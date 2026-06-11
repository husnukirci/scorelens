import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { ExplanationPanel } from '@/features/explanation/ExplanationPanel'

import { makeReliability } from '../../test/factories'
import { server } from '../../test/server'

const base = 'http://localhost:3001'

describe('ExplanationPanel', () => {
  it('splits drivers into strengths, risks, and observations, with signal copy', async () => {
    server.use(
      http.get(`${base}/api/users/user_1001/reliability`, () =>
        HttpResponse.json(makeReliability()),
      ),
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <ExplanationPanel userId="user_1001" windowFrom="2026-06-11" />
      </QueryClientProvider>,
    )
    const strengths = (await screen.findByText('What strengthens it')).closest('section')
    const risks = screen.getByText('What weakens it').closest('section')
    expect(strengths).not.toBeNull()
    expect(risks).not.toBeNull()
    if (strengths === null || risks === null) throw new Error('unreachable')
    expect(within(strengths).getByText(/Savings behavior/)).toBeInTheDocument()
    expect(within(risks).getByText(/negative balance day/)).toBeInTheDocument()
    expect(screen.getByText(/Income present in 5\/6 months/)).toBeInTheDocument()
    // plain-language copy from the signal registry
    expect(screen.getByText(/How the score works/)).toBeInTheDocument()
    expect(screen.getByText(/How consistently income arrived/)).toBeInTheDocument()
  })
})
