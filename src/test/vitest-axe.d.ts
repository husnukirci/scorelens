import 'vitest'

import type { AxeMatchers } from 'vitest-axe/matchers'

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars -- declaration merging requires the exact generic shape
  interface Assertion<T = unknown> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging requires the empty extension shape
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
