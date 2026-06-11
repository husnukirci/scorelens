/**
 * Structured logging seam (ADR-15). Every observable event in the app flows
 * through here — stream lifecycle, fetch-loop timing, boundary errors — so
 * production hardening (Sentry/OpenTelemetry/web-vitals) is a transport swap
 * in this one file, not a refactor. Transport today: the console.
 */

export type LogLevel = 'info' | 'warn' | 'error'

/* eslint-disable no-console -- this module IS the sanctioned console transport */
export function logEvent(
  event: string,
  payload: Record<string, unknown> = {},
  level: LogLevel = 'info',
): void {
  // info is dev-only noise; warnings and errors always surface
  if (level === 'info' && !import.meta.env.DEV) return
  const entry = { event, ...payload }
  if (level === 'error') console.error('[scorelens]', entry)
  else if (level === 'warn') console.warn('[scorelens]', entry)
  else console.info('[scorelens]', entry)
}
/* eslint-enable no-console */
