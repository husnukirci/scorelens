# Architecture Decision Records — scorelens

Each ADR: Status · Context · Decision · Consequences. Changing an Accepted ADR requires a superseding entry, not an edit. ADRs whose assumptions depend on Phase 0 verification say so explicitly.

---

## ADR-01 — Vite + React + TypeScript strict; no meta-framework

**Status:** Accepted

**Context:** Internal analyst tool, single-page, no SEO, no SSR story, public unauthenticated API. The assignment prefers React + TypeScript.

**Decision:** Vite + React (latest stable) + TypeScript with the full strict flag set (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`). No Next.js/Remix.

**Consequences:** Fastest path to a deployable SPA; no framework machinery to justify. We give up file-based routing and server rendering — neither is needed; the app has one screen with panels. If routing ever appears (per-user deep links), TanStack Router fits the existing stack. `noUncheckedIndexedAccess` is the flag that pays off here: `record[id]` is `Transaction | undefined` by construction, which is exactly the discipline out-of-order SSE data needs.

---

## ADR-02 — TanStack Query for server state, one Zustand store for client state

**Status:** Accepted

**Context:** The app has two kinds of state with opposite lifecycles: snapshots of backend truth (reliability response, transactions) and analyst choices (selected user, scoring window, filters, sort, search). Most React codebase rot comes from blending them.

**Decision:** TanStack Query owns all server state — caching, staleness, invalidation, retries, abort, dedup. One Zustand store (`uiStore`) owns client state only. Litmus test, enforced in review: *"on reload, is this value re-fetched (Query) or re-chosen by the user (Zustand)?"* There is no third bucket. Copying server data into Zustand is forbidden (CLAUDE.md §3).

Composition rule: client state is the *input* to server state — query keys are built from uiStore values (`['transactions', userId, from]`). Filters/search/sort are deliberately **not** in query keys; they are client-side derives over the cached record, so changing a filter is a synchronous re-derive, not a network round-trip.

**Consequences:** Single source of truth per kind of state; SSE reconciliation reduces to `invalidateQueries`. Cost: two state libraries — accepted because each is small, idiomatic, and doing the one job it's built for. Alternatives rejected: Zustand-only (hand-rolling cache/staleness/abort/dedup), Query-only (abusing infinite-stale queries as a UI store), Redux Toolkit + RTK Query (heavier, no benefit at this scale).

---

## ADR-03 — Transactions normalized as `Record<id, Transaction>`; order always derived

**Status:** Accepted

**Context:** The API explicitly delivers out-of-order records; SSE delivers adds/updates/deletes that may duplicate or reference unknown ids; multiple views (table, cashflow, live feed) project the same data.

**Decision:** The canonical client shape is a normalized `Record<transactionId, Transaction>` held in the Query cache. Arrays never persist; they are derived in memoized selectors, sorted by `(bookingDate, id)` at derive boundaries. Wire order carries no meaning anywhere in the codebase.

**Consequences:** Out-of-order arrival is solved *by construction* — there is no order to corrupt. Upserts/deletes are O(1) by key; one write path (REST fill + SSE events) feeds many read paths. Cost: `Object.values()` per derive — measured trivially cheap at the thousands scale and memoized anyway.

---

## ADR-04 — Fetch full dataset via cursor loop; filter/sort/search client-side

**Status:** Accepted *(pivot conditions below; Phase 0 verifies assumptions)*

**Context:** The discovery endpoint documents cursor and offset pagination — and that omitting params returns ALL transactions in one response. Datasets are "thousands". The explorer needs instant filter/search/sort response for analysts.

**Decision:** Load each user's complete transaction set through a cursor-pagination loop with an explicit `PAGE_LIMIT`, assembling into the normalized record. All filtering, merchant search, and sorting happen client-side in the memoized derive pipeline. Calling the endpoint without pagination params is forbidden — the all-at-once response is a footgun at the upper end of "thousands", and the loop gives us progress, abortability, and bounded payloads.

**Pivot conditions:** (a) Phase 0 finds server-side filter/search support → review whether hybrid fetching beats client-side; default remains client-side for instant UX at this scale, with the finding documented. (b) Phase 0 measures a largest-user dataset that makes full load unreasonable → switch the table to windowed/infinite Query fetching; normalization and virtualization survive unchanged.

**Consequences:** Zero-latency filtering; offline-tolerant exploration; one consistency domain for SSE to mutate. The 100K+ story (README discussion topic): filters move into query keys, fetching becomes windowed and server-filtered, the derive pipeline shrinks to presentation — the architecture's seams are placed exactly where that evolution cuts.

---

## ADR-05 — SSE: pure `applyEvent` reducer into the Query cache; stream is an optimization, REST is the truth

**Status:** Accepted

**Context:** Requirement H. The SSE endpoint is an AWS Lambda Function URL: stateless across reconnects, hard streaming time limits — so `Last-Event-ID` replay cannot be assumed and **gaps are normal**, not exceptional. Events may arrive duplicated, out of order, or referencing transactions the paginated fill hasn't loaded.

**Decision:** Three separated responsibilities:
1. **`applyEvent.ts`** — pure reducer `(record, event) → record`. ADDED = upsert; UPDATED = upsert (unknown id treated as ADDED — payload is complete); DELETED of unknown id = no-op returning the *same reference*. Idempotent by construction: replays are harmless, no-ops cause zero renders. Strict-TDD layer.
2. **Write path** — events land via `queryClient.setQueryData` on the transactions key. No parallel store: Query remains the single home of server truth even for streamed data (upholds ADR-02).
3. **Reconciliation** — every stream (re)connect fires `invalidateQueries(['transactions', userId])`; REST refetch restores authoritative state and the stream keeps it fresh only *between* reconciliations. Transaction mutations also trigger a **debounced invalidation of the reliability query**, keeping score and underlying data consistent.

**Consequences:** Self-healing by design; correctness never depends on delivery guarantees the transport can't make. Cost: reconnects cause a full refetch — acceptable at this scale, and precisely the knob (delta endpoints, server-supported resume) named in the scalability discussion answer.

---

## ADR-06 — Native EventSource wrapped with manual exponential backoff

**Status:** Accepted

**Context:** Default `EventSource` retry is naive and can hammer a struggling endpoint; the UI must show analysts whether data is live. The stream host differs from the REST host (CORS verified in Phase 0; fallback: Vercel rewrite proxy).

**Decision:** Native `EventSource` (no socket.io/rxjs), owned by `useTransactionStream(userId)` — one instance per selected user, closed on cleanup. On error we close and recreate under our own backoff with jitter (1s → 2s → 4s → cap 30s). Connection status (`live | reconnecting | offline`) lives in uiStore and surfaces in the UI with `aria-live="polite"`. Tab hidden → pause; visible → reconnect + reconcile (Tier 2).

**Consequences:** Predictable reconnect behavior, honest status for analysts, no dependency weight. Cost: we own ~60 lines of connection machinery — tested with a mock EventSource class.

---

## ADR-07 — API types generated from the committed OpenAPI spec

**Status:** Accepted *(spec reachability verified in Phase 0)*

**Context:** The backend publishes an OpenAPI 3.0 document. Hand-written types drift; drift in a scoring tool is a correctness bug.

**Decision:** Snapshot `openapi.yaml` into `docs/api/`; generate `src/api/types.gen.ts` via `openapi-typescript` (`make types`). Generated files are never edited — domain refinements live in `api/types.ts`. If the spec is unreachable, types are hand-written from observed responses and the gap is documented.

**Consequences:** Contract changes become a regenerate + compile-error diff — the concrete mechanism behind the "evolving API contracts" discussion answer. The committed snapshot also pins exactly which contract this build targets.

---

## ADR-08 — Environment via validated, frozen `config.ts`

**Status:** Accepted

**Context:** Two base URLs (REST, SSE) vary by deployment; someone else may run this against their own backend. Vite inlines `VITE_*` at build time into the public bundle.

**Decision:** `VITE_API_BASE_URL` and `VITE_SSE_BASE_URL`, documented in `.env.example`, set in Vercel project settings. `src/config.ts` reads, URL-validates, and freezes them at startup — missing/malformed config fails fast with a clear error. Nothing else reads `import.meta.env`. Hard rule: no secrets in `VITE_*`, ever — these URLs are public and unauthenticated; anything requiring auth would force a server component and a new ADR.

**Consequences:** Portable deployments, one config seam, no mysterious downstream fetch failures.

---

## ADR-09 — TanStack Virtual for the transaction table

**Status:** Accepted

**Context:** Requirement G: thousands of rows must stay responsive. Full DOM rendering dies around 10³ rows.

**Decision:** TanStack Virtual with fixed row height and overscan; semantic grid roles preserved on the virtualized structure (virtualization must not destroy table semantics for screen readers); `TransactionRow` is one of the three designated memoization hot paths — verified with React Profiler (single-row SSE update re-renders exactly one row).

**Consequences:** Constant DOM cost regardless of dataset size. Alternatives rejected: react-window (less flexible measurement), AG Grid/TanStack Table full kit (capability we'd mostly disable; building the column logic ourselves shows more, costs little at 6–8 columns), pagination-only (analysts scan patterns; virtual scroll fits the inspection workflow better — pagination remains the documented server-side evolution).

---

## ADR-10 — Recharts for charts

**Status:** Accepted

**Context:** Two chart surfaces (signal breakdown, monthly cashflow), neither exotic. Velocity matters; charts are not the differentiator of this submission — the data layer is.

**Decision:** Recharts. Chart `data` arrays come from memoized derives (stable references prevent spurious re-animation); colors come from CSS custom properties defined in the Tailwind theme; animations respect `prefers-reduced-motion`.

**Consequences:** Composable, fast to ship, fine at this data volume. Trade-off documented for the interview: visx/d3 buys full control and smaller bundles at the cost of build time — the right call changes if charts become the product.

---

## ADR-11 — Tailwind CSS v4 with design tokens

**Status:** Accepted

**Decision:** Tailwind v4, CSS-first config (`@theme` in `src/styles/`; no `tailwind.config.js`/`postcss.config.js`). Semantic tokens for score bands and signal colors as CSS custom properties — single definition consumed by both utility classes and Recharts (`var(--color-band-good)`). No inline styles.

**Consequences:** One source of visual truth; theming consistent across DOM and SVG. Band colors pair with text labels everywhere — color is never the only signal (a11y hard rule).

---

## ADR-12 — Domain registries own presentation meaning; backend owns scoring semantics

**Status:** Accepted

**Context:** Four scoring signals, score bands, and transaction categories are referenced by breakdown, explanation, overview, and filters. Scattered literals drift; and the backend — not the frontend — owns what a signal *means*.

**Decision:** `src/domain/` holds registries: `signals.ts` (id, label, plain-language explanation copy, color token), `scoreBands.ts` (thresholds, labels, tokens), `categories.ts`. Registries are presentation metadata **keyed by API ids**; numeric truth (values, weights, band assignment if provided) always comes from the API response. Rendering iterates the registry; **signal ids not in the registry render via a generic fallback** (label = id, neutral color) rather than crashing.

**Consequences:** Adding a scoring signal = one registry entry; copy/color/threshold can't diverge between panels; the unknown-signal fallback is the concrete answer to "how would you support adding new scoring signals over time". Boundary stated for the Data Ownership discussion: if signal metadata ever ships from the API, the registry shrinks to overrides.

---

## ADR-13 — Memoization on three designated hot paths only; React Compiler off

**Status:** Accepted

**Context:** Blanket memoization is noise that hides intent; missing memoization on hot paths is jank. The app has exactly three render-performance-critical paths.

**Decision:** Memoize only: (1) `TransactionRow` (`React.memo`, stable props from the normalized record), (2) the derive pipeline (`useMemo` on filter→search→sort, cashflow aggregation, chart data arrays), (3) the SSE write path (no-op events return the same reference → zero renders; rAF batching only if event rate measured to need it). Everything else is plain React. `useCallback` only when passed to a memoized child or in hook deps. Prevention over cure: minimal Zustand slices + `useShallow`, Query `select` projections, no inline objects to memoized components. Profiler evidence required for any addition; speculative memoization is reverted in review.

React Compiler stays off for this codebase: manual, explained memoization on identified hot paths demonstrates understanding of rendering behavior; enabling it is named as the production evolution path.

**Consequences:** Readable components, honest performance story, Profiler screenshots as evidence rather than claims.

---

## ADR-14 — Testing: strict TDD on the data core, pragmatic elsewhere, MSW at the boundary

**Status:** Accepted

**Decision:** Test-first for `applyEvent` (full event matrix incl. duplicates, unknown-id update/delete, reference stability), the cursor fetch loop, the derive functions, cashflow aggregation, `config.ts`, utils, and uiStore actions. Test-after for components (render + key interactions + DataState integration) and `useTransactionStream` (mock EventSource lifecycle). MSW mocks the REST boundary; a mock EventSource class mocks the stream; tests never hit the live API. One vitest-axe smoke test on the assembled view. Coverage thresholds: `api/` 90/85, `utils/`+`domain/` 95/90, `state/` 90/85, components none.

**Consequences:** The correctness-critical 20% of the code carries near-total coverage; component tests stay meaningful instead of ceremonial.

---

## ADR-15 — Observability: structured logging seam + ErrorBoundary; vendor-ready

**Status:** Accepted

**Context:** "If the UI becomes slow or incorrect in production, how would you debug it?" needs an artifact, not an essay.

**Decision:** `src/utils/log.ts` emits structured events — stream lifecycle (connected/disconnected/reconciled, attempt counts), fetch-loop pages + duration, derive-pipeline timing (dev-gated) — through one seam where Sentry/OpenTelemetry/web-vitals would attach (transport = console in this build; the seam is the point). Top-level ErrorBoundary renders `ErrorFallback` and logs a structured payload (route state, user/window selection, last stream status). README's incident section walks a concrete debugging path: status indicator → log timeline → Profiler method.

**Consequences:** Incident thinking is demonstrated in code; production hardening is a transport swap, not a refactor.

---

## ADR-16 — Feature-sliced structure with lint-enforced import direction

**Status:** Accepted

**Context:** Six named product capabilities over one shared dataset; reviewers should see requirements materialized in the tree; future growth (a new signal, a new view) should be additive.

**Decision:** Vertical `features/` slices (overview, score-breakdown, transactions, cashflow, explanation, live) over a horizontal data core (`api/`, `state/`), with leaf `components/`, `hooks/`, `utils/`, `domain/`. Dependency direction — features → data core → leaves; never reversed; no cross-feature imports — enforced via ESLint `import/no-restricted-paths`. Promotion rule of two for shared hooks/utils. No barrel files.

**Consequences:** The folder tree is the requirements checklist; every feature is a projection of one write path, which is why streaming updates propagate everywhere "for free" (the structural answer to requirement H). Deliberate divergence from prior art in this style of codebase: no store factories or multi-instance machinery — there is no embedding requirement here, so module-level QueryClient + one Zustand store is the simpler correct call.

---

## ADR-17 — Dual-path fetch-based SSE transport; supersedes ADR-06's EventSource choice

**Status:** Accepted *(supersedes the transport choice of ADR-06; its backoff policy, connection ownership, and status-surfacing decisions carry forward. Refines ADR-05's reconcile trigger without changing its principle.)*

**Context:** Phase 0 measured the deployed SSE endpoint (`docs/api/findings.md` §6, four independent runs): the Lambda Function URL returns the entire ~30 s scripted stream as **one buffered Lambda proxy envelope** — `Content-Type: application/octet-stream`, zero bytes until ~30 s then a single flush, the correct `text/event-stream` document trapped inside the envelope's `body` string. Explicit `Accept: text/event-stream` is ignored. Native `EventSource` hard-fails on the MIME check before any event is seen. CORS is *not* the problem (valid `Access-Control-Allow-Origin` on every probe), so ADR-06's named fallback — a Vercel rewrite proxy — fixes nothing: rewrites preserve body and buffering. Root cause is a deployment configuration (Function URL `InvokeMode: BUFFERED` instead of `RESPONSE_STREAM`), not application logic: the Express app behind it emits well-formed SSE.

**Decision:**

1. **Transport** — `api/sse/` implements the stream client on `fetch` + `ReadableStream` (budget: ~150 lines + tests), with two paths selected by the response's `Content-Type`:
   - **Streaming path:** `text/event-stream` → incremental parse, events dispatched as bytes arrive. Status: `live`.
   - **Envelope path (degraded):** anything else → buffer the body, `JSON.parse` the envelope, validate `statusCode`/inner content-type, parse `body` as SSE text, dispatch the events as one batch. Status: `delayed` — **the UI never reports `live` when delivery is batched.**
2. **One event pipeline** — both paths emit the same typed `TransactionEvent` sequence into the same pure `applyEvent` → `setQueryData` path; debounced reliability invalidation, one-connection-per-selected-user ownership in `useTransactionStream`, and tab-visibility pause/resume all carry forward from ADR-06 unchanged.
3. **Cycle vs recovery reconnects** — the server's scripted stream self-terminates (~30 s), so in the envelope path a **clean envelope completion is the normal operating loop, not a failure**: reconnect promptly (immediate or fixed short delay), **no backoff, no reconciliation** — the envelope itself carried the events. Exponential backoff with jitter (1s → 2s → 4s → cap 30s) and reconcile-on-reconnect (ADR-05) apply **only to recovery reconnects** after errors or abnormal termination (network failure, non-2xx, malformed envelope, mid-stream drop). In degraded mode a **low-frequency safety reconcile** (`invalidateQueries` at most once every `SAFETY_RECONCILE_MS`, default 5 minutes) catches drift across cycles. This refines ADR-05's reconcile *trigger* — recovery reconnects plus the periodic safety net, instead of literally every (re)connect — without changing its principle: the stream remains an optimization, REST remains the truth.
4. **Status vocabulary** — `live | delayed | reconnecting | offline` in uiStore, surfaced with `aria-live="polite"` and signaled by text, never color alone. The `delayed` indicator copy surfaces the **measured cadence** ("updates ~every 30 s", sourced from the cycle duration measured in findings §6), not a bare hardcoded "delayed" label.
5. **SSE wire parser is a pure function** (text chunks in → events out) — strict-TDD alongside `applyEvent`. The test matrix explicitly covers: `id:`/`event:`/`data:` field handling and blank-line dispatch; frame reassembly across chunk boundaries; **CRLF line endings**; **multi-`data:`-line events** (joined with `\n` per the SSE spec); **comment lines** (`: keepalive`, `: stream ended`); and **`retry:` fields, which are parsed and ignored** (reconnect timing is ours, per ADR-06's carried-forward backoff ownership).
6. **Testing amendment to ADR-14** — the mock-EventSource class is replaced by a mock fetch transport serving (a) a chunked `ReadableStream` of SSE frames and (b) a buffered envelope body; `useTransactionStream` lifecycle tests cover both paths, clean-cycle reconnect (no reconcile), and error → backoff → reconcile.
7. **Upgrade story** — the moment the backend enables `RESPONSE_STREAM`, the response presents `text/event-stream` and the transport takes the streaming path automatically: zero code change, status flips `delayed` → `live`. Reporting the misconfiguration upstream is the project lead's separate decision (diagnosis written for handoff in findings §6).

**Consequences:** We own the wire parser and envelope unwrap (~150 lines) instead of getting parsing free from `EventSource` — acceptable since ADR-06 already replaced EventSource's retry logic, and in exchange requirement H demonstrably works against today's deployment, stays honest in the UI, and self-upgrades when the backend is fixed. Clean cycles produce no redundant refetch traffic; correctness across cycles is guaranteed by the safety reconcile rather than per-reconnect refetches. ADR-05's principle is untouched: gaps remain normal, `Last-Event-ID` remains unused, REST remains the truth.

---

## End of decisions.md