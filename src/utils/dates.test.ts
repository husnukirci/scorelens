import { subtractCalendarMonths, todayIso } from './dates'

describe('subtractCalendarMonths', () => {
  it('moves back within a year', () => {
    expect(subtractCalendarMonths('2026-08-20', 6)).toBe('2026-02-20')
  })

  it('crosses a year boundary', () => {
    expect(subtractCalendarMonths('2026-02-20', 6)).toBe('2025-08-20')
  })

  it('clamps to the last day when the target month is shorter', () => {
    expect(subtractCalendarMonths('2026-05-31', 6)).toBe('2025-11-30')
    expect(subtractCalendarMonths('2026-03-31', 1)).toBe('2026-02-28')
  })

  it('handles leap-year february', () => {
    expect(subtractCalendarMonths('2028-08-29', 6)).toBe('2028-02-29')
    expect(subtractCalendarMonths('2027-08-30', 6)).toBe('2027-02-28')
  })

  it('rejects a malformed date instead of propagating NaN', () => {
    expect(() => subtractCalendarMonths('20-06-2026', 6)).toThrow(/date/i)
  })
})

describe('todayIso', () => {
  it('formats the current date as YYYY-MM-DD in utc', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T22:30:00Z'))
    expect(todayIso()).toBe('2026-06-11')
    vi.useRealTimers()
  })
})
