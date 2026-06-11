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
})
