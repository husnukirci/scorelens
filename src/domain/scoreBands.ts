/**
 * Score band registry (ADR-12): presentation metadata keyed by the API's
 * score_band. The backend assigns the band; this maps it to label and color.
 * Bands always pair color with text — color is never the only signal.
 * Unknown band ids render through the neutral fallback, never crash.
 */

export interface BandMeta {
  id: string
  label: string
  min: number
  max: number
  /** Theme token suffix consumed as bg-/text- classes and var(--color-…). */
  colorToken: string
}

export const SCORE_BANDS: readonly BandMeta[] = [
  { id: 'LOW', label: 'Low reliability', min: 0, max: 49, colorToken: 'band-low' },
  { id: 'MEDIUM', label: 'Medium reliability', min: 50, max: 74, colorToken: 'band-medium' },
  { id: 'HIGH', label: 'High reliability', min: 75, max: 100, colorToken: 'band-high' },
]

const BAND_BY_ID: ReadonlyMap<string, BandMeta> = new Map(
  SCORE_BANDS.map((band) => [band.id, band]),
)

export function bandMeta(bandId: string): BandMeta {
  return (
    BAND_BY_ID.get(bandId) ?? {
      id: bandId,
      label: bandId,
      min: 0,
      max: 100,
      colorToken: 'ink-muted',
    }
  )
}
