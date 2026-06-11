import type { ReliabilityResponse } from '@/api/types'

export interface SignalContribution {
  signalId: string
  points: number
}

export interface DerivedContributions {
  contributions: SignalContribution[]
  /** Points the heuristic could not attribute to any signal (0 when exact). */
  residualError: number
}

/** Sum of every "(±N pts)" annotation the backend embeds in driver strings. */
function parseDriverPoints(drivers: string[]): number {
  let total = 0
  for (const driver of drivers) {
    for (const match of driver.matchAll(/\(([+-]\d+) pts?\)/g)) {
      total += Number(match[1])
    }
  }
  return total
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Derives per-signal point contributions from the reliability response.
 * The API reports raw metrics and prose drivers but no structured per-signal
 * points (findings §3), so this tool estimates them — and the UI says so:
 * regularity and consistency from their ratios × 25 (the spec's ranges),
 * resilience from the signed annotations the backend embeds in drivers, and
 * coverage as the residual so contributions sum to the reported score.
 * Anything the heuristic cannot attribute is surfaced as residualError,
 * never silently absorbed.
 */
export function deriveContributions(reliability: ReliabilityResponse): DerivedContributions {
  const regularity = clamp(Math.round(reliability.metrics.income_regularity * 25), 0, 25)
  const consistency = clamp(
    Math.round(reliability.metrics.essential_payments_consistency * 25),
    0,
    25,
  )
  const resilience = clamp(parseDriverPoints(reliability.drivers), -20, 25)
  const residual = reliability.reliability_index - regularity - consistency - resilience
  const coverage = clamp(residual, 0, 25)

  return {
    contributions: [
      { signalId: 'income_regularity', points: regularity },
      { signalId: 'income_coverage', points: coverage },
      { signalId: 'essential_consistency', points: consistency },
      { signalId: 'resilience', points: resilience },
    ],
    residualError: residual - coverage,
  }
}
