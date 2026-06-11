import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { ErrorBoundary } from '@/app/ErrorBoundary'

function Bomb(): ReactElement {
  throw new Error('panel exploded')
}

describe('ErrorBoundary', () => {
  it('renders the fallback and logs a structured payload when a child throws', () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(errorLog).toHaveBeenCalledWith(
      '[scorelens]',
      expect.objectContaining({ event: 'app.error', message: 'panel exploded' }),
    )
    errorLog.mockRestore()
  })

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})
