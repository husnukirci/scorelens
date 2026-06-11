import { SIGNALS, signalMeta } from './signals'

describe('signals registry', () => {
  it('defines complete presentation metadata for the four scoring signals', () => {
    const ids = SIGNALS.map((signal) => signal.id)
    expect(ids).toEqual([
      'income_regularity',
      'income_coverage',
      'essential_consistency',
      'resilience',
    ])
    for (const signal of SIGNALS) {
      expect(signal.label.length).toBeGreaterThan(0)
      expect(signal.explanation.length).toBeGreaterThan(0)
      expect(signal.colorToken.length).toBeGreaterThan(0)
      expect(signal.maxPoints).toBeGreaterThan(0)
    }
  })

  it('renders an unknown signal id through the fallback path (ADR-12)', () => {
    const meta = signalMeta('brand_new_signal')
    expect(meta.label).toBe('brand_new_signal')
    expect(meta.colorToken).toBe('ink-muted')
    expect(meta.explanation).toBe('')
  })

  it('resilience is the only signal that can subtract points', () => {
    const resilience = SIGNALS.find((signal) => signal.id === 'resilience')
    expect(resilience?.minPoints).toBe(-20)
    for (const signal of SIGNALS.filter((entry) => entry.id !== 'resilience')) {
      expect(signal.minPoints).toBe(0)
    }
  })
})
