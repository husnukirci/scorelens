import type { ReactElement } from 'react'

import { cn } from '@/utils/cn'

export type BadgeTone = 'low' | 'medium' | 'high' | 'neutral'

/* Static class map: Tailwind extracts classes statically, so tones are a
 * closed set and unknown registry tokens map to neutral upstream. */
const TONE_CLASSES: Record<BadgeTone, string> = {
  low: 'bg-band-low/15 text-band-low',
  medium: 'bg-band-medium/15 text-band-medium',
  high: 'bg-band-high/15 text-band-high',
  neutral: 'bg-ink/10 text-ink-muted',
}

export function Badge({ label, tone }: { label: string; tone: BadgeTone }): ReactElement {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-3 py-1 text-sm font-semibold',
        TONE_CLASSES[tone],
      )}
    >
      {label}
    </span>
  )
}
