import { create } from 'zustand'

import type { StreamStatus } from '@/api/sse/transport'

/**
 * The one client-state store (ADR-02): values the user re-chooses on reload.
 * Server data never lands here. Filters/sort/search join in Phase 4.
 * `windowFrom` is the scoring-window END date (the API's `from` param); the
 * window extends 6 calendar months back from it.
 */
interface UiState {
  selectedUserId: string | null
  windowFrom: string | null
  streamStatus: StreamStatus
  selectUser: (userId: string) => void
  setWindowFrom: (date: string) => void
  setStreamStatus: (status: StreamStatus) => void
}

export const useUiStore = create<UiState>()((set) => ({
  selectedUserId: null,
  windowFrom: null,
  streamStatus: 'offline',
  selectUser: (userId) => set({ selectedUserId: userId }),
  setWindowFrom: (date) => set({ windowFrom: date }),
  setStreamStatus: (status) => set({ streamStatus: status }),
}))
