import type { ReactElement, ReactNode } from 'react'

import { cn } from '@/utils/cn'

interface CardProps {
  title?: string
  className?: string
  children: ReactNode
}

export function Card({ title, className, children }: CardProps): ReactElement {
  return (
    <section className={cn('rounded-lg border border-ink/10 bg-surface-raised p-4', className)}>
      {title !== undefined && (
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
