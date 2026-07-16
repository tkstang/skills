---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-07-13
oat_generated: true
oat_summary_last_task: p07-t06
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: session-observer-collab

## Overview

This project hardened the existing Session Observer around failures seen during real multi-agent collaboration and added `session-observer-collab`, a dependency-free sibling skill for a bounded user-plus-two-agent workflow. It preserves the base observer as the sole transcript authority while making lifecycle continuation, identity, provenance, and closeout behavior explicit and testable.

## What Was Implemented

- Collaboration-safe transcript normalization: queued Claude deliveries render once per transaction while independent repeated messages remain distinct; literal wake envelopes normalize as non-human control input; Cursor emits only terminally completed turns; and user recovery pointers preserve source locations.
- A safer Session Observer interface: fail-closed `whoami` with ambiguity candidates, quiet empty watches that advance offsets, baseline-gap warnings, and newer-session candidates that never auto-switch a peer pin.
- The public `session-observer-collab` skill with N=2 protocol rules, exact peer pins, authority and pause boundaries, capability disclosure, versioned XDG lease state, control commands, and deterministic continuation selection.
- Runtime adapters and references for Codex, Cursor, Claude Code, and generic fallbacks. Codex lifecycle continuation was live-validated; Cursor and Claude Monitor remain honestly documented-but-unvalidated where no callable lifecycle surface was available.
- Distribution and release guards, generated-output checks, user and engineering documentation, a full acceptance/sanitization pass, and four file-backed v2 backlog items.

## Key Decisions

- **Collaboration uses a sibling layer.** `session-observer-collab` composes the base CLI for all transcript operations instead of duplicating runtime parsing, offsets, or watch semantics. This keeps observer mechanics reusable and isolates collaboration authority, leases, and runtime lifecycle policy.
- **Wake envelopes are non-human control.** The production XML envelope is recognized across Claude Code, Codex, and Cursor, retains automatic/runtime/lease/pin/range provenance, and cannot grant human authority or recursively spend continuation budget.
- **Bounded lifecycle continuation.** Per-session, owner-only leases combine exact peer identity, expiry, wait windows, caps, atomic cursor/count claims, and deterministic disarm/prune behavior. A runtime may claim only the wake tier it has actually proven.
- **Acting runtime selects setup.** `whoami` selects the single setup reference for the acting harness, while the peer remains an independently confirmed `<runtime>:<session-id>` observation pin. This prevents cross-runtime setup instructions from being derived from the peer.

## Design Deltas

- The planned p04/p05 worktree parallelism degraded to sequential execution because Git could not create phase refs beneath the existing orchestration branch leaf. The change affected scheduling only, not task boundaries or shipped behavior.
- A final p03 Medium ambient-declaration correction proceeded without another phase review by explicit user direction; the later full-branch final review passed clean and is the closing review boundary.

## Notable Challenges

- A real trusted Codex Stop hook exposed repository-relative imports after installation outside the checkout. The shipped solution uses an atomic stable launcher and content-addressed private support bundle, then validates registration, trust, effective execution, cancellation recovery, no-op cursor advancement, pruning, and cleanup.
- Final review exposed production-wire-format, runtime-routing, repeated-input, ambiguity-recovery, and evidence-quality gaps. Six bounded p07 fixes resolved them; the final one-commit re-review found zero findings.

## Tradeoffs Made

- v1 is intentionally an N=2 topology. N>2 mesh safety awaits consumer-scoped offsets and locks rather than overloading shared state with unproven semantics.
- No runtime auto-switches to a newer session and no peer or synthetic content grants privileged local authorization. Exact pins, candidate output, and explicit local action favor safe recovery over convenience.
- Codex has live lifecycle proof; Cursor continuation and Claude Monitor remain bounded/manual or scheduled-poll fallbacks until their live acceptance probes succeed.

## Integration Notes

- Canonical transcript behavior lives in `src/transcript/core/runtimes.ts`; `pnpm run build` regenerates the Session Observer and Export Session Transcript runtime mirrors. A shared-runtime change must satisfy generated-output parity and bump each affected canonical skill version.
- Shipped skills remain dependency-free on Node.js 22+. User-level skill copies and Claude/Cursor provider links were refreshed and verified during closeout; future dogfooding must keep that parity rule.
- The mandatory final verification passed 1,090 tests with one intentional skip, plus lint (five unrelated pre-existing warnings only), type-check, build/build-check, validation, changed-skill checks, and clean-tree checks.

## Follow-up Items

- `BL-260713-per-observer-offsets-and-safe`: consumer-scoped offsets and locks for safe N>2 collaboration.
- `BL-260713-stronger-cursor-collaboration`: stronger Cursor wake surfaces.
- `BL-260713-cursor-transcript-store`: Cursor transcript-store and slug coverage.
- `BL-260713-optional-idle-session`: optional application integrations for non-blocking idle-session wake.
