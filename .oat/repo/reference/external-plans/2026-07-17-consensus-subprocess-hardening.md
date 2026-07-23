---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-harden-consensus-wrapper
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Harden the consensus-loop subprocess path with timeout escalation and stdin error guards

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

The subprocess path used by the consensus skill wrappers (`runProviderCliCommand` in `consensus-loop.ts`, plus its duplicated copy in `consensus-panel.ts`) gains the same robustness the newer `provider-cli/subprocess.ts` stack already has: a deadline with SIGTERM→SIGKILL escalation, and an stdin `error` listener guarding the write-after-failed-spawn sequence. Today a stuck provider CLI hangs the wrapper path indefinitely (the more commonly exercised path), while the `consensus` binary's own subprocess layer is protected — an inconsistency invisible until a provider hangs in production.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (architecture + correctness lanes), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Verified evidence (read live at planning time):
  - `src/consensus/core/consensus-loop.ts:1379-1454` — `runProviderCliCommand` spawns with `stdio: ['pipe','pipe','pipe']`, caps output bytes, and ends with `child.stdin.end(options.input ?? '')` at line 1454 with **no** `child.stdin.on('error', ...)` listener and **no** timeout/kill escalation.
  - `src/consensus/panel/consensus-panel.ts:1147` — an independently duplicated copy of the same function with the identical gaps (`child.stdin.end` at 1147).
  - `src/consensus/provider-cli/subprocess.ts:119,127-132` — the newer stack's `runProviderSubprocess` has `child.stdin.on('error', () => {})` before `stdin.end`, and `child.kill('SIGTERM')` with SIGKILL escalation at 127-132.
  - Git history (architecture lane): `provider-cli/` (2026-06-19) postdates `consensus-loop.ts` (2026-06-16) and was never back-ported.

## Drift check

```bash
git diff --stat 8309623..HEAD -- src/consensus/core/consensus-loop.ts src/consensus/panel/consensus-panel.ts src/consensus/provider-cli/subprocess.ts
```

If `runProviderCliCommand` (either copy) changed, re-verify the gaps still exist. A material mismatch is a STOP condition.

## Repository conventions

- Build: `pnpm run build`; sync check: `pnpm run build:check`
- Typecheck: `pnpm run type-check`; Test: `pnpm test`; Validate: `npm run validate`
- Skill-version gate: `consensus-loop.ts` regenerates into the `refine` and `evaluate` skills' scripts; `consensus-panel.ts` regenerates into the `panel` skill's scripts — **bump those SKILL.md versions** (top-level + `metadata.version` in sync); confirm with `pnpm run validate:skill-versions -- --base-ref main`.
- Commits: Conventional Commits (e.g. `fix(consensus): add timeout escalation to wrapper subprocess path`). Do not push or open a PR unless instructed.

## Scope

### In scope

- `runProviderCliCommand` in `src/consensus/core/consensus-loop.ts` and its copy in `src/consensus/panel/consensus-panel.ts`: stdin error guard; optional deadline with SIGTERM→SIGKILL escalation, defaulted to preserve current behavior unless a caller passes a timeout.
- Wiring an actual timeout value at the call sites that already know a bounded expectation (only if a timeout/cap option already flows through the caller options — do not invent new user-facing flags).
- Tests under `tests/consensus/core/` and `tests/consensus/panel/`.
- Regenerated outputs + skill version bumps.

### Out of scope

- Merging the two subprocess stacks into one shared module — that is the consolidation plan (`2026-07-17-consolidate-consensus-cli-helpers.md`); this plan only closes the robustness gap and must not restructure imports or `build-generated.mjs` mappings.
- Changing retry/exit-code classification semantics (locked by prior work per the backlog history).
- New CLI flags or config surface.

## Current state

