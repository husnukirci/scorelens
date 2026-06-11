# CLAUDE.md

This file is read by Claude Code at the start of every session. It is the contract for how work happens in this repo. Read it fully. When in doubt, defer to PLAN.md for what to build and docs/decisions.md for why.

---

## 0. Commands

| Action                                  | Command        |
| --------------------------------------- | -------------- |
| Install + git hooks                     | `make install` |
| Dev server                              | `make dev`     |
| Local gates (typecheck + lint + tests)  | `make test`    |
| Production build                        | `make build`   |
| Regenerate API types from openapi.yaml  | `make types`   |
| List all targets                        | `make help`    |

Run from the repo root. `make help` is the canonical list.

---

## 1. Project context

**scorelens** is an internal tool for risk analysts and product teams: it visualizes and explains a Reliability Index (0–100) computed from bank transaction data for thin-file credit decisions. Analysts use it to understand how a score was computed, inspect underlying transactions, identify anomalies, and validate that the scoring system behaves correctly.

The standards bar is production-grade: clean feature-sliced architecture, disciplined state management, correct handling of streamed and out-of-order data, performance with thousands of transactions, and complete documentation. Quality and judgment are first-class concerns.

The backend is external and read-only (REST + SSE on two separate hosts). The frontend never owns scoring semantics — it presents and explains them.

---

## 2. Source-of-truth documents

Read in this order at session start:

1. **CLAUDE.md** (this file) — rules, invariants, working agreement
2. **PLAN.md** — phased build plan, Tier 1/2/3 scope, exit criteria, deadline
3. **docs/decisions.md** — reasoning behind every locked decision (ADRs)

When user instructions conflict with these documents, ask before proceeding. Do not modify these three files without explicit instruction.

---

## 3. Hard rules (non-negotiable)

Violating these is a defect, not a stylistic preference.

### Forbidden

- **No copying server data into Zustand.** Server state lives in TanStack Query only. The Zustand store holds client/UI state exclusively (see §4). Duplicating server truth is the cardinal sin of this codebase.
- **No calling the transactions endpoint without pagination params.** The API returns ALL transactions when no params are given; we always use the cursor loop with an explicit limit.
- **No redux, mobx, jotai, recoil, valtio, rxjs, socket.io.** State is TanStack Query + one Zustand store. SSE uses native `EventSource`.
- **No `any` type.** Use `unknown` and narrow, or define the type.
- **No non-null assertions (`!`)** without an inline comment justifying why null is impossible.
- **No `as` casts** without a justifying comment. `as unknown as T` is a code smell that needs a comment.
- **No `// @ts-ignore` / `// @ts-expect-error`** without an inline explanation.
- **No default exports.** Named exports only.
- **No barrel re-exports** (`index.ts` files that only re-export). They break tree-shaking and obscure dependencies.
- **No `console.log`** in source. `console.warn`/`console.error` for genuine errors; structured dev logging goes through `src/utils/log.ts`, gated behind `import.meta.env.DEV` where dev-only.
- **No `dangerouslySetInnerHTML`.**
- **No inline styles.** Tailwind classes or design tokens.
- **No new dependencies** outside the pre-approved list (§6) without asking first.
- **No TODO/FIXME comments, no commented-out code, no `.skip`/`.only`** committed.
- **No empty `catch` blocks.** Handle or rethrow with context.
- **No `process.env` reads.** Client config comes exclusively through `src/config.ts`, which reads `import.meta.env.VITE_*`.
- **No secrets in `VITE_*` vars, ever.** Vite inlines them into the public bundle. The two API URLs are public and unauthenticated; nothing else goes in env without discussion.
- **No speculative memoization.** `React.memo`/`useMemo`/`useCallback` only on the three designated hot paths (§4 Performance) or with Profiler evidence.
- **No external positioning in code or commits.** No company names, no "challenge"/"assignment"/"submission" framing in source, comments, or commit messages. The repo reads as a real product. The assignment context lives only in `docs/ai-workflow.md` and the README's discussion section, where it is a required deliverable.

### Required

