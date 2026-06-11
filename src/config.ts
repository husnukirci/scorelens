/**
 * Validated, frozen runtime configuration (ADR-08).
 * The only module that reads `import.meta.env`; everything else imports `config`.
 * Both URLs are public and unauthenticated — secrets never enter VITE_* vars.
 */

export interface AppConfig {
  readonly apiBaseUrl: string
  readonly sseBaseUrl: string
}

function readBaseUrl(env: Record<string, unknown>, name: string): string {
  const value = env[name]
  if (typeof value !== 'string' || value === '') {
    throw new Error(
      `scorelens config: ${name} is missing. Copy .env.example to .env and set it to the backend base URL.`,
    )
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`scorelens config: ${name} is not a valid URL (got "${value}").`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `scorelens config: ${name} must be an http(s) URL (got protocol "${parsed.protocol}").`,
    )
  }
  return value.replace(/\/+$/, '')
}

export function parseConfig(env: Record<string, unknown>): AppConfig {
  return Object.freeze({
    apiBaseUrl: readBaseUrl(env, 'VITE_API_BASE_URL'),
    sseBaseUrl: readBaseUrl(env, 'VITE_SSE_BASE_URL'),
  })
}

export const config: AppConfig = parseConfig(import.meta.env)
