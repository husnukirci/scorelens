import { useMemo } from 'react'
import type { ReactElement } from 'react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'

import { signalMeta } from '@/domain/signals'

import type { SignalContribution } from './deriveContributions'
import { useReducedMotion } from './useReducedMotion'

interface ChartRow {
  label: string
  points: number
  colorToken: string
}

/**
 * Presentational chart over derived contributions. Rendering iterates the
 * data and resolves presentation through the registry, so a contribution
 * with an unknown signal id renders with its raw id and the neutral color
 * (ADR-12) instead of crashing.
 */
export function BreakdownChart({
  contributions,
}: {
  contributions: SignalContribution[]
}): ReactElement {
  const reducedMotion = useReducedMotion()
  // hot path #2 discipline: a stable data reference prevents re-animation
  const rows = useMemo<ChartRow[]>(
    () =>
      contributions.map((contribution) => {
        const meta = signalMeta(contribution.signalId)
        return { label: meta.label, points: contribution.points, colorToken: meta.colorToken }
      }),
    [contributions],
  )

  return (
    <div className="h-56" data-testid="breakdown-chart">
      <ResponsiveContainer
        width="100%"
        height="100%"
        // pre-measure size: lets the chart paint immediately (and render at
        // all under test DOMs whose ResizeObserver never fires)
        initialDimension={{ width: 600, height: 224 }}
      >
        <BarChart data={rows} layout="vertical" margin={{ left: 24, right: 16 }}>
          <XAxis type="number" domain={[-20, 25]} tickCount={10} />
          <YAxis type="category" dataKey="label" width={150} tickLine={false} />
          <ReferenceLine x={0} stroke="var(--color-ink-muted)" />
          <Bar dataKey="points" isAnimationActive={!reducedMotion} radius={2}>
            {rows.map((row) => (
              <Cell key={row.label} fill={`var(--color-${row.colorToken})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