- **TypeScript strict mode** — `strict: true`, `noUncheckedIndexedAccess: true`, `noFallthroughCasesInSwitch: true`, `noImplicitReturns: true`, `noUnusedLocals: true`, `noUnusedParameters: true`.
- **Explicit return types** on exported functions and non-trivial internal functions.
- **`AbortController` on every fetch**; TanStack Query's signal is passed through to the client.
- **All async functions handle errors explicitly.** Unhandled promise rejections are bugs.
- **`applyEvent` is a pure function.** `(record, event) => record`. No IO, no React, no Date.now() inside. No-op events return the same reference.
- **SSE writes go through `queryClient.setQueryData`** on the transactions key. Never a parallel store.
- **Every stream (re)connect triggers reconciliation** (`invalidateQueries` on the transactions key). The stream is an optimization; REST is the truth.
- **Query keys are built from client state** (`['transactions', userId, from]`). Filters/search/sort are NOT in query keys — they are client-side derives.
- **Derived data flows through memoized selectors/hooks** (`useVisibleTransactions`, cashflow aggregation). Components never filter/sort inline.
- **Stable keys in lists** — always entity id, never array index.
- **Semantic, keyboard-reachable UI.** Virtualized table keeps grid semantics; filters and sort reachable by keyboard; visible focus rings; `aria-live="polite"` on stream status; score bands signaled by color + text, never color alone.
- **Every feature renders loading/empty/error through the shared `DataState` component.** No bespoke spinners.
- **Unknown signal ids render through the fallback path**, never crash (see §4 Domain).
- **Never commit to `main`.** Feature branches + PRs (`gh pr create`). Merging is the user's call, never Claude's.
- **No `Co-Authored-By: Claude` trailers.** AI usage is documented in `docs/ai-workflow.md`, not per-commit.

---

## 4. Architecture invariants

Changing these requires a new ADR.

### Layers and import direction

```
features/  →  api/ + state/  →  hooks/ + utils/ + domain/ + config.ts
components/ (leaf: imports only hooks/utils/domain/styles)
```

- Features may import from the data core; the data core never imports from features; shared `components/` import from nobody above them.
- `domain/` and `utils/` import nothing internal. `hooks/` may import `utils/`.
- Enforced via ESLint `import/no-restricted-paths`. A violation is a defect.
- Promotion rule: hooks/utils start colocated in their feature and move to `src/hooks/` / `src/utils/` only when a **second** feature needs them. Never preemptively.

### State

- **TanStack Query = server state** (reliability response, transactions record). Litmus test: "if the page reloaded, would this value be re-fetched (Query) or re-chosen by the user (Zustand)?" There is no third bucket.
- **Zustand = client state only**: selected user, scoring window (`from`), filters, sort, search text, panel toggles, stream connection status. One store, `src/state/uiStore.ts`.
- **Transactions are normalized**: `Record<transactionId, Transaction>` stored in the Query cache. Arrays are derived in selectors (`Object.values` at derive boundaries), sorted by `(bookingDate, id)` — order is never assumed from the wire.
- Zustand subscriptions select the minimum slice; `useShallow` for derived tuples. Never `useStore(s => s)`.
- TanStack Query `select` projections per feature (overview subscribes to score, not the whole response).

### Data fetching

- Full transaction set loaded via **cursor-pagination loop** (`PAGE_LIMIT` explicit) into the normalized record. Filtering/sorting/search happen client-side over memoized derives. Pivot conditions documented in ADR-04.
- The typed fetch client maps HTTP errors to a discriminated `ApiError`; features see typed states via `DataState`.

### SSE

- One `EventSource` per selected user, owned by `useTransactionStream(userId)`: open on mount/user-change, `close()` on cleanup. A leaked EventSource is a defect.
- Connection machinery in `api/sse/eventSource.ts`: manual exponential backoff with jitter (1s → 2s → 4s → cap 30s) replacing default retry; status surfaced to the UI store (`live | reconnecting | offline`).
- Event semantics in `api/sse/applyEvent.ts` (pure): ADDED = upsert; UPDATED = upsert (unknown id treated as ADDED); DELETED of unknown id = no-op, same reference. Idempotent by construction.
- Transaction mutations trigger a **debounced invalidation of the reliability query** (score stays consistent with underlying data).
- Tab hidden → pause stream; tab visible → reconnect + reconcile.

### Domain

- Business-meaning constants live in `src/domain/`: `signals.ts` (four scoring signals: id, label, explanation copy, color token), `scoreBands.ts` (thresholds, labels, color tokens), `categories.ts` (category metadata).
- Presentation metadata is keyed by id from the API; the backend owns scoring semantics. Rendering iterates the registry; signal ids not in the registry render via a generic fallback (label = id, neutral color). Adding a signal = one registry entry.

