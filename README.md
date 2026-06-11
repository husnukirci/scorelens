# scorelens

**Live: _deployment pending — see [Deployment](#deployment)_**

Explainable reliability scoring for risk analysts. scorelens visualizes a Reliability
Index (0–100) computed from bank transaction data — score overview, signal breakdown,
transaction explorer, cashflow timeline, plain-language explanations, and a live
transaction stream — so analysts can understand how a score was computed, inspect the
underlying transactions, and validate that the scoring system behaves correctly.

![The assembled app against the live API](docs/assets/feature-complete.png)

## What it does

- **Reliability overview** — score, band (color always paired with text), scoring
  window, key metrics
- **Score breakdown** — the four scoring signals as point contributions toward the
  final score, derived transparently from reported metrics ([why "derived"](#assumptions-trade-offs-limitations))
- **Why this score?** — the backend's drivers split into strengths, risks, and
  observations, plus plain-language copy explaining each signal
- **Transaction explorer** — virtualized grid over the full windowed dataset:
  category/direction filters, debounced merchant search, keyboard-sortable columns
- **Cashflow timeline** — monthly income/expense bars and net line over the same data
- **Live updates** — the stream feeds every panel through one normalized record; an
  honest status indicator (`live | delayed | reconnecting | offline`) and an activity
  feed of applied events
- **Resilience** — every panel renders loading/empty/error through one shared
  component; offline shows recoverable errors and self-heals on reconnection

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

## Architecture

Feature slices over a shared data core, with lint-enforced import direction. The load
is a sequential paginated fill into a normalized `Record<id, Transaction>` in the
TanStack Query cache; the stream applies events to the same record through a pure,
idempotent reducer — which is why live updates reach the explorer, the chart, and the
score with no per-feature wiring. The stream is an optimization; REST is the truth.

Diagrams and the full data-flow story: [docs/architecture.md](docs/architecture.md).
Every locked decision has an ADR: [docs/decisions.md](docs/decisions.md). The backend
was probed before any code was written: [docs/api/findings.md](docs/api/findings.md).

## Testing

Strict TDD on the correctness-critical core — the event reducer (18-case matrix:
duplicates, out-of-order, unknown-id update/delete, reference stability), the SSE wire
parser (CRLF, multi-`data:`, chunk reassembly), the pagination loop, the derive
pipeline, monthly aggregation, config validation, store actions — pragmatic
test-after for components. MSW at the network boundary and a mock fetch-stream for the
transport; tests never touch the live API. One axe smoke test guards the assembled view.

183 tests; enforced coverage thresholds: `api/` 90/85, `utils/` + `domain/` 95/90,
`state/` 90/85 (lines/branches).

## Performance

- Largest live dataset: **631 transactions** (full range) / ~174 in a scoring window.
  The architecture is engineered well past that: a dev-only stress mode pushes
  **25,000 synthetic rows** through the production pipeline — constant ~23 row DOM,
  11.2ms average frame under worst-case scroll
  ([evidence](docs/assets/explorer-stress-25k.png))
- Single-row stream updates re-render exactly the affected rows — measured zero
  re-renders across 174 unaffected rows during a live cycle
  ([evidence](docs/assets/explorer-live.png))
- Memoization only on three designated hot paths (row, derive pipeline, SSE write
  path); everything else is plain React. Lighthouse on the production build:
  Accessibility 100, Best Practices 100, SEO 100 ([report](docs/assets/lighthouse/report.html))

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

## Assumptions, trade-offs, limitations

- **The stream endpoint is buffered as deployed.** The Lambda Function URL returns each
  ~30s event cycle as one JSON envelope instead of incremental SSE (measured:
  [findings §6](docs/api/findings.md)). The transport handles both shapes; today it
  runs degraded and the UI says so — `Live (delayed) — updates ~every 30s`. The moment
  the backend enables response streaming, real-time works with zero code change (ADR-17).
- **Signal contributions are derived, and the UI says so.** The API reports raw metrics
  and prose drivers, not per-signal points. The derivation is exact for all observed
  live data (sum equals the reported score), parses resilience from the backend's own
  "(±N pts)" annotations, and surfaces anything unattributable as visible text. It is
  coupled to the driver-string format; if that format changes, resilience degrades to
  zero and the residual note appears — graceful, not silent.
- **Stream payload field integrity is delegated to the backend contract** — events are
  validated for shape (id presence, typed discriminants), not field-by-field.
- **Zero-amount transactions** match neither direction filter ("Money in"/"Money out");
  none exist in live data.
- **First-load status reads `Offline`** for up to ~30s while the first buffered cycle
  is in flight — the status vocabulary has no `connecting` state (a deliberate
  four-state design; adding a fifth is the named follow-up).
- **Reconnects refetch the full window** rather than a delta — acceptable at hundreds
  of rows; delta endpoints or server-supported resume are the scaling knob (ADR-05).
- **Future-dated data is normal** — the dataset runs to 2027-06; no date logic assumes
  `date <= today`.

## Discussion

> Written answers to the seven architecture topics, each linking to the decision record
> and code that evidence it. _(Being drafted; the evidence trail per topic:)_

1. **API design & evolution** — generated types from the committed spec snapshot
   (ADR-07, `make types`); registries with unknown-id fallbacks (ADR-12)
2. **Data ownership & boundaries** — backend owns scoring semantics, frontend owns
   presentation (ADR-12); the BFF-over-upstream shape observed in
   [findings §1](docs/api/findings.md)
3. **Data consistency & correctness** — normalized record + derived order (ADR-03),
   idempotent `applyEvent`, reconcile triggers (ADR-05/17)
4. **Scalability (100K+)** — what changes (server-side filtering, windowed fetch,
   filters into query keys) vs. what survives (normalization, virtualization, derive
   discipline) — ADR-04's pivot section
5. **Real-time updates** — "the stream is an optimization, REST is the truth";
   cycle-vs-recovery semantics; honest status (ADR-05/06/17)
6. **Caching & performance** — query staleness/invalidation map: what invalidates what
   and why (ADR-02; debounced score invalidation in ADR-05)
7. **Incident thinking** — the [Observability](#observability) section is the artifact
   (ADR-15)

## Deployment

Static Vite SPA, deployable on Vercel:

- Framework preset: **Vite** (build `npm run build`, output `dist/`)
- Environment variables: `VITE_API_BASE_URL`, `VITE_SSE_BASE_URL` (values in
  `.env.example`)
- No rewrites needed (single page, no router)

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — component/data-flow and stream
  lifecycle diagrams
- [`docs/decisions.md`](docs/decisions.md) — architecture decision records
- [`docs/api/findings.md`](docs/api/findings.md) — live API verification evidence
- [`docs/api/openapi.yaml`](docs/api/openapi.yaml) — committed API spec snapshot
- [`docs/ai-workflow.md`](docs/ai-workflow.md) — how AI assistance was used to build
  this project
