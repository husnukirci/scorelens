import { CATEGORIES, categoryLabel } from './categories'

describe('categories registry', () => {
  it('labels every merchant category code observed in live data', () => {
    // the 14 MCCs measured in docs/api/findings.md §7
    const observed = [
      '4111',
      '4900',
      '5411',
      '5691',
      '5812',
      '6012',
      '6300',
      '6513',
      '6540',
      '7832',
      '7995',
      '8011',
      '9001',
      '9002',
    ]
    for (const mcc of observed) {
      expect(categoryLabel(mcc), `label for ${mcc}`).not.toBe(mcc)
    }
  })

  it('falls back to the raw code for unknown categories instead of crashing (ADR-12)', () => {
    expect(categoryLabel('9999')).toBe('9999')
  })

  it('has no duplicate codes in the registry', () => {
    const codes = CATEGORIES.map((category) => category.mcc)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
