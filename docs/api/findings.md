# API verification findings — Phase 0

Probed on **2026-06-11** with `curl` against the live backend. All excerpts below are
real responses, trimmed (`…`) for readability. No application code exists yet; these
findings calibrate Phases 1–2.

## Hosts

| Role | URL | App config |
| --- | --- | --- |
| REST + discovery | `https://wydokyegph.execute-api.eu-central-1.amazonaws.com/` | `VITE_API_BASE_URL` |
| SSE | `https://vpjjdvoeej5izlqy3nnpllmyua0idsrp.lambda-url.eu-central-1.on.aws/` | `VITE_SSE_BASE_URL` |

Both are public and unauthenticated. Per ADR-08 they enter the app exclusively through
validated env (`src/config.ts`); they are never hardcoded in `src/`.

---

## 1. Discovery root — `GET /`

`HTTP 200`, JSON. Ten users, data range into mid-2027, endpoint list, and the upstream
banking API the service proxies (BFF shape, relevant to the data-ownership story):

```json
{
  "name": "Credit Builder API",
  "version": "1.0.0",
  "available_users": ["user_1001", "user_1002", …, "user_1010"],
  "data_range": { "from": "2025-09-01", "to": "2027-06-30" },
  "endpoints": [
    { "method": "GET", "path": "/api/users/:userId/reliability?from=YYYY-MM-DD", … },
    { "method": "GET", "path": "/api/users/:userId/transactions?from=…&to=…",
      "pagination": {
        "cursor": "?cursor=<base64>",
        "offset": "?page=1&limit=50",
        "note": "If no pagination params provided, ALL transactions are returned" } },
    { "method": "GET", "path": "/api/users/:userId/transaction-events", … },
    { "method": "GET", "path": "/health", … }
  ],
  "upstream": { "banking_api": "https://btq03nn21b.execute-api.eu-central-1.amazonaws.com/" }
}
```

`GET /health` → `{"status":"ok","upstream":"https://btq03nn21b.execute-api…"}`.

## 2. OpenAPI spec — `GET /openapi.yaml`

`HTTP 200`. Snapshot committed at [`docs/api/openapi.yaml`](./openapi.yaml)
(365 lines, OpenAPI 3.0.3). Type generation (`types.gen.ts` via `openapi-typescript`)
is deferred until the Phase 1 scaffold exists.

Spec statements verified or contradicted by probing:

- "Transactions are returned in arbitrary order. Client-side sorting is required." → **verified** (§4, §7).
- "No category filtering is available." → **verified**, and extends to all filter/search/sort params (§5).
- "If no pagination parameters are provided, ALL transactions are returned … can be 10,000+ records." → behavior verified; the size claim is far above reality (max observed: 631).
- `limit` documented as `maximum: 500`, default 50 — not exercised at the boundary.
- SSE "pre-scripted sequence over ~30 seconds, then closes" → verified, but delivery is broken for browsers (§6).
- The spec's only `servers:` entry is `http://localhost:3001` — the live hosts come from the brief, not the spec.

## 3. Reliability — `GET /api/users/:userId/reliability?from=`

`HTTP 200` for all probed users (`user_1001`, `user_1002`, `user_1005`, `user_1009`).
`from` is the window **end**; the window extends 6 calendar months back.

```json
{
  "user_id": "user_1001", "from": "2026-06-11", "currency": "EUR",
  "reliability_index": 74, "score_band": "MEDIUM",
  "metrics": {
    "income_regularity": 0.83, "income_coverage_ratio": 1.56,
    "essential_payments_consistency": 0.83, "good_months": 4,
    "negative_balance_days": 38, "late_fee_events": 0
  },
  "drivers": [
    "Income present in 5/6 months",
    "Income covers essential expenses (1.56x)", …,
    "Savings behavior detected (+21 pts)",
    "Estimated 38 negative balance day(s) (-10 pts)", …
  ]
}
```

Error shapes are consistent JSON:

- missing `from` → `400` `{"error":"from query parameter is required (YYYY-MM-DD)"}`
- unknown user → `404` `{"error":"User user_9999 not found"}`

