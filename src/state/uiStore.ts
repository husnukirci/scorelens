import { create } from 'zustand'

import type { StreamStatus } from '@/api/sse/transport'

export type DirectionFilter = 'all' | 'credit' | 'debit'
export type SortColumn = 'date' | 'amount' | 'merchant'
export interface SortState {
  column: SortColumn
  direction: 'asc' | 'desc'
}

/**
 * Ephemeral session activity log for the live feed — what the stream DID,
 * capped and gone on reload. Deliberately not server state: it cannot be
 * refetched; canonical transaction truth stays in the Query cache (ADR-02).
 */
export interface StreamFeedEntry {
  at: string
  type: 'TRANSACTION_ADDED' | 'TRANSACTION_UPDATED' | 'TRANSACTION_DELETED'
  transactionId: string
  merchant?: string
}

const STREAM_FEED_LIMIT = 20

/** Newest dates and largest amounts first; merchants alphabetical. */
const SORT_DEFAULTS: Record<SortColumn, SortState['direction']> = {
  date: 'desc',
  amount: 'desc',
  merchant: 'asc',
}

/**
 * The one client-state store (ADR-02): values the user re-chooses on reload.
 * Server data never lands here. Filters/search/sort are deliberately NOT in
 * query keys — they drive the client-side derive pipeline only.
 * `windowFrom` is the scoring-window END date (the API's `from` param); the
 * window extends 6 calendar months back from it.
 */
interface UiState {
  selectedUserId: string | null
  windowFrom: string | null
  streamStatus: StreamStatus
  categoryFilter: string | null
  directionFilter: DirectionFilter
  searchText: string
  sort: SortState
  streamEvents: StreamFeedEntry[]
  selectUser: (userId: string) => void
  setWindowFrom: (date: string) => void
  setStreamStatus: (status: StreamStatus) => void
  setCategoryFilter: (mcc: string | null) => void
  setDirectionFilter: (direction: DirectionFilter) => void
  setSearchText: (text: string) => void
  toggleSort: (column: SortColumn) => void
  clearFilters: () => void
  pushStreamEvent: (entry: StreamFeedEntry) => void
}

export const useUiStore = create<UiState>()((set) => ({
  selectedUserId: null,
  windowFrom: null,
  streamStatus: 'offline',
  categoryFilter: null,
  directionFilter: 'all',
  searchText: '',
  sort: { column: 'date', direction: 'desc' },
  streamEvents: [],
  selectUser: (userId) => set({ selectedUserId: userId }),
  setWindowFrom: (date) => set({ windowFrom: date }),
  setStreamStatus: (status) => set({ streamStatus: status }),
  setCategoryFilter: (mcc) => set({ categoryFilter: mcc }),
  setDirectionFilter: (direction) => set({ directionFilter: direction }),
  setSearchText: (text) => set({ searchText: text }),
  toggleSort: (column) =>
    set((state) => ({
      sort:
        state.sort.column === column
          ? { column, direction: state.sort.direction === 'asc' ? 'desc' : 'asc' }
          : { column, direction: SORT_DEFAULTS[column] },
    })),
  clearFilters: () => set({ categoryFilter: null, directionFilter: 'all', searchText: '' }),
  pushStreamEvent: (entry) =>
    set((state) => ({ streamEvents: [entry, ...state.streamEvents].slice(0, STREAM_FEED_LIMIT) })),
}))
