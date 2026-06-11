import { bandMeta, SCORE_BANDS } from './scoreBands'

describe('score bands registry', () => {
  it('maps the three api bands to presentation metadata', () => {
    expect(bandMeta('LOW').label).toBe('Low reliability')
    expect(bandMeta('MEDIUM').label).toBe('Medium reliability')
    expect(bandMeta('HIGH').label).toBe('High reliability')
  })

  it('covers the full 0-100 range with spec thresholds', () => {
    expect(SCORE_BANDS.map((band) => [band.min, band.max])).toEqual([
      [0, 49],
      [50, 74],
      [75, 100],
    ])
  })

  it('renders an unknown band id through the neutral fallback instead of crashing', () => {
    const meta = bandMeta('EXCEPTIONAL')
    expect(meta.label).toBe('EXCEPTIONAL')
    expect(meta.colorToken).toBe('ink-muted')
  })
})
