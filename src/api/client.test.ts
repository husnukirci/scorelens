import { delay, http, HttpResponse } from 'msw'

import { apiFetch } from '@/api/client'
import { ApiError } from '@/api/types'

import { server } from '../test/server'

const base = 'http://localhost:3001'

async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw new Error(`expected ApiError, got ${String(error)}`)
  }
  throw new Error('expected promise to reject')
}

describe('apiFetch', () => {
  it('returns the parsed body for a 200 response', async () => {
    server.use(http.get(`${base}/health`, () => HttpResponse.json({ status: 'ok' })))
    await expect(
      apiFetch<{ status: string }>('/health', { signal: new AbortController().signal }),
    ).resolves.toEqual({ status: 'ok' })
  })

  it('serializes query params onto the request url', async () => {
    let seen: string | null = null
    server.use(
      http.get(`${base}/api/users/user_1/transactions`, ({ request }) => {
        seen = new URL(request.url).search
        return HttpResponse.json({ transactions: [] })
      }),
    )
    await apiFetch('/api/users/user_1/transactions', {
      signal: new AbortController().signal,
      query: { from: '2025-09-01', to: '2026-06-11', page: '1', limit: '200' },
    })
    expect(seen).toBe('?from=2025-09-01&to=2026-06-11&page=1&limit=200')
  })

  it('maps an error body inside an http 200 to an api error (invalid-cursor case)', async () => {
    server.use(
      http.get(`${base}/boom`, () => HttpResponse.json({ error: 'Invalid cursor format' })),
    )
    const error = await expectApiError(apiFetch('/boom', { signal: new AbortController().signal }))
    expect(error.kind).toBe('api')
    expect(error.message).toContain('Invalid cursor format')
  })

  it('maps a non-2xx with json error body to an http error carrying status and message', async () => {
    server.use(
      http.get(`${base}/missing`, () =>
        HttpResponse.json({ error: 'User user_9999 not found' }, { status: 404 }),
      ),
    )
    const error = await expectApiError(
      apiFetch('/missing', { signal: new AbortController().signal }),
    )
    expect(error.kind).toBe('http')
    expect(error.status).toBe(404)
    expect(error.message).toContain('User user_9999 not found')
  })

  it('maps a non-2xx without a json body to an http error with the status text', async () => {
    server.use(
      http.get(`${base}/down`, () => new HttpResponse('Service Unavailable', { status: 503 })),
    )
    const error = await expectApiError(apiFetch('/down', { signal: new AbortController().signal }))
    expect(error.kind).toBe('http')
    expect(error.status).toBe(503)
  })

  it('maps a rejected fetch to a network error', async () => {
    server.use(http.get(`${base}/offline`, () => HttpResponse.error()))
    const error = await expectApiError(
      apiFetch('/offline', { signal: new AbortController().signal }),
    )
    expect(error.kind).toBe('network')
  })

  it('maps a 200 with a non-json body to a parse error', async () => {
    server.use(http.get(`${base}/garbled`, () => new HttpResponse('<html>not json</html>')))
    const error = await expectApiError(
      apiFetch('/garbled', { signal: new AbortController().signal }),
    )
    expect(error.kind).toBe('parse')
  })

  it('rethrows abort as the native AbortError so callers can distinguish cancellation', async () => {
    server.use(
      http.get(`${base}/slow`, async () => {
        await delay(5_000)
        return HttpResponse.json({})
      }),
    )
    const controller = new AbortController()
    const pending = apiFetch('/slow', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