### Performance

- **Exactly three designated hot paths** are memoized; everything else is plain React:
  1. `TransactionRow` — `React.memo`, fed stable references from the normalized record. Verified with React Profiler: a single-row SSE update re-renders one row.
  2. The derive pipeline — `useMemo` on filter→search→sort and on cashflow/chart `data` arrays (stable references prevent Recharts re-animation).
  3. The SSE write path — no-op events produce zero renders; bursts may be batched into one `setQueryData` per animation frame if measured necessary.
- Search input is debounced (`DEBOUNCE_MS` colocated constant).
- React Compiler is intentionally OFF (ADR-13).
- Profile before optimizing. Memoization without a hot-path designation or Profiler evidence is reverted in review.

### Configuration

- `src/config.ts` reads, validates (URL parse), and freezes env at startup. Missing/malformed env fails fast with a clear error. The rest of the codebase imports `config`, never `import.meta.env`.

---

## 5. File and folder conventions

Structure is locked in PLAN.md §2. New files go in the appropriate folder; no new top-level folders without asking.

- **Files**: PascalCase components (`TransactionTable.tsx`), camelCase modules (`applyEvent.ts`), kebab-case config (`vite.config.ts`).
- **Folders**: lowercase (`features/score-breakdown`).
- **Hooks**: `use*` prefix; one hook per file when ≥30 lines.
- **Types**: PascalCase; `type` for unions/primitives, `interface` for extensible object shapes. Generated types stay in `api/types.gen.ts` and are refined (never edited) in `api/types.ts`.
- **Tests**: colocated `*.test.ts(x)` next to source.
- **Imports order**: external → internal alias (`@/api/...`) → relative. Never deep-import across feature boundaries.
- Avoid `enum` (string literal unions / `as const`) and `namespace`.
- Comments explain *why*, never *what*. JSDoc on the data-core public surface.

---

## 6. Pre-approved dependencies

Installable without asking:

**Runtime:** `react`, `react-dom`, `@tanstack/react-query`, `@tanstack/react-virtual`, `zustand`, `recharts`, `clsx`

**Build:** `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss` (v4, CSS-first — no `tailwind.config.js`, no `postcss.config.js`), `@tailwindcss/vite`

**API types:** `openapi-typescript` (dev)

**Tooling:** `eslint`, `@typescript-eslint/*`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-import`, `prettier`, `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`

**Testing:** `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `happy-dom`, `msw`, `vitest-axe`

Anything else: **ask before installing**, justify in the PR.

---

## 7. Testing rules

### Test-first (strict TDD) for:

- `api/sse/applyEvent.ts` — the full event matrix: add, update, delete, duplicate event, out-of-order arrival, update-for-unknown-id, delete-for-unknown-id, delete-then-update, no-op reference stability
- The cursor-pagination fetch loop (page assembly, normalization, abort, malformed cursor)
- `useVisibleTransactions` derive logic (filter/search/sort composition) — test the pure derive function, hook is a thin wrapper
- Cashflow monthly aggregation
- `src/utils/**` and `src/config.ts` validation
- uiStore actions

Write the failing test first, watch it fail, then implement.

### Test-after (pragmatic) for:

- Feature components: renders correctly, key interactions, `DataState` integration
- `useTransactionStream` with a mock EventSource (connect, event dispatch, error → backoff → reconcile, cleanup closes)
- One vitest-axe smoke test on the assembled main view

### Don't test:

- Trivial passthrough components, CSS, third-party internals
- The real API (MSW handlers + mock SSE in `src/test/`, never live calls in tests)

### Coverage thresholds (vitest.config.ts):

- `src/api/**`: 90% lines / 85% branches
- `src/utils/**`, `src/domain/**`: 95% / 90%
- `src/state/**`: 90% / 85%
- Components: no threshold (meaningful tests over numbers)

### Conventions:

- Factories in `src/test/factories.ts`; never inline object literals for test data
- MSW for network; mock `EventSource` class for streams
- Test names describe behavior: `'returns same reference when deleting unknown transaction id'`, not `'calls delete handler'`

---

## 8. Self-review process

After every implementation chunk, before committing, produce a self-review report.

