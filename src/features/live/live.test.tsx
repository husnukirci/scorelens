import { render, screen } from '@testing-library/react'

import { EventFeedPanel } from '@/features/live/EventFeedPanel'
import { StreamStatusIndicator } from '@/features/live/StreamStatusIndicator'
import { useUiStore } from '@/state/uiStore'

const initialUiState = useUiStore.getState()

beforeEach(() => {
  useUiStore.setState(initialUiState, true)
})

describe('StreamStatusIndicator', () => {
  it('announces each status as text, with the measured cadence for delayed', () => {
    const { rerender } = render(<StreamStatusIndicator />)
    expect(screen.getByTestId('stream-status')).toHaveTextContent('Offline')
    expect(screen.getByTestId('stream-status')).toHaveAttribute('aria-live', 'polite')

    useUiStore.getState().setStreamStatus('delayed')
    rerender(<StreamStatusIndicator />)
    expect(screen.getByTestId('stream-status')).toHaveTextContent(
      'Live (delayed) — updates ~every 30s',
    )

    useUiStore.getState().setStreamStatus('reconnecting')
    rerender(<StreamStatusIndicator />)
    expect(screen.getByTestId('stream-status')).toHaveTextContent('Reconnecting…')

    useUiStore.getState().setStreamStatus('live')
    rerender(<StreamStatusIndicator />)
    expect(screen.getByTestId('stream-status')).toHaveTextContent('Live')
  })
})

describe('EventFeedPanel', () => {
  it('explains its empty state in terms of idempotency', () => {
    render(<EventFeedPanel />)
    expect(screen.getByText(/No applied stream events yet/)).toBeInTheDocument()
  })

  it('lists applied events newest first with time, kind, and merchant', () => {
    useUiStore.getState().pushStreamEvent({
      at: '2026-06-11T10:00:01Z',
      type: 'TRANSACTION_ADDED',
      transactionId: 'evt_1',
      merchant: 'REWE Markt',
    })
    useUiStore.getState().pushStreamEvent({
      at: '2026-06-11T10:00:09Z',
      type: 'TRANSACTION_DELETED',
      transactionId: 'txn_gone',
    })
    render(<EventFeedPanel />)
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent(/\d{2}:\d{2}:\d{2}/)
    expect(items[0]).toHaveTextContent('Removed')
    expect(items[0]).toHaveTextContent('txn_gone')
    expect(items[1]).toHaveTextContent('Added')
    expect(items[1]).toHaveTextContent('REWE Markt')
  })
})
