import { queryErrorMessage, toDataStateStatus } from './asyncStatus'

function queryLike(overrides: {
  status: 'pending' | 'error' | 'success'
  fetchStatus?: 'fetching' | 'paused' | 'idle'
  error?: unknown
}): Parameters<typeof toDataStateStatus>[0] {
  return { fetchStatus: 'idle', error: null, ...overrides }
}

describe('toDataStateStatus', () => {
  it('maps pending to loading while actively fetching', () => {
    expect(toDataStateStatus(queryLike({ status: 'pending', fetchStatus: 'fetching' }))).toBe(
      'loading',
    )
  })

  it('maps an offline pause with nothing cached to error, not an endless skeleton', () => {
    expect(toDataStateStatus(queryLike({ status: 'pending', fetchStatus: 'paused' }))).toBe('error')
  })

  it('maps error and success', () => {
    expect(toDataStateStatus(queryLike({ status: 'error', error: new Error('x') }))).toBe('error')
    expect(toDataStateStatus(queryLike({ status: 'success' }))).toBe('ready')
  })
})

describe('queryErrorMessage', () => {
  it('returns the offline message for a paused pending query', () => {
    expect(queryErrorMessage(queryLike({ status: 'pending', fetchStatus: 'paused' }))).toMatch(
      /offline/i,
    )
  })

  it('returns the error message for failed queries', () => {
    expect(
      queryErrorMessage(queryLike({ status: 'error', error: new Error('User not found') })),
    ).toBe('User not found')
  })

  it('returns undefined for non-Error failures and healthy queries', () => {
    expect(
      queryErrorMessage(queryLike({ status: 'error', error: 'string reason' })),
    ).toBeUndefined()
    expect(queryErrorMessage(queryLike({ status: 'success' }))).toBeUndefined()
  })
})
