import { http, HttpResponse } from 'msw'
import type { RequestHandler } from 'msw'

import type { DiscoveryResponse } from '@/api/types'

// Tests never hit the live API (CLAUDE.md §7); unhandled requests are errors.
// Endpoint-specific handlers are added per test with server.use().
export const discoveryFixture: DiscoveryResponse = {
  name: 'Credit Builder API',
  version: '1.0.0',
  available_users: ['user_1001', 'user_1002', 'user_1003'],
  data_range: { from: '2025-09-01', to: '2027-06-30' },
}

export const handlers: RequestHandler[] = [
  http.get('http://localhost:3001/', () => HttpResponse.json(discoveryFixture)),
]
