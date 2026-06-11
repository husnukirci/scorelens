import { cn } from './cn'

describe('cn', () => {
  it('joins class values and drops falsy entries', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b')
  })

  it('supports conditional object syntax', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })
})
