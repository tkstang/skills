# Session Observer Collaboration Handoff Packet

Copy this entire directory to the `session-observer` implementation worktree.
Start with [`prompt.md`](prompt.md); it is the authoritative implementation
brief. The remaining files are evidence, tested prototypes, and operational
references.

## Packet contents

- `prompt.md` — required base-skill improvements and the
  `session-observer-collab` authoring brief.
- `codex-stop-hook-setup.md` — complete setup, trust, operation, diagnostics,
  storage, worktree scoping, and cleanup contract for the validated Codex wake
  bridge.
- `cursor-stop-hook-setup.md` — documented Cursor Stop-hook generation-chain,
  synthetic-control, buffering, and live-validation contract.
- `acceptance-matrix.md` — implementation and harness validation matrix.
- `closeout-runbook.md` — how to end a collaboration without stale watchers,
  leases, or misleading wake claims.
- `prototypes/codex/session-observer-collab-stop.mjs` — exact working Codex
  Stop-hook snapshot from the 2026-07-12 run. It is evidence, not production
  source.
- `prototypes/codex/hooks-entry.example.json` — the validated hook registration
  shape, to be merged without replacing unrelated hooks.
- `prototypes/codex/lease.example.json` — sanitized per-session lease schema.
- `claude-code-logs.md`, `codex-logs.md`, and `cursor-logs.md` — per-runtime
  evidence logs.
- `cursor-kickoff.md` — tested template for onboarding a stateless third
  observer mid-run.

## Scope decision

Ship `session-observer-collab` v1 for two collaborating agent sessions plus the
user. N>2 remains constrained to ring/hub topology or stateless third-observer
reads. Per-observer offset namespaces are optional Part 1.8 work; if they do
not land in this implementation, create a concrete v2 backlog item.

## Handoff rule

Do not copy session-specific live state from the source machine. The lease
example is sanitized. Install runtime state through the new skill's setup flow,
and require local hook trust in the acting Codex session.

This committed `references/` directory is the authoritative handoff packet for
the implementation. Historical `.session-observer/` path mentions inside the
imported prompt, kickoff template, and logs describe the source collaboration's
original logging location; they do not name a live state directory to copy or
ship.

## Deferred v2 backlog

- `BL-260713-per-observer-offsets-and-safe`
- `BL-260713-stronger-cursor-collaboration`
- `BL-260713-cursor-transcript-store`
- `BL-260713-optional-idle-session`

These file-backed items live under `.oat/repo/pjm/backlog/items/` and preserve
the deferred N>2, Cursor, and optional application-integration boundaries from
the implementation brief.
