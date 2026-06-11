import { useUiStore } from '@/state/uiStore'

const initialState = useUiStore.getState()

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState(initialState, true)
  })

  it('starts with no user, no scoring window, and an offline stream', () => {
    const state = useUiStore.getState()
    expect(state.selectedUserId).toBeNull()
    expect(state.windowFrom).toBeNull()
    expect(state.streamStatus).toBe('offline')
  })

  it('selects a user', () => {
    useUiStore.getState().selectUser('user_1001')
    expect(useUiStore.getState().selectedUserId).toBe('user_1001')
  })

  it('sets the scoring window end date', () => {
    useUiStore.getState().setWindowFrom('2026-06-11')
    expect(useUiStore.getState().windowFrom).toBe('2026-06-11')
  })

  it('tracks the four stream statuses', () => {
    for (const status of ['live', 'delayed', 'reconnecting', 'offline'] as const) {
      useUiStore.getState().setStreamStatus(status)
      expect(useUiStore.getState().streamStatus).toBe(status)
    }
  })

  it('changing user does not disturb the scoring window', () => {
    useUiStore.getState().setWindowFrom('2026-06-11')
    useUiStore.getState().selectUser('user_1002')
    expect(useUiStore.getState().windowFrom).toBe('2026-06-11')
  })

  describe('explorer view state', () => {
    it('starts unfiltered, unsearched, sorted by date descending', () => {
      const state = useUiStore.getState()
      expect(state.categoryFilter).toBeNull()
      expect(state.directionFilter).toBe('all')
      expect(state.searchText).toBe('')
      expect(state.sort).toEqual({ column: 'date', direction: 'desc' })
    })

    it('sets and clears the category filter', () => {
      useUiStore.getState().setCategoryFilter('5411')
      expect(useUiStore.getState().categoryFilter).toBe('5411')
      useUiStore.getState().setCategoryFilter(null)
      expect(useUiStore.getState().categoryFilter).toBeNull()
    })

    it('sets the direction filter and search text', () => {
      useUiStore.getState().setDirectionFilter('credit')
      useUiStore.getState().setSearchText('rewe')
      expect(useUiStore.getState().directionFilter).toBe('credit')
      expect(useUiStore.getState().searchText).toBe('rewe')
    })

    it('toggleSort flips direction on the active column', () => {
      useUiStore.getState().toggleSort('date')
      expect(useUiStore.getState().sort).toEqual({ column: 'date', direction: 'asc' })
      useUiStore.getState().toggleSort('date')
      expect(useUiStore.getState().sort).toEqual({ column: 'date', direction: 'desc' })
    })

    it('toggleSort on a new column applies that column default direction', () => {
      useUiStore.getState().toggleSort('amount')
      expect(useUiStore.getState().sort).toEqual({ column: 'amount', direction: 'desc' })
      useUiStore.getState().toggleSort('merchant')
      expect(useUiStore.getState().sort).toEqual({ column: 'merchant', direction: 'asc' })
    })

    it('clearFilters resets filters and search but keeps the sort', () => {
      useUiStore.getState().setCategoryFilter('5411')
      useUiStore.getState().setDirectionFilter('debit')
      useUiStore.getState().setSearchText('lidl')
      useUiStore.getState().toggleSort('amount')
      useUiStore.getState().clearFilters()
      const state = useUiStore.getState()
      expect(state.categoryFilter).toBeNull()
      expect(state.directionFilter).toBe('all')
      expect(state.searchText).toBe('')
      expect(state.sort).toEqual({ column: 'amount', direction: 'desc' })
    })
  })
})
