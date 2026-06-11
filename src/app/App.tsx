import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { ApiError } from '@/api/types'

import { ErrorBoundary } from './ErrorBoundary'
import { Shell } from './Shell'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // client errors (bad user, bad params) will not heal on retry
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status !== undefined && error.status < 500) {
          return false
        }
        return failureCount < 2
      },
    },
  },
})

export function App(): ReactElement {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Shell />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
