import { nextId, resetSequence } from './factories'

describe('factories sequence', () => {
  beforeEach(() => {
    resetSequence()
  })

  it('produces unique, prefixed, zero-padded ids', () => {
    expect(nextId('txn')).toBe('txn_00001')
    expect(nextId('txn')).toBe('txn_00002')
    expect(nextId('user')).toBe('user_00003')
  })

  it('restarts from one after a reset', () => {
    nextId('txn')
    resetSequence()
    expect(nextId('txn')).toBe('txn_00001')
  })
})