**Shape notes for the breakdown feature (Phase 5):** the response carries `metrics`
(ratios/counters) and free-text `drivers`; it does **not** carry per-signal point
contributions as structured fields. Point values appear only embedded in driver
strings ("Savings behavior detected (+21 pts)"). The four signal components and their
point ranges (0–25, 0–25, 0–25, −20…+25) are documented in the spec prose only. The
signal registry (ADR-12) keys off `metrics` keys; how the breakdown chart derives
weighted contributions needs a design decision in Phase 5.

Score bands observed match the spec: LOW 0–49, MEDIUM 50–74, HIGH 75–100
(user_1005 → 15/LOW, user_1001 → 74/MEDIUM, user_1002 → 78/HIGH).

## 4. Transactions — `GET /api/users/:userId/transactions`

`from` and `to` are **required** (spec + discovery agree). Transaction shape, verified
across 700+ records:

```json
{
  "id": "txn_01284", "account_id": "acc_1001_chk", "user_id": "user_1001",
  "amount": -25.84, "currency": "EUR", "date": "2026-08-20",
  "description": "RESTAURANT SUSHI BAR", "merchant_category_code": "5812",
  "merchant_name": "Sushi Bar", "type": "debit",
  "synced_at": "2026-06-11T09:19:57.079Z"
}
```

