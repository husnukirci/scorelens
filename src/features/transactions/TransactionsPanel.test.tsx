import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import type { Transaction } from '@/api/types'
import { TransactionsPanel } from '@/features/transactions/TransactionsPanel'
import { useUiStore } from '@/state/uiStore'

import { makeTransaction, resetSequence } from '../../test/factories'
import { server } from '../../test/server'

const base = 'http://localhost:3001'
const initialUiState = useUiStore.getState()

function serveTransactions(transactions: Transaction[]): void {
  server.use(
    http.get(`${base}/api/users/user_1001/transactions`, () =>
      HttpResponse.json({
        transactions,
        total: transactions.length,
        page: 1,
        limit: 200,
        total_pages: 1,
        has_more: false,
      }),
    ),
  )
}

function renderPanel(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <TransactionsPanel userId="user_1001" windowFrom="2026-06-11" />
    </QueryClientProvider>,
  )
}

describe('TransactionsPanel', () => {
  beforeEach(() => {
    resetSequence()
    useUiStore.setState(initialUiState, true)
    // happy-dom has no layout: the virtualizer measures via offsetWidth/Height
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      value: 480,
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      value: 800,
    })
  })

  afterEach(() => {
    // restore happy-dom's own accessors by removing our overrides
    delete (HTMLElement.prototype as { offsetHeight?: unknown }).offsetHeight
    delete (HTMLElement.prototype as { offsetWidth?: unknown }).offsetWidth
    vi.restoreAllMocks()
  })

  it('renders rows in a grid with derived date-descending order', async () => {
    serveTransactions([
      makeTransaction({ id: 'txn_old', date: '2026-01-05', merchant_name: 'Aldi' }),
      makeTransaction({ id: 'txn_new', date: '2026-05-02', merchant_name: 'Lidl' }),
    ])
    renderPanel()
    const grid = await screen.findByRole('grid', { name: 'Transactions' })
    const rows = within(grid).getAllByRole('row')
    // header row first, then newest transaction
    expect(rows[1]).toHaveTextContent('Lidl')
    expect(rows[2]).toHaveTextContent('Aldi')
    expect(screen.getByText('2 of 2 transactions')).toBeInTheDocument()
  })

  it('filters by category from the registry and shows the filtered count', async () => {
    serveTransactions([
      makeTransaction({ merchant_category_code: '5411', merchant_name: 'Aldi' }),
      makeTransaction({ merchant_category_code: '6513', merchant_name: 'Hausverwaltung' }),
    ])
    renderPanel()
    await screen.findByRole('grid', { name: 'Transactions' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category' }), '5411')
    expect(screen.getByText('1 of 2 transactions')).toBeInTheDocument()
    expect(screen.queryByText('Hausverwaltung')).not.toBeInTheDocument()
  })

  it('shows the empty-filter state with a working clear button', async () => {
    serveTransactions([makeTransaction({ merchant_name: 'Aldi', description: 'EINKAUF' })])
    renderPanel()
    await screen.findByRole('grid', { name: 'Transactions' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Direction' }), 'credit')
    const emptyMessage = await screen.findByText('No transactions match the active filters.')
    // both the filter bar and the empty state offer clearing; use the latter
    const emptyState = emptyMessage.parentElement
    expect(emptyState).not.toBeNull()
    if (emptyState === null) throw new Error('unreachable')
    await userEvent.click(within(emptyState).getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByRole('grid', { name: 'Transactions' })).toBeInTheDocument()
  })

  it('sorts via keyboard-reachable headers and exposes aria-sort', async () => {
    serveTransactions([
      makeTransaction({ id: 'txn_small', amount: -5, merchant_name: 'Starbucks' }),
      makeTransaction({ id: 'txn_big', amount: -500, merchant_name: 'Hausverwaltung' }),
    ])
    renderPanel()
    const grid = await screen.findByRole('grid', { name: 'Transactions' })
    await userEvent.click(screen.getByRole('button', { name: /amount/i }))
    const headers = within(grid).getAllByRole('columnheader')
    const amountHeader = headers.find((header) => header.textContent?.match(/amount/i))
    expect(amountHeader).toHaveAttribute('aria-sort', 'descending')
    const rows = within(grid).getAllByRole('row')
    // amount desc: -5 is greater than -500
    expect(rows[1]).toHaveTextContent('Starbucks')
  })

  it('shows the scoring-window empty state when the user has no transactions', async () => {
    serveTransactions([])
    renderPanel()
    expect(await screen.findByText('No transactions in this scoring window.')).toBeInTheDocument()
  })

  it('debounced search narrows rows by merchant', async () => {
    serveTransactions([
      makeTransaction({ merchant_name: 'Aldi', description: 'EINKAUF' }),
      makeTransaction({ merchant_name: 'BVG', description: 'MONATSTICKET' }),
    ])
    renderPanel()
    await screen.findByRole('grid', { name: 'Transactions' })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'bvg')
    expect(await screen.findByText('1 of 2 transactions')).toBeInTheDocument()
    expect(screen.queryByText('Aldi')).not.toBeInTheDocument()
  })
})
