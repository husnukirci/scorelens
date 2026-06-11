# PLAN.md — scorelens build plan

**scorelens** — explainable reliability scoring for risk analysts. Internal tool visualizing a Reliability Index (0–100) computed from bank transaction data: score overview, signal breakdown, transaction explorer, cashflow timeline, plain-language explanations, live transaction stream.

Phases run in order; each ends with green gates and a self-review. Features come first, polish and documentation phases come last — feature-complete means end of Phase 6, and nothing in Phases 7–10 adds new features.

---

## 1. Tiers

- **Tier 1** — required. The submission is incomplete without it. Maps to assignment requirements A–H.
- **Tier 2** — high-leverage polish. Built only when the phase's Tier 1 is done and gates are green.
- **Tier 3** — nice-to-have. Built only if the schedule has slack once Phases 7–8 are underway. Cutting Tier 3 is the plan working, not failing.

When time is tight, cut from the top of Tier 3 downward — never from Tier 1.

---

## 2. Repository structure (locked)

```
scorelens/
├── CLAUDE.md  PLAN.md  README.md  Makefile  .env.example
├── docs/
│   ├── decisions.md        # ADRs
│   ├── architecture.md     # Mermaid: component architecture, data flow, SSE lifecycle
│   ├── ai-workflow.md      # AI usage disclosure (first-class deliverable)
│   └── api/openapi.yaml    # committed spec snapshot
├── src/
│   ├── app/                # App.tsx (shell, providers, ErrorBoundary), main.tsx
│   ├── config.ts           # validated, frozen env
│   ├── api/                # data core: client, types.gen.ts, types.ts, queries.ts,
│   │   └── sse/            #   transactions.ts (cursor loop); eventSource.ts, applyEvent.ts
│   ├── state/uiStore.ts    # Zustand: user, window, filters, sort, search, stream status
│   ├── domain/             # signals.ts, scoreBands.ts, categories.ts
│   ├── features/
│   │   ├── overview/  score-breakdown/  transactions/  cashflow/  explanation/  live/
│   ├── components/         # DataState, Card, Badge, Skeleton, ErrorFallback
│   ├── hooks/              # shared hooks (rule of two)
│   ├── utils/              # formatMoney, dates, cn, log.ts
│   ├── styles/             # Tailwind v4 @theme tokens
│   └── test/               # factories, MSW handlers, mock EventSource, setup
└── .github/workflows/ci.yml
```

---

## 3. Phases

### Phase 0 — API verification

Probe before building. Everything in this phase produces committed evidence in `docs/api/`.

Tasks: `curl` discovery root and `openapi.yaml` (commit snapshot); generate `types.gen.ts` via openapi-typescript; fetch reliability + transactions for 2–3 users; measure largest user's transaction count; test cursor and offset pagination; `curl -N` the SSE endpoint and observe live events; verify SSE CORS headers for browser use; check whether the API supports server-side filtering/search/sort.

**Exit criteria (all answered in writing in `docs/api/findings.md`):**
1. openapi.yaml reachable? → if not: hand-write types from observed responses, note it.
2. SSE browser-CORS compatible? → if not: Vercel rewrite proxy (documented).
3. Server-side filter/search supported? → if yes: ADR-04 pivot review with user before Phase 2.
4. Largest dataset size measured → calibrates `PAGE_LIMIT` and virtualization claims.
5. Payload shapes match assignment description? Anomalies noted (future-dated transactions expected — data range runs to 2027-06-30).

**STOP: review findings with user before proceeding if any answer contradicts an ADR.**

### Phase 1 — Scaffold

Vite + React + TS strict; Tailwind v4; ESLint (incl. import-direction rule) + Prettier + husky + lint-staged + commitlint; vitest + happy-dom + MSW + factories skeleton; Makefile; `config.ts` with validation + tests; `.env.example`; CI workflow (gates + build); README stub.

**Exit:** `make test` and `make build` green in CI on a PR.

### Phase 2 — Data core — TDD, adversarial review

Typed fetch client (AbortController, `ApiError` mapping) → cursor-pagination loop → normalized `Record` + Query integration (`queries.ts`, keys from client state) → **`applyEvent` reducer with the full event matrix (tests first)** → `eventSource.ts` (backoff, status) → `useTransactionStream` (setQueryData, reconcile-on-reconnect, debounced reliability invalidation, cleanup).

**Exit:** full event matrix green; mock-EventSource lifecycle tests green; coverage thresholds met; a throwaway dev page shows live data flowing end-to-end against the real API.

### Phase 3 — App shell

Layout shell; user picker + scoring-window picker (uiStore-backed, in persistent header); `DataState` component (loading skeleton / empty / error with retry); ErrorBoundary with structured payload; `log.ts` structured dev logging (stream lifecycle, fetch-loop pages+duration).

**Exit:** switching users/windows refetches correctly; kill the network in devtools → sane error states everywhere.

### Phase 4 — Transaction Explorer — adversarial review

Requirements C + G. Virtualized table (TanStack Virtual, grid semantics preserved); `useVisibleTransactions` derive (TDD on the pure function); filters (category, positive/negative), merchant search (debounced), column sort; `TransactionRow` memo + Profiler verification; empty-filter-result state.

Tier 2: URL-synced filter state (shareable analyst views); result count + active-filter chips.
Tier 3: column visibility; CSV export of current view.