The date field is **`date`** (not `bookingDate` as ADR-03's sort-key wording assumes);
the canonical sort key becomes `(date, id)`. `synced_at` is stamped per fetch (it
changes between calls) and is useless as a sort/identity key.

### Dataset sizes (full range 2025-09-01 → 2027-06-30, via `total`)

| user | total | user | total |
| --- | --- | --- | --- |
| user_1001 | **631** (largest) | user_1006 | 99 |
| user_1002 | 390 | user_1007 | 181 |
| user_1003 | 333 | user_1008 | 254 |
| user_1004 | 309 | user_1009 | 330 |
| user_1005 | 36 | user_1010 | 33 |

Maximum is **631**, i.e. hundreds, not the "thousands"/"10,000+" the docs suggest.
Virtualization and the cursor loop remain correct, but performance claims should say
"hundreds of records, engineered for tens of thousands".

### Pagination modes (all verified live)

**Offset** — `?page=1&limit=3` → `HTTP 200`:

```json
{ "transactions": […3 items…], "total": 631, "page": 1, "limit": 3,
  "total_pages": 211, "has_more": true }
```

**Cursor** — `?cursor=<base64>&limit=10`. Cursors are base64 of `{"offset":N}`.
Full loop verified on user_1010 (33 txns): pages of 10/10/10/3, ids unique across
pages, terminates cleanly:

```json
{ "transactions": […10 items…], "next_cursor": "eyJvZmZzZXQiOjEwfQ==", "total": 33 }
// last page:
{ "transactions": […3 items…],  "next_cursor": null,                  "total": 33 }
```

**⚠ Cursor bootstrap problem:** no response ever issues a *first* cursor — offset
responses contain no `next_cursor`, and `cursor=` (empty) falls through to
unpaginated. The only ways to start a cursor loop are (a) craft
`base64('{"offset":0}')` yourself — works, but depends on undocumented cursor
internals — or (b) use offset mode. Decision needed for ADR-04's loop implementation
(recommendation in Exit criteria, §3 note below).

**Unpaginated (footgun)** — no params, *and* `limit`-only:

- `?from=…&to=…` (nothing else) → all rows: `{"total":33,"page":1,"limit":33,"has_more":false}`
- `?from=…&to=…&limit=3` → **`limit` silently ignored**, all 631 rows returned
  (165 KB), response reports `"limit":631`. Pagination only activates when `page` or
  a non-empty `cursor` is present. This strengthens the "always pass explicit
  pagination params" rule: passing `limit` alone *looks* paginated and isn't.

The unpaginated response also carries `page`/`limit` keys, which the spec's
`UnpaginatedResponse` schema (`transactions`, `total`, `has_more`) doesn't declare —
harmless, but the generated types will be loose here.

### Error behavior

- **Malformed cursor** → **`HTTP 200`** with `{"error":"Invalid cursor format"}` —
  an error in a 200. The fetch client cannot trust status codes alone; it must treat
  any body with an `error` key as a failure.
- **Upstream rate limiting exists.** During a 10-user probing burst the BFF returned
  `{"error":"Failed to fetch data from banking API: Banking API error: 429 Too Many
  Requests"}` (outer HTTP status not captured; a later 12-request burst did not
  reproduce it). The cursor loop should fetch pages sequentially and surface this
  error shape; aggressive parallel page fetching is ruled out.

### Wire order

Page 1 of user_1001 returned dates `2026-08-20, 2026-05-03, 2026-10-23, …` —
arbitrary order, **but stable**: repeated identical requests return identical ids in
identical order, so paginated pages are consistent within and across loops.

## 5. Server-side filtering / search / sorting — none

Probed on user_1010 (33 txns; any effective param would change `total` or row 1):
`category=groceries`, `merchant=Lidl`, `search=Lidl`, `q=Lidl`, `type=credit`,
`sort=date`, `sort=amount&order=asc`, `min_amount=1000` →
**every response identical**: `total: 33`, same first row. All unknown params are
silently ignored. Matches the spec ("No category filtering is available").

**ADR-04 pivot condition (a) is not triggered.** Client-side filter/search/sort over
the normalized record stands.

## 6. SSE — `GET /api/users/:userId/transaction-events`

### ⚠ Critical: the endpoint does not deliver SSE to clients as deployed

#### Measured proof (4 independent runs, 2026-06-11)

**Probe A — explicit `Accept: text/event-stream`, byte-arrival timeline:**

```
curl -sS -N -D - -H "Accept: text/event-stream" -H "Origin: http://localhost:5173" \
  $SSE_BASE/api/users/user_1001/transaction-events
```

Byte arrival (reader timestamps relative to request start):

```
  +30.72s  received 2807 bytes (cumulative 2807)
  +30.72s  EOF, total 2807 bytes
```

Zero bytes for ~30 s, then the entire payload in one flush. Verbatim response
headers from this run:

```
HTTP/1.1 200 OK
Date: Thu, 11 Jun 2026 09:50:37 GMT
Content-Type: application/octet-stream
Transfer-Encoding: chunked
Connection: keep-alive
x-amzn-RequestId: 9804270d-186b-4221-915d-99aaa8df72d1
Access-Control-Allow-Origin: http://localhost:5173
Vary: Origin
```

**Probe B — counter-test, no `Accept` header:** identical result
(`content_type: application/octet-stream`, `TTFB: 30.099s`, `total_time: 30.100s`,
`size: 2807`). Content negotiation is ignored; the behavior is unconditional.

Two earlier runs (different users, with `Accept`) measured the same:
`TTFB 30.138s ≈ total 30.139s`. Delivery is **buffered, never incremental** —
`Transfer-Encoding: chunked` notwithstanding, all chunks arrive after the
server-side script has finished.

```json
{"statusCode":200,
 "headers":{"content-type":"text/event-stream","access-control-allow-origin":"*",
            "cache-control":"no-cache", …},
 "body":": connected\n\nid: 1\nevent: TRANSACTION_ADDED\ndata: {…}\n\nid: 2\n…",
 "isBase64Encoded":false,"cookies":[]}
```

That is a **Lambda proxy-integration envelope returned verbatim**: the Express app
behind it produces correct SSE (note the *inner* `content-type: text/event-stream`),
but the entire ~30 s script is buffered and wrapped in JSON.

> **Root-cause diagnosis (for the API owner):** the Lambda Function URL serving
> this endpoint is almost certainly configured with `InvokeMode: BUFFERED`
> (the default) instead of `RESPONSE_STREAM`, and/or the handler is not using
> the response-streaming API (`awslambda.streamifyResponse`). The signature is
> exact: a buffered Function URL receiving a proxy-result-shaped value it does
> not unwrap returns the envelope as the raw body with the default
> `application/octet-stream` content type, flushed only when the handler
> finishes. The application code behind it is demonstrably correct — the inner
> headers and `body` form a valid `text/event-stream` document. Enabling
> response streaming on the Function URL should fix the endpoint without
> application changes. Whether to report this upstream is an open decision
> (owner: project lead).

Consequences for a browser:

1. `EventSource` rejects the response (MIME is `application/octet-stream`, not
   `text/event-stream`) — instant `onerror`, no events, ever.
2. Even ignoring MIME, the events are inside a JSON string, not on the wire as SSE.
3. Nothing arrives until the script finishes — zero real-time behavior.

**This is not a CORS problem.** CORS is actually fine on both hosts (§6 CORS below).
ADR-06's named fallback (Vercel rewrite proxy) therefore does **not** fix it: a
rewrite preserves body and buffering. This contradicts ADR-06's assumption set and
needs a decision before Phase 2 (see Exit criteria §2).

The REST host cannot serve the stream either: the same path there → `HTTP 503`
`{"message":"Service Unavailable"}` after exactly 30 s (API Gateway timeout).

### Scripted event sequence (extracted from the envelope body)

Identical script per user (verified on user_1001 and user_1005), 6 events over ~30 s
with `: keepalive` comments between, ending with `: stream ended`:

```
id: 1  TRANSACTION_ADDED    txn=evt_txn_add_001_user_1001  amount=-47.8  "REWE MARKT EINKAUF"
id: 2  TRANSACTION_UPDATED  txn=evt_txn_add_001_user_1001  amount=-52.3  "… (KORREKTUR)"
id: 3  TRANSACTION_ADDED    txn=evt_txn_add_002_user_1001  amount=3200   "EMPLOYER GMBH SALARY"
id: 4  TRANSACTION_DELETED  transaction_id=evt_txn_dup_user_1001          ← id never exists
id: 5  TRANSACTION_UPDATED  txn=evt_txn_add_002_user_1001  "EMPLOYER GMBH GEHALT"
id: 6  TRANSACTION_ADDED    txn=evt_txn_add_003_user_1001  amount=-85    "STADTWERKE STROM+GAS"
```

Notes:

- ADDED/UPDATED carry a full `transaction`; DELETED carries only `transaction_id` —
  matches the spec and `applyEvent`'s planned semantics.
- Event 4 deletes an id that never existed: the **delete-of-unknown-id no-op path is
  exercised by the live script itself**, validating that ADR-05 case as mandatory.
- Event ids restart at 1 every connection and the synthetic transaction ids
  (`evt_txn_add_001_<user>`) are stable, so replays after reconnect are idempotent
  upserts — exactly what the pure `applyEvent` reducer assumes.
- The stream self-closes after ~30 s (`: stream ended`); any client loops
  reconnect → replay. `Last-Event-ID` is accepted but ignored (spec-confirmed), so
  ADR-05's "gaps are normal, REST is the truth" stance is required, not optional.
- Streamed transactions are dated "today" (`2026-06-11`) and would fall inside any
  current scoring window — good for demonstrating the debounced reliability
  invalidation.

### CORS

| Probe | Result |
| --- | --- |
| REST GET with `Origin: http://localhost:5173` | `access-control-allow-origin: *` |
| REST `OPTIONS` preflight | `204`, `allow-origin: *`, `allow-methods: GET,OPTIONS`, `allow-headers: content-type` |
| SSE host GET with Origin | `Access-Control-Allow-Origin: http://localhost:5173` (reflected), `Vary: Origin` |

Browser CORS is **not** a blocker for either host.

## 7. Anomalies

1. **Future-dated transactions**: 359 of user_1001's 631 records are dated after
   2026-06-11 (range runs to 2027-06-28). Expected per the brief and PLAN.md; date
   logic must not assume `date <= today`.
2. **Arbitrary but deterministic wire order** (shuffled relative to date; stable
   across calls). Sorting is entirely the client's job — supports ADR-03.
3. **Errors inside HTTP 200** (invalid cursor case) — the client error mapping must
   sniff `error` bodies, not just status codes.
4. **`limit` without `page`/`cursor` is ignored** — silent unpaginated fallback far
   more dangerous than the documented no-params case.
5. **Upstream 429 passthrough** observed once under bursty probing — sequential page
   fetching, and the error shape above, must be handled.
6. **`type` field is redundant** with the sign of `amount` — deliberate per spec
   ("Redundant with amount sign (deliberate)"); treat `amount` as truth, optionally
   assert consistency in dev (0 mismatches in 631 records today).
7. **user_1005 metrics are internally odd**: `income_regularity: 0`,
   `income_coverage_ratio: 0`, "No income or essential expenses detected", yet
   `good_months: 6` and driver "Good cashflow months: 6/6". Backend owns scoring
   semantics — we render what we get — but the explanation panel must not assume
   drivers are mutually consistent.
8. **`synced_at` changes on every fetch** — server-stamped at request time; carries
   no client meaning.
9. **Unpaginated response shape ≠ spec schema** (extra `page`/`limit` keys) — minor;
   affects generated-type strictness only.

---

## Exit criteria (PLAN.md Phase 0)

**1. openapi.yaml reachable?**
**Yes** — `GET /openapi.yaml`, HTTP 200, snapshot committed to `docs/api/openapi.yaml`.
No hand-written types needed. (Type generation itself happens in Phase 1 when the
scaffold exists.)

**2. SSE browser-CORS compatible?**
**CORS: yes. Browser-usable: no — and not for CORS reasons.** The Lambda Function URL
buffers the whole stream and returns a JSON proxy envelope with
`Content-Type: application/octet-stream` (measured proof in §6); native `EventSource`
cannot consume it, and ADR-06's documented fallback (Vercel rewrite proxy) cannot fix
buffering or the envelope. This contradicted ADR-06's assumptions and triggered
PLAN.md's stop condition.

**Decision (project lead, 2026-06-11): dual-path fetch-based transport.** The SSE
client is built on `fetch` + stream parsing instead of native `EventSource`:
incremental SSE parse when the response presents `text/event-stream` (works the
moment the backend enables response streaming, zero code change), envelope-unwrap
otherwise (events arrive as one ~30 s-delayed batch through the same `applyEvent` →
reconcile path). Stream status gains a fourth value — `live | delayed | reconnecting
| offline` — and the UI reports `delayed`, never `live`, when delivery is batched.
Clean envelope completion is the normal operating cycle (prompt reconnect, no
backoff, no reconcile — the envelope carried the events); backoff +
reconcile-on-reconnect apply only to recovery after errors, with a low-frequency
safety reconcile catching drift across cycles — a refinement of ADR-05's trigger,
not its principle. Transport budget ~150 lines + tests; ADR-14's mock-EventSource
tests are replaced by mock fetch-stream tests covering both paths. Recorded as
**ADR-17 (accepted 2026-06-11; supersedes ADR-06's transport choice)**. Reporting
the upstream misconfiguration (see §6 root-cause diagnosis) remains the project
lead's separate decision.

**3. Server-side filter/search supported?**
**No.** Every filter/search/sort param probed is silently ignored; spec concurs.
**ADR-04 stands — no pivot review needed.** One implementation wrinkle for Phase 2:
cursor pagination has no documented entry point (no first cursor is ever issued).
Recommendation: run the loop in offset mode (`page`/`limit` — explicit, documented,
returns `total_pages`/`has_more`) or, if cursor mode is kept, document the crafted
`base64('{"offset":0}')` bootstrap and the malformed-cursor 200-error case. To decide
at Phase 2 plan review.

**4. Largest dataset size measured?**
**631 transactions (user_1001)** over the full 2025-09-01 → 2027-06-30 range; smallest
is 33 (user_1010). Calibration: with `PAGE_LIMIT = 200`, the largest user loads in 4
sequential pages (~1–4 s observed per page). Virtualization claims should be phrased
as "hundreds today, engineered for tens of thousands".

**5. Payload shapes match the product brief? Anomalies noted?**
**Yes, shapes match** the spec and brief (reliability: index/band/metrics/drivers;
transactions: id/amount/date/merchant fields; SSE: typed events, DELETED carries id
only). Future-dated data confirmed (359/631 for user_1001, through 2027-06-28).
Full anomaly list in §7. Naming note: the transaction date field is `date`, so
ADR-03's canonical sort key reads `(date, id)` in implementation.

## ADR impact summary

| ADR | Status after Phase 0 |
| --- | --- |
| ADR-03 (normalized record, derived order) | **Reinforced** — wire order arbitrary; field name is `date`, not `bookingDate` |
| ADR-04 (full fetch via cursor loop, client-side derive) | **Stands** — no server filtering; sizes modest (≤631). Open detail: offset vs crafted-bootstrap cursor for the loop |
| ADR-05 (pure applyEvent, REST is truth) | **Reinforced** — live script exercises unknown-id delete; ids replay idempotently; stream self-closes every ~30 s |
| ADR-06 (native EventSource + backoff) | **Contradicted in part** — CORS fine, but endpoint is not EventSource-consumable as deployed; rewrite-proxy fallback ineffective. **Resolved: dual-path fetch transport per ADR-17 (accepted 2026-06-11)**; backoff/ownership/status machinery carries forward |
| ADR-07 (generated types from committed spec) | **Stands** — spec reachable and committed |
