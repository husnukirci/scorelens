import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { Header } from '@/app/Header'
import { useUiStore } from '@/state/uiStore'

const initialUiState = useUiStore.getState()

function renderHeader(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Header />
    </QueryClientProvider>,
  )
}

describe('Header', () => {
  beforeEach(() => {
    useUiStore.setState(initialUiState, true)
  })

  it('lists users from discovery and writes the selection to the ui store', async () => {
    renderHeader()
    const picker = await screen.findByRole('combobox', { name: 'User' })
    await screen.findByRole('option', { name: 'user_1002' })
    await userEvent.selectOptions(picker, 'user_1002')
    expect(useUiStore.getState().selectedUserId).toBe('user_1002')
  })

  it('writes the scoring window end date to the ui store', async () => {
    renderHeader()
    const input = screen.getByLabelText('Window end')
    await userEvent.clear(input)
    await userEvent.type(input, '2026-06-11')
    expect(useUiStore.getState().windowFrom).toBe('2026-06-11')
  })

  it('keeps the picker disabled until discovery resolves', () => {
    renderHeader()
    expect(screen.getByRole('combobox', { name: 'User' })).toBeDisabled()
  })
})
