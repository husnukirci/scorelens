import type { RequestHandler } from 'msw'

// Populated per data-core feature in Phase 2 (reliability, transactions).
// Tests never hit the live API (CLAUDE.md §7); unhandled requests are errors.
export const handlers: RequestHandler[] = []
