import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { discoveryQueryOptions } from '@/api/queries'
import { StreamStatusIndicator } from '@/features/live/StreamStatusIndicator'
import { useUiStore } from '@/state/uiStore'

const controlClass =
  'rounded-md border border-ink/20 bg-surface-raised px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none'

function UserPicker(): ReactElement {
  const discovery = useQuery(discoveryQueryOptions())
  const selectedUserId = useUiStore((state) => state.selectedUserId)
  const selectUser = useUiStore((state) => state.selectUser)

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-muted">User</span>
      <select
        className={controlClass}
        value={selectedUserId ?? ''}
        disabled={discovery.isPending || discovery.isError}
        onChange={(event) => selectUser(event.target.value)}
      >
        <option value="" disabled>
          {discovery.isPending
            ? 'Loading users…'
            : discovery.isError
              ? 'Users unavailable'
              : 'Select user'}
        </option>
        {(discovery.data?.available_users ?? []).map((userId) => (
          <option key={userId} value={userId}>
            {userId}
          </option>
        ))}
      </select>
    </label>
  )
}

function WindowPicker(): ReactElement {
  const discovery = useQuery(discoveryQueryOptions())
  const windowFrom = useUiStore((state) => state.windowFrom)
  const setWindowFrom = useUiStore((state) => state.setWindowFrom)

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-muted">Window end</span>
      <input
        type="date"
        className={controlClass}
        value={windowFrom ?? ''}
        min={discovery.data?.data_range.from}
        max={discovery.data?.data_range.to}
        onChange={(event) => {
          // an in-progress edit can emit '' — keep the last valid window
          if (event.target.value !== '') setWindowFrom(event.target.value)
        }}
      />
    </label>
  )
}

export function Header(): ReactElement {
  return (
    <header className="border-b border-ink/10 bg-surface-raised">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">scorelens</h1>
        <div className="flex flex-wrap items-center gap-4">
          <UserPicker />
          <WindowPicker />
        </div>
        <div className="ml-auto">
          <StreamStatusIndicator />
        </div>
      </div>
    </header>
  )
}
