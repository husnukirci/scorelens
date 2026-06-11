const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * Calendar-month subtraction on ISO dates (YYYY-MM-DD), clamping to the last
 * day when the target month is shorter — mirrors the backend's "window
 * extends 6 calendar months back" semantics for the scoring window.
 */
export function subtractCalendarMonths(isoDate: string, months: number): string {
  if (!ISO_DATE.test(isoDate)) {
    throw new Error(`expected an ISO date (YYYY-MM-DD), got "${isoDate}"`)
  }
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number]
  const targetMonthIndex = month - 1 - months
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12
  const clampedDay = Math.min(day, daysInMonth(targetYear, normalizedMonthIndex))
  const result = new Date(Date.UTC(targetYear, normalizedMonthIndex, clampedDay))
  const iso = result.toISOString().slice(0, 10)
  return iso
}
