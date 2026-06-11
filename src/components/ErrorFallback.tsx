import type { ReactElement } from 'react'

export function ErrorFallback({ message }: { message?: string }): ReactElement {
  return (
    <main role="alert" className="grid min-h-screen place-items-center bg-surface text-ink">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-ink-muted">
          {message ?? 'An unexpected error interrupted the app.'} The error has been logged.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border border-ink/20 px-4 py-2 text-sm font-medium hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none"
        >
          Reload
        </button>
      </div>
    </main>
  )
}