### Universal rubric

**Gates**
- [ ] `make test` (typecheck + lint + tests) — zero errors, zero warnings
- [ ] `make build` — production build succeeds

**Forbidden patterns scan**
- [ ] No `any`, unjustified casts/assertions, `@ts-ignore`
- [ ] No server data in Zustand; no unpaginated transactions call
- [ ] No `console.log`; no forbidden libraries; no new unapproved deps
- [ ] No TODO/commented-out code/`.skip`/`.only`

**Architecture invariants**
- [ ] Import-direction lint passes; no cross-feature deep imports
- [ ] SSE writes only via `setQueryData`; reconcile-on-reconnect intact
- [ ] Filters/search/sort not in query keys; derives memoized
- [ ] Unknown-signal fallback unbroken

**Performance**
- [ ] Memoization only on designated hot paths
- [ ] Profiler verification for any change touching `TransactionRow` or the derive pipeline
- [ ] No inline objects/arrays passed to memoized components

**Tests**
- [ ] TDD layers have tests written first; coverage thresholds pass

**Accessibility**
- [ ] New interactive elements keyboard-reachable, visible focus
- [ ] Color never the only signal; aria-live untouched or improved

**Commit hygiene**
- [ ] Diff contains only files for this chunk; conventional message; no `.env`

### Critical-phase adversarial review

Phases 2, 4, and 7 (data core, explorer, live integration) require an additional pass: re-read the diff as a senior engineer reviewing the PR cold. List concrete concerns (untested edge cases, wrong abstraction level, unclear naming, functions doing too much, unhelpful error messages).

After the report: **wait for explicit approval before committing.** If a rubric item fails, propose a fix. If waived, justify.

---

## 9. Commit conventions

Conventional Commits, enforced by commitlint.

**Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`.
**Scopes:** `api`, `sse`, `state`, `domain`, `overview`, `breakdown`, `transactions`, `cashflow`, `explanation`, `live`, `shell`, `components`, `utils`, `a11y`, `infra`, `deps`, `tooling`, `docs`, `ci`. Empty scope allowed for cross-cutting chores.
**Subject:** imperative, lowercase, no period, ≤72 chars.
**Body:** why, not what. `verified: typecheck/lint/tests pass` when relevant.

- One logical change per commit. TDD layers may split `test(api): ...` then `feat(api): ...`.
- No WIP/fix-typo commits in final history; squash locally before push. History stays readable — it is part of the evidence of method.
- No `git add .`. Stage deliberately.

---

## 10. Working agreement

### Before implementing
- For any phase or multi-file change, summarize the plan in 5–7 bullets first; wait for approval.
- For TDD layers, show the failing tests first; wait for approval.
- Conflicts with PLAN.md/CLAUDE.md/decisions.md → ask. Underspecified → list assumptions, ask which apply.

### During implementation
- Stay within the current phase's tier scope. No preemptive Tier 2/3 work without approval.
- Out-of-scope discoveries go in the self-review "Notes", not silent fixes.
- If a gate or hook fails, fix the cause. Never `--no-verify`.

### After implementation
- Run all gates locally, produce the self-review report, wait for approval, commit, summarize what's next.

### When stuck
- Two failed attempts at the same problem → stop and report: what was tried, what failed, alternatives. Never lower standards (`any`, `.skip`) to force green.

---

## 11. AI workflow documentation

This project is built with extensive AI assistance and the process is a first-class deliverable. `docs/ai-workflow.md` captures where and how AI was used — written from the user's perspective; Claude only writes to it when explicitly asked. Phase work may produce material for it (notable prompts, course corrections) flagged in self-review "Notes".

---

## 12. What "done" means

A phase is done when: all Tier 1 deliverables implemented per PLAN.md; all gates green with zero warnings; coverage thresholds met; self-review approved; conventional commits made; phase documentation obligations met; no TODOs/`.skip`. "Mostly works" is not done. CI must be green.

---

## 13. Escalation

Ask when: a locked ADR seems wrong for the task at hand; an invariant conflicts with making it work; a dependency outside §6 is needed; tier scope is ambiguous; Phase 0 verification contradicts an ADR's assumptions (this triggers the documented pivot, not improvisation).

Don't ask for: choices between equivalent implementations within the rules, or anything the linter/§5 already decides.

---

## End of CLAUDE.md