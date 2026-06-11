import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { ReactElement } from 'react'
import {
  Bar,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { SCORING_WINDOW_MONTHS, transactionsQueryOptions } from '@/api/queries'
import { Card } from '@/components/Card'
import { DataState } from '@/components/DataState'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { queryErrorMessage, toDataStateStatus } from '@/utils/asyncStatus'
import { subtractCalendarMonths } from '@/utils/dates'
import { formatMoney } from '@/utils/formatMoney'

import { aggregateMonthly } from './aggregateMonthly'

function formatTooltip(value: unknown): string {
  return typeof value === 'number' ? formatMoney(value, 'EUR') : String(value)
}

export function CashflowPanel({
  userId,
  windowFrom,
}: {
  userId: string
  windowFrom: string
}): ReactElement {
  const transactions = useQuery(transactionsQueryOptions(userId, windowFrom))
  const reducedMotion = useReducedMotion()
  // hot path #2: a stable data reference keeps recharts from re-animating;
  // the same normalized record feeds the explorer, so SSE updates flow in free
  const months = useMemo(
    () =>
      aggregateMonthly(transactions.data ?? {}, {
        from: subtractCalendarMonths(windowFrom, SCORING_WINDOW_MONTHS),
        to: windowFrom,
      }),
    [transactions.data, windowFrom],
  )

  return (
    <Card title="Cashflow timeline">
      <DataState
        status={toDataStateStatus(transactions)}
        errorMessage={queryErrorMessage(transactions)}
        onRetry={() => void transactions.refetch()}
      >
        <div className="h-64" data-testid="cashflow-chart">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 600, height: 256 }}
          >
            <ComposedChart data={months} margin={{ left: 16, right: 16 }}>
              <XAxis dataKey="month" />
              <YAxis width={70} />
              <Tooltip formatter={formatTooltip} />
              <Legend />
              <ReferenceLine y={0} stroke="var(--color-ink-muted)" />
              <Bar
                dataKey="income"
                name="Income"
                fill="var(--color-flow-positive)"
                isAnimationActive={!reducedMotion}
                radius={2}
              />
              <Bar
                dataKey="expenses"
                name="Expenses"
                fill="var(--color-flow-negative)"
                isAnimationActive={!reducedMotion}
                radius={2}
              />
              <Line
                dataKey="net"
                name="Net"
                stroke="var(--color-ink)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={!reducedMotion}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Monthly totals over the 6-month scoring window; live transaction updates flow into the
          chart through the same data as the explorer.
        </p>
      </DataState>
    </Card>
  )
}