**Exit:** largest user scrolls at 60fps; single-row SSE update re-renders one row (Profiler screenshot saved for README); filters respond instantly.

### Phase 5 — Overview, Breakdown, Explanation

Requirements A + B + E, driven by the `domain/` registries. Overview: score, band badge (color+text), window, key metrics. Breakdown: four signals as weighted contributions toward the final score (Recharts), registry-driven, unknown-signal fallback path tested. Explanation panel: positive vs. risk drivers in plain language, copy from `signals.ts`.

Tier 2: contribution tooltips with per-signal detail; window-change score comparison hint.

**Exit:** a non-technical reader can answer "why is this score 61?" from the screen alone.

### Phase 6 — Cashflow timeline

Requirement D. Monthly aggregation (TDD on the pure aggregation) → income/expense bars + net line (Recharts), stable `data` references; derives from the same normalized record (SSE updates it for free).

**Exit:** feature-complete checkpoint — all of A–H functional.

### Phase 7 — Live integration polish — adversarial review

Requirement H hardening. Stream status indicator (`live | reconnecting | offline`, aria-live); reconcile-on-reconnect verified against real API (kill network, watch recovery); event feed panel (Tier 2); tab-visibility pause/resume (Tier 2); rAF batching only if event rate measured to need it (Tier 3).

**Exit:** demo script passes: filters active + chart visible + events streaming → everything stays consistent through a forced disconnect/reconnect.

### Phase 8 — A11y + observability + performance pass

vitest-axe smoke test; keyboard walkthrough of the whole app; focus-visible audit; reduced-motion check on chart animations; Lighthouse run (saved); README observability section (where Sentry/web-vitals plug in, what `log.ts` already emits, how the incident-debugging story works).

### Phase 9 — Documentation + deploy

README (setup, env, assumptions, trade-offs, limitations, screenshots/GIF, deployed link at top); `docs/architecture.md` with ≥2 Mermaid diagrams (component/data-flow, SSE lifecycle state machine); **written answers to all seven discussion topics** (each linking to the ADR/code that evidences it — drafted with Claude in chat, not in Claude Code); `docs/ai-workflow.md` finalized; Vercel deployment with env vars; fresh-clone test of setup instructions.

### Phase 10 — Final review + submission

Cold read of the repo as a reviewer (90-second README skim test); commit history sanity pass; final CI green; submission email to recruiter (deployed link, repo link, 3-line orientation).

---

## 4. Phase order and slip rule

Phases 0–10 run strictly in order. Checkpoints:

- **Phase 0 exit** is a hard gate: findings reviewed before any architecture-dependent code.
- **End of Phase 6 = feature-complete.** All of A–H functional before any polish work starts.
- **Slip rule:** if feature-complete is at risk relative to the submission deadline, Tier 2 across all phases is frozen and remaining effort goes to Tier 1 only. The README's tier framing documents whatever was cut — cutting Tier 3 is the plan working, not failing.

## 5. Assignment deliverable mapping

| Assignment item | Where it lands |
| --- | --- |
| A Reliability Overview | `features/overview` (Phase 5) |
| B Score Breakdown | `features/score-breakdown` (Phase 5) |
| C Transaction Explorer | `features/transactions` (Phase 4) |
| D Cashflow Timeline | `features/cashflow` (Phase 6) |
| E Explanation Panel | `features/explanation` (Phase 5) |
| F Data States | `components/DataState` everywhere (Phase 3) |
| G Large Datasets | cursor loop + virtualization + derive pipeline (Phases 2+4) |
| H Streaming Updates | `api/sse` + `features/live` (Phases 2+7) |
| Working application | Vercel deployment (Phase 9) |
| README | Phase 9 |
| Architecture notes | `docs/decisions.md` + `docs/architecture.md` |
| ≥1 diagram | `docs/architecture.md` (≥2 Mermaid) |
| AI usage disclosure | `docs/ai-workflow.md` |

## 6. Discussion-topic checklist (README, Phase 9)

Each gets a written answer linking to evidence:

1. **API Design & Evolution** → generated types from committed spec; signal registry + unknown-signal fallback (ADR-07, ADR-12)
2. **Data Ownership & Boundaries** → backend owns scoring semantics, frontend owns presentation; BFF-over-upstream shape observed in Phase 0 (ADR-12)
3. **Data Consistency & Correctness** → normalized record, derived order, idempotent `applyEvent`, reconcile-on-reconnect, debounced score invalidation (ADR-05)
4. **Scalability (100K+)** → what changes: server-side filtering, windowed fetch, query-key filters; what survives: normalization, virtualization, derive discipline (ADR-04 pivot section)
5. **Real-Time Updates** → "stream is an optimization, REST is the truth"; status surfacing; gap handling (ADR-05, ADR-06)
6. **Caching & Performance** → Query staleness/invalidation map; what invalidates what and why (ADR-02)
7. **Incident Thinking** → ErrorBoundary payloads, `log.ts` events, Profiler method, where Sentry/web-vitals attach (ADR-15)

## 7. Definition of done (submission)

- All Tier 1 across A–H working on the deployed URL
- CI green; coverage thresholds met; zero gate warnings
- README passes the 90-second skim test (link, screenshots, setup, decisions, discussion answers)
- Diagrams render on GitHub; ai-workflow.md complete; fresh-clone setup verified
- Commit history readable, conventional, tells the build story

---

## End of PLAN.md