import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import { ErrorFallback } from '@/components/ErrorFallback'
import { useUiStore } from '@/state/uiStore'
import { logEvent } from '@/utils/log'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Top-level boundary (ADR-15): renders the fallback and logs a structured
 * payload carrying the client state an incident responder needs first —
 * which user/window was on screen and what the stream was doing.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const { selectedUserId, windowFrom, streamStatus } = useUiStore.getState()
    logEvent(
      'app.error',
      {
        message: error.message,
        componentStack: info.componentStack,
        selectedUserId,
        windowFrom,
        streamStatus,
      },
      'error',
    )
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      return <ErrorFallback message={this.state.error.message} />
    }
    return this.props.children
  }
}
