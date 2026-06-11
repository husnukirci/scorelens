import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { DataState } from '@/components/DataState'

describe('DataState', () => {
  it('renders a busy skeleton while loading', () => {
    render(
      <DataState status="loading">
        <p>content</p>
      </DataState>,
    )
    expect(screen.getByTestId('data-state-loading')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('renders the error as an alert with a working retry button', async () => {
    const onRetry = vi.fn()
    render(
      <DataState
        status="error"
        errorMessage="The scoring service is unreachable."
        onRetry={onRetry}
      >
        <p>content</p>
      </DataState>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('The scoring service is unreachable.')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders the empty message', () => {
    render(
      <DataState status="empty" emptyMessage="No transactions in this scoring window.">
        <p>content</p>
      </DataState>,
    )
    expect(screen.getByText('No transactions in this scoring window.')).toBeInTheDocument()
  })

  it('renders children when ready', () => {
    render(
      <DataState status="ready">
        <p>content</p>
      </DataState>,
    )
    expect(screen.getByText('content')).toBeInTheDocument()
  })
})
