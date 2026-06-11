/**
 * Test-data factories (CLAUDE.md §7: never inline object literals for test data).
 * Entity factories (transactions, reliability responses) are added in Phase 2
 * once `api/types.ts` exists; they all draw ids from this sequence so test data
 * never collides within a test file.
 */

let sequence = 0

export function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}_${String(sequence).padStart(5, '0')}`
}

export function resetSequence(): void {
  sequence = 0
}
