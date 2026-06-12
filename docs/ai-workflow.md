# AI Workflow

Use of AI was explicitly permitted for this challenge. This document describes
where and how it was used — not as a disclaimer, but because the process is,
in my view, part of the engineering. I work with AI the way I'd want a team
to: under an explicit contract, with mandatory review gates, and with the
judgment calls staying human.

## Setup

Two tools, two roles:

- **Claude (chat)** — research and planning partner. Domain research,
  architecture design, the ADR drafts, scope tiering, drafting the
  discussion answers, and review of every phase gate. The planning
  conversation produced the three governing documents before any code
  existed.
- **Claude Code (CLI)** — implementation, under the contract described
  below. Each phase ran in a fresh session opened with a fixed phase-start
  prompt enforcing the same ritual: read the contract, verify a clean main,
  branch, present a plan, wait for approval, build, stop at exit criteria,
  present a self-review, open a PR.

## The contract

The repo is governed by three committed documents, written before the first
line of source:

- `CLAUDE.md` — hard rules (forbidden/required patterns), architecture
  invariants, testing obligations, a self-review rubric, and a working
  agreement that requires plan approval before code and review approval
  before commits.
- `PLAN.md` — eleven phases with exit criteria and Tier 1/2/3 scope.
- `docs/decisions.md` — ADRs for every locked decision, including rejected
  alternatives and, where relevant, the conditions under which the decision
  should be revisited.

Three controls never left human hands: approving the plan before code,
approving the self-review before commits, and merging. The agent opened
every PR; it merged none of them.

## What the process caught (selected)

The contract requires an adversarial review before commit on critical
phases — re-reading the diff as a cold senior reviewer. It produced real
findings, raised by the AI against its own output and ruled on by me:

- **Phase 0:** verification probing found the deployed SSE endpoint
  buffered (wrong MIME type, zero bytes for ~30 s, then one flush) —
  contradicting an accepted ADR. Resolution: a superseding ADR-17
  (dual-path transport, honest "delayed" status, automatic upgrade path),
  written only after I required measured proof: four probe runs, verbatim
  headers, byte-arrival timelines, an Accept-header counter-test. The
  diagnosis was reported upstream; the solution depends on it in neither
  direction.
- **Phase 2:** a layer-boundary question (stream status writes to the UI
  store) surfaced with costed options — resolved by sanctioning one narrow,
  documented arrow in the contract rather than leaving a silent exception;
  a duplicated type union flagged before it could drift; a degenerate
  reconnect hot-loop identified, which I ruled into immediate fix rather
  than deferral because it belonged to ADR-17's correctness, not to
  later hardening.
- **Phase 4:** a debounce race (keystroke vs. filter reset) self-caught
  and fixed pre-commit; an unavoidable inline-style exception (virtualizer
  geometry) resolved by amending the contract truthfully instead of
  excusing silently; a test-environment discovery (happy-dom has no
  layout; the virtualizer measures via offsetWidth) made by reading the
  virtualizer's source rather than stubbing blindly.
- **Phase 9 — the direction reversed:** the AI fact-checked _my_ prose
  against the repository before placing the discussion answers, and won
  twice: one claim about unknown-signal rendering was scoped down to what
  production data actually exercises, and one named instrument
  (derive-pipeline timing) turned out to be designed but never wired — now
  recorded honestly in the README's limitations rather than papered over —
  a protocol that also corrected this document itself before it was
  committed.
- **Deployment:** the first production build shipped without its
  environment variables. The app's own fail-fast config validation turned
  what would have been mysterious fetch failures into a single explicit
  console error naming the missing variable — the incident-thinking design
  doing its job on its author.

## Division of labor, honestly stated

AI produced: the bulk of the implementation code, the test suites, the
probe scripts, and first drafts of most documentation. I produced: the
requirements interpretation, every architecture decision and ADR ruling,
scope and tier judgments, all gate approvals, the decision to
diagnose-and-design-around the endpoint misconfiguration (and to report
it), and the final edit of everything in this repository written in the
first person. Every commit passed typecheck, lint, tests, and the rubric
before I approved it; nothing merged that I had not reviewed. The history —
over 120 conventional commits across 12 reviewed PRs, 183 tests — is the
audit trail of that loop, in the order it actually happened.

## Why this way

AI throughput without visible judgment is noise. The contract exists to
make the judgment visible and auditable: the ADRs record why, the PR
history records what was reviewed, and this document records who decided.
The approach scales unchanged from a solo challenge to a team setting —
it is how I'd raise the bar for AI-assisted development with real
engineers, too.
