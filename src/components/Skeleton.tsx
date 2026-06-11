import type { ReactElement } from 'react'

import { cn } from '@/utils/cn'

export function Skeleton({ className }: { className?: string }): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-ink/10', className ?? 'h-4 w-full')}
    />
  )
}
