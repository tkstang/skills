---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - .
  - .oat/repo/reference/reviews/2026-09-07-standard-repo-audit.md
  - .oat/repo/reference/reviews/2026-09-11-audit-astra-review.md
  - .oat/repo/reference/evidence/skills-standard-audit-2026-09-07-run-01/raw/dossiers/runtime-gather-lane-01.json
oat_external_plan_commit: f5395a35
oat_backlog_items: []
oat_issue_url: null
created: '2026-09-08T00:16:29Z'
updated: '2026-09-11T13:29:20Z'
---

# Bound panel provider subprocess output before it can exhaust the host process

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`. Execute it directly, or import it with `oat-project-import-plan <this-file>`.

## Outcome

Panel provider invocations enforce the same bounded stdout/stderr capture policy and forced-settlement behavior as the hardened core runner. A noisy child fails predictably with a structured cap error without unbounded in-memory string growth or a held-pipe hang.

## Source and live evidence

- Planned at `f5395a35`; audit finding `RUNTIME-002`.
- `src/consensus/panel/consensus-panel.ts:1140-1233` appends all stdout/stderr chunks to strings with no byte cap.
- `src/consensus/core/loop-provider.ts:217-279` counts bytes, kills on breach, and schedules final settlement.
- `tests/consensus/core/provider-cli-timeout.test.ts` has cap/descendant coverage absent from the panel suite.
- This is a newly verified panel/core capture-policy disparity following `2026-07-17-consensus-subprocess-hardening.md`. That older plan assumed output caps existed, but its acceptance criteria covered stdin guards and optional timeout escalation. The wave-2 summary records those as shipped; this plan does not declare the completed timeout/stdin outcome unfinished.

## Drift check

```bash
git diff --stat f5395a35..HEAD -- src/consensus/panel/consensus-panel.ts src/consensus/core/loop-provider.ts tests/consensus/panel tests/consensus/core/provider-cli-timeout.test.ts
```

## Scope

### In scope

- Panel `runProviderCliCommand`, its types/constants, and panel subprocess tests.
- Generated panel runtime and its skill version.

### Out of scope

- Unifying the core and panel runners into a new shared architecture.
- Changing provider timeouts, panel concurrency, result schemas, or the core runner.
- Broader CLI-helper extraction covered by a separate Pass A plan.

## Implementation steps

### 1. Port the established bounded-capture policy

Use Buffer chunks and byte counters for each stream. Enforce the existing core policy of 10 MiB **per stream**, allowing exactly the cap and rejecting the next byte. Do not import loop-specific errors into panel. Reject with panel's existing `PanelError` shape and a specific `SUBPROCESS_OUTPUT_CAP` code, `PANEL_EXIT_CODES.CONFIG`, and stream/cap details. Preserve successful result shapes and existing timeout behavior; adding this bounded failure code is the intended change, not a result-schema redesign.

On cap breach, retain the specific cap error, kill the child, destroy held pipes during forced settlement, and ensure close/error races settle once. Schedule cap-triggered final resolution even with no configured timeout. Do not add a user-facing flag or promise termination of an entire descendant process tree; the guarantee is bounded capture and parent-handle settlement.

**Verify:** existing panel timeout tests remain green.

### 2. Add panel cap and held-pipe regressions

Mirror the core tests for oversized stdout, oversized stderr, cap precedence over timeout, and **cap breach plus descendant-held pipes with no timeout configured**. The existing panel test already covers timeout-triggered held pipes, which is not enough to prove cap-triggered settlement. Add exact-boundary and multibyte-byte-count cases. Test descendants must have explicit fixture-owned teardown, not be left alive after the parent settles.

**Verify:** `pnpm exec vitest run tests/consensus/panel/provider-cli-timeout.test.ts tests/consensus/core/provider-cli-timeout.test.ts` passes.

### 3. Regenerate and validate

Build generated panel output, bump the panel skill version, and run affected/full gates.

**Verify:** `pnpm run premerge` and `pnpm run validate:skill-versions -- --base-ref origin/main` succeed. Also run targeted `pnpm exec oxlint src/consensus/panel/consensus-panel.ts` and `pnpm exec oxfmt --check src/consensus/panel/consensus-panel.ts tests/consensus/panel/provider-cli-timeout.test.ts`; no repository-wide formatting. Node >=22, pnpm 10.13.1, canonical TS/generated-output rules, and Conventional Commits apply; publication requires separate authority.

## Done criteria

- [ ] Both panel streams have a byte cap and bounded settlement.
- [ ] Cap errors remain more specific than timeout/close outcomes.
- [ ] Held descendant pipes cannot hang completion.
- [ ] Panel result compatibility is preserved.
- [ ] Generated output, version, validation, and tests pass.

## STOP conditions

- Porting the policy requires changing existing public result shapes or error classification beyond the specified new cap error.
- A shared-runner extraction becomes necessary; split that architectural outcome into a separate decision.
- Test fixtures cannot prove bounded settlement without leaking child processes.

## Review focus

Inspect byte accounting, multibyte chunks, single settlement, process cleanup, cap/timeout precedence, and generated output parity.
