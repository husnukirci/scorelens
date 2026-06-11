import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'

import { CATEGORIES } from '@/domain/categories'
import { useUiStore } from '@/state/uiStore'
import type { DirectionFilter } from '@/state/uiStore'

export const DEBOUNCE_MS = 200

const controlClass =
  'rounded-md border border-ink/20 bg-surface-raised px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none'

function SearchBox(): ReactElement {
  const searchText = useUiStore((state) => state.searchText)
  const setSearchText = useUiStore((state) => state.setSearchText)
  const [draft, setDraft] = useState(searchText)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // external resets (clearFilters) flow back into the input — and cancel any
  // pending debounce, or a keystroke from before the reset would resurrect it
  useEffect(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setDraft(searchText)
  }, [searchText])

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-muted">Search</span>
      <input
        type="search"
        placeholder="Merchant or description"
        className={controlClass}
        value={draft}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          if (timer.current !== null) clearTimeout(timer.current)
          timer.current = setTimeout(() => setSearchText(next), DEBOUNCE_MS)
        }}
      />
    </label>
  )
}

export function FilterBar({ visible, total }: { visible: number; total: number }): ReactElement {
  const categoryFilter = useUiStore((state) => state.categoryFilter)
  const directionFilter = useUiStore((state) => state.directionFilter)
  const searchText = useUiStore((state) => state.searchText)
  const setCategoryFilter = useUiStore((state) => state.setCategoryFilter)
  const setDirectionFilter = useUiStore((state) => state.setDirectionFilter)
  const clearFilters = useUiStore((state) => state.clearFilters)
  const filtersActive = categoryFilter !== null || directionFilter !== 'all' || searchText !== ''

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-ink-muted">Category</span>
        <select
          className={controlClass}
          value={categoryFilter ?? ''}
          onChange={(event) =>
            setCategoryFilter(event.target.value === '' ? null : event.target.value)
          }
        >
          <option value="">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category.mcc} value={category.mcc}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-ink-muted">Direction</span>
        <select
          className={controlClass}
          value={directionFilter}
          onChange={(event) => setDirectionFilter(event.target.value as DirectionFilter)} // values come from the options below, all DirectionFilter members
        >
          <option value="all">All</option>
          <option value="credit">Money in</option>
          <option value="debit">Money out</option>
        </select>
      </label>
      <SearchBox />
      <p aria-live="polite" className="ml-auto text-sm text-ink-muted">
        {visible} of {total} transactions
      </p>
      {filtersActive && (
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-md border border-ink/20 px-2 py-1 text-sm hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
