/**
 * Signal registry (ADR-12): presentation metadata for the four scoring
 * components documented in the API spec. The backend owns scoring semantics;
 * labels, plain-language copy, and colors live here so breakdown, overview,
 * and explanation can never drift apart. Adding a signal = one entry; ids
 * not in the registry render through the neutral fallback, never crash.
 */

export interface SignalMeta {
  id: string
  label: string
  /** Plain-language sentence a non-technical reader understands. */
  explanation: string
  colorToken: string
  minPoints: number
  maxPoints: number
}

export const SIGNALS: readonly SignalMeta[] = [
  {
    id: 'income_regularity',
    label: 'Income regularity',
    explanation: 'How consistently income arrived each month of the scoring window.',
    colorToken: 'signal-income-regularity',
    minPoints: 0,
    maxPoints: 25,
  },
  {
    id: 'income_coverage',
    label: 'Income coverage',
    explanation: 'Whether income comfortably covered essential expenses like rent and utilities.',
    colorToken: 'signal-income-coverage',
    minPoints: 0,
    maxPoints: 25,
  },
  {
    id: 'essential_consistency',
    label: 'Essential payments',
    explanation: 'Whether essential bills were paid regularly, month after month.',
    colorToken: 'signal-essential-consistency',
    minPoints: 0,
    maxPoints: 25,
  },
  {
    id: 'resilience',
    label: 'Resilience',
    explanation:
      'Savings behavior adds points; negative balance days, late fees, and risky spending subtract them.',
    colorToken: 'signal-resilience',
    minPoints: -20,
    maxPoints: 25,
  },
]

const SIGNAL_BY_ID: ReadonlyMap<string, SignalMeta> = new Map(
  SIGNALS.map((signal) => [signal.id, signal]),
)

export function signalMeta(signalId: string): SignalMeta {
  return (
    SIGNAL_BY_ID.get(signalId) ?? {
      id: signalId,
      label: signalId,
      explanation: '',
      colorToken: 'ink-muted',
      minPoints: 0,
      maxPoints: 25,
    }
  )
}
