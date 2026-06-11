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

## Documentation

- [`docs/decisions.md`](docs/decisions.md) — architecture decision records
- [`docs/api/findings.md`](docs/api/findings.md) — live API verification evidence
- [`docs/api/openapi.yaml`](docs/api/openapi.yaml) — committed API spec snapshot