- `runProviderCliCommand(command, args, options)` returns a Promise resolving with captured stdout/stderr/exit info; output-byte caps exist; `providerCliSpawnTarget` redirects `.mjs` targets through `process.execPath`.
- `subprocess.ts:64-170` is the reference implementation for the escalation pattern: deadline timer → `SIGTERM` → grace window → `SIGKILL`, with the timer cleared on normal exit and UTF-8-safe truncation.
- Two copies must be changed identically; they are textually similar but independently maintained (drift risk — note the twin in a comment at each site).

## Implementation steps

### 1. Add the stdin error guard to both copies

Insert `child.stdin.on('error', () => {});` immediately before `child.stdin.end(...)` in `consensus-loop.ts` (~line 1454) and `consensus-panel.ts` (~line 1147), matching `subprocess.ts:119`.

**Verify:** `pnpm run type-check` → clean; `pnpm test -- tests/consensus/core/ tests/consensus/panel/` → green.

### 2. Add optional deadline with SIGTERM→SIGKILL escalation

In both copies, accept `timeoutMs` (and a small fixed kill-grace, mirroring `subprocess.ts`'s constants) via the existing options object. When set: start a timer on spawn; on expiry send `SIGTERM`, after the grace window send `SIGKILL`; resolve/reject with a distinguishable timeout outcome consistent with how `subprocess.ts` reports it. When unset: behavior identical to today. Clear timers on every exit path.

**Verify:** `pnpm run type-check` → clean.

### 3. Wire timeouts where a bound already exists

Inspect call sites of both copies (`grep -n "runProviderCliCommand(" src/consensus`). If the surrounding code already carries a provider timeout/cap concept (from config or constants), pass it through. If no existing bound exists, leave call sites unchanged and record that in the PR/commit body — inventing a default timeout is a behavior change out of scope.

**Verify:** `pnpm test` → green.

### 4. Tests

Using the existing stub-binary pattern (`tests/fixtures/bin/`): (a) a stub that ignores SIGTERM and sleeps → with `timeoutMs`, the runner SIGKILLs and reports a timeout outcome within the deadline+grace; (b) a well-behaved stub → no timeout side effects, timers cleared (test completes without open-handle warnings); (c) spawn failure (nonexistent non-`.mjs` target) with input → rejects cleanly, no unhandled `error` event.

**Verify:** focused suites pass: `pnpm test -- tests/consensus/core/ tests/consensus/panel/`.

### 5. Regenerate, bump versions, run the contract

Bump `refine`, `evaluate`, and `panel` SKILL.md versions (patch), then:

```bash
pnpm run build && pnpm run build:check && pnpm test && npm run validate && pnpm run validate:skill-versions -- --base-ref main
```

**Verify:** all exit 0; `git status --short` shows only expected files.

## Test plan

- New cases per step 4 in `tests/consensus/core/` and `tests/consensus/panel/` (pattern: existing subprocess-driven tests with fixture stub binaries; no mocks).
- Regression proven: a hung provider CLI can no longer hang a wrapper run when a bound is supplied; stdin writes after failed spawn cannot emit unhandled errors.
- Focused + full suite as in the steps.

## Done criteria

- [ ] Both copies have the stdin guard and optional escalation, behavior-identical when no timeout is set.
- [ ] Timeout escalation is test-proven against a SIGTERM-ignoring stub.
- [ ] `refine`/`evaluate`/`panel` SKILL.md versions bumped; full contract passes.
- [ ] `git status --short` clean of unexplained files.

## STOP conditions

- Live code no longer matches the verified evidence (drift).
- Wiring a timeout at a call site would change user-visible semantics of an existing configured cap (report the interaction instead of picking a value).
- The two copies have diverged enough that identical patches don't apply cleanly — stop and recommend running the consolidation plan first.
- Any verification gate fails twice after one bounded correction.

## Review focus

- Timer cleanup on all exit paths (leak-free under Vitest's open-handle detection).
- The timeout outcome's shape: consistent with `subprocess.ts` reporting so future consolidation is trivial.
- Deferred intentionally: unifying the duplicate copies (consolidation plan) and any default timeout policy.
