import { config } from '@/config'

import { ApiError } from './types'

export interface ApiFetchOptions {
  signal: AbortSignal
  query?: Record<string, string>
}

function hasErrorBody(body: unknown): body is { error: string } {
  return (
    typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
  )
}

/**
 * Typed fetch against the REST host. Every call carries an AbortSignal;
 * aborts rethrow the native AbortError (never wrapped) so TanStack Query can
 * tell cancellation from failure. The backend can put an { error } body
 * inside an HTTP 200 (docs/api/findings.md §4), so success requires both a
 * 2xx status and a non-error body.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const url = new URL(`${config.apiBaseUrl}${path}`)
  if (options.query !== undefined) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value)
    }
  }

  let response: Response
  try {
    response = await fetch(url, { signal: options.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError('network', `request to ${path} failed: ${String(error)}`)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    if (!response.ok) {
      throw new ApiError('http', `${path} responded ${response.status}`, response.status)
    }
    throw new ApiError('parse', `${path} returned a non-JSON body`)
  }

  if (!response.ok) {
    const detail = hasErrorBody(body) ? body.error : `responded ${response.status}`
    throw new ApiError('http', `${path}: ${detail}`, response.status)
  }
  if (hasErrorBody(body)) {
    throw new ApiError('api', `${path}: ${body.error}`, response.status)
  }
  return body as T // boundary cast: callers name the wire type the endpoint serves
}
