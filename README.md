# scorelens

Explainable reliability scoring for risk analysts. scorelens visualizes a Reliability
Index (0–100) computed from bank transaction data — score overview, signal breakdown,
transaction explorer, cashflow timeline, plain-language explanations, and a live
transaction stream — so analysts can understand how a score was computed, inspect the
underlying transactions, and validate that the scoring system behaves correctly.

> Scaffold stage: the data core and features land in subsequent phases. This README
> grows with them.

## Getting started

Requires Node 22+.

```sh
make install   # dependencies + git hooks
cp .env.example .env
make dev       # dev server
```

## Development

| Action                                      | Command      |
| ------------------------------------------- | ------------ |
| Local gates (typecheck + lint + tests)      | `make test`  |
| Production build                            | `make build` |
| Regenerate API types from the spec snapshot | `make types` |
| All targets                                 | `make help`  |

## Configuration

Two environment variables, validated and frozen at startup by `src/config.ts`
(the app fails fast with a clear error if either is missing or malformed):

| Variable            | Purpose                           |
| ------------------- | --------------------------------- |
| `VITE_API_BASE_URL` | REST API base URL                 |
| `VITE_SSE_BASE_URL` | Transaction event stream base URL |

Both are public, unauthenticated endpoints. Never put secrets in `VITE_*` vars —
Vite inlines them into the public bundle.

## Observability

Every observable event flows through one seam — `src/utils/log.ts` (ADR-15). Production
hardening (Sentry, OpenTelemetry, web-vitals) is a transport swap in that file, not a
refactor. What it emits today, to the console:

| Event                            | Payload                                                               | When                                          |
| -------------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| `transactions.fill`              | userId, pages, total, durationMs                                      | every paginated fill completes                |
| `stream.connected`               | userId, path (`streaming`/`envelope`), recovering                     | each stream connection                        |
| `stream.cycle`                   | userId, delivered                                                     | clean productive cycle ends                   |
| `stream.suspect-cycle` (warn)    | userId, failedAttempts                                                | fast-empty cycle routed through backoff       |
| `stream.error` (warn)            | userId, failedAttempts, message                                       | connection failure before backoff             |
| `stream.reconciled`              | userId, reason (`recovery` / `safety-interval` / `visibility-resume`) | every REST reconcile, with why                |
| `stream.closed`                  | userId                                                                | connection ownership released                 |
| `app.error` (error)              | message, componentStack, selectedUserId, windowFrom, streamStatus     | ErrorBoundary catch — the incident payload    |
| `profiler.row-render` (dev only) | transaction id                                                        | render-count instrument for the one-row claim |

**Incident walkthrough** — "the UI looks wrong or slow in production":

1. **Status indicator** (header): is the stream `live`, `delayed`, `reconnecting`, or `offline`?
   That immediately splits data-freshness incidents from rendering incidents.
2. **Log timeline**: the `stream.*` sequence shows exactly when connections cycled, failed,
   and reconciled — and `transactions.fill` shows whether REST refetches are slow or failing.
3. **Render behavior**: `profiler.row-render` (dev) counts exactly which rows re-render;
   a misbehaving memo or derive shows up as row spam. The React Profiler confirms.
4. ErrorBoundary crashes arrive as one structured `app.error` payload carrying the client
   state a responder needs first: which user/window was on screen and what the stream was doing.

## Documentation

- [`docs/decisions.md`](docs/decisions.md) — architecture decision records
- [`docs/api/findings.md`](docs/api/findings.md) — live API verification evidence
- [`docs/api/openapi.yaml`](docs/api/openapi.yaml) — committed API spec snapshot
