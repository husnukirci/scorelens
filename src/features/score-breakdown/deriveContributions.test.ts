import { deriveContributions } from '@/features/score-breakdown/deriveContributions'

import { makeReliability } from '../../test/factories'

function pointsOf(result: ReturnType<typeof deriveContributions>, id: string): number {
  const found = result.contributions.find((contribution) => contribution.signalId === id)
  if (found === undefined) throw new Error(`missing contribution ${id}`)
  return found.points
}

describe('deriveContributions', () => {
  it('derives the four signals from user_1001 live data, summing exactly to the score', () => {
    const result = deriveContributions(makeReliability())
    expect(pointsOf(result, 'income_regularity')).toBe(21) // 0.83 × 25
    expect(pointsOf(result, 'essential_consistency')).toBe(21) // 0.83 × 25
    expect(pointsOf(result, 'resilience')).toBe(11) // +21 savings − 10 negative days
    expect(pointsOf(result, 'income_coverage')).toBe(21) // residual: 74 − 21 − 21 − 11
    expect(result.contributions.reduce((sum, entry) => sum + entry.points, 0)).toBe(74)
    expect(result.residualError).toBe(0)
  })

  it('parses every signed point annotation in driver strings into resilience', () => {
    const result = deriveContributions(
      makeReliability({
        drivers: [
          'Savings behavior detected (+13 pts)',
          'Estimated 54 negative balance day(s) (-10 pts)',
          '1 late fee event(s) detected (-1 pts)',
        ],
      }),
    )
    expect(pointsOf(result, 'resilience')).toBe(2)
  })

  it('clamps ratio signals to their 0-25 range', () => {
    const result = deriveContributions(
      makeReliability({
        metrics: { income_regularity: 1.4, essential_payments_consistency: -0.2 } as never,
      }),
    )
    expect(pointsOf(result, 'income_regularity')).toBe(25)
    expect(pointsOf(result, 'essential_consistency')).toBe(0)
  })

  it('clamps resilience to the spec range −20…+25', () => {
    const result = deriveContributions(makeReliability({ drivers: ['Catastrophe (-99 pts)'] }))
    expect(pointsOf(result, 'resilience')).toBe(-20)
  })

  it('clamps the coverage residual to 0-25 and reports the unattributable remainder', () => {
    // zero metrics with a non-zero score: residual cannot all be coverage
    const result = deriveContributions(
      makeReliability({
        reliability_index: 80,
        metrics: { income_regularity: 0, essential_payments_consistency: 0 } as never,
        drivers: [],
      }),
    )
    expect(pointsOf(result, 'income_coverage')).toBe(25)
    expect(result.residualError).toBe(55)
  })

  it('handles a driver list with no point annotations (resilience zero)', () => {
    const result = deriveContributions(
      makeReliability({ drivers: ['Income present in 0/6 months'] }),
    )
    expect(pointsOf(result, 'resilience')).toBe(0)
  })

  it('always returns the four signals in registry order', () => {
    const result = deriveContributions(makeReliability())
    expect(result.contributions.map((entry) => entry.signalId)).toEqual([
      'income_regularity',
      'income_coverage',
      'essential_consistency',
      'resilience',
    ])
  })
})
