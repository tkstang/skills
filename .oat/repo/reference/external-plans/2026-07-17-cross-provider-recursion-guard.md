---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-enforce-recursion-depth-across
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Close the cross-provider host-recursion guard gap in the consensus provider CLI

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

The consensus provider CLI's host-recursion guard bounds *every* peer-spawn chain, not only chains where each hop uses the same provider as its host. Today an alternating-provider chain (claude→codex→claude→…) resets the depth counter at every hop because depth is only propagated on the `same_host` branch, so the documented recursion cap never triggers — unbounded process and API-cost growth. After this plan, `CONSENSUS_DEPTH` propagates to every spawned peer subprocess regardless of provider match, the depth cap is enforced across heterogeneous chains, and a regression test proves an A→B→A chain is blocked at the cap.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (security lane), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Verified evidence (read live at planning time):
  - `src/consensus/provider-cli/host-guard.ts:93-96` — `if (host.runtime !== provider) { return allowed('different_host', 'none'); }` returns before any depth check, and `allowed(...)` is called without the third `child_env` argument, so no depth env is produced for cross-provider spawns.
  - `src/consensus/provider-cli/host-guard.ts` (same function, `same_host` branch) — `childDepth = host.depth + 1` is computed and compared to `host.max_depth` only when `host.runtime === provider`; `buildChildHostEnv(host)` is only attached on that branch.
  - `src/consensus/provider-cli/structured-output.ts:146-156` — spreads `hostGuard.child_env` into the child environment; for a `different_host` result this spreads nothing, so `CONSENSUS_DEPTH` is dropped and the next hop starts from depth 0.
  - `tests/consensus/provider-cli/host-guard.test.ts` — exercises only same-provider chains; no test covers alternating providers.
  - Generated artifact `plugins/consensus/scripts/consensus.mjs` contains the same logic (generated from the canonical source; regenerate, never hand-edit).

## Drift check

Run before editing:

```bash
git diff --stat 8309623..HEAD -- src/consensus/provider-cli/ tests/consensus/provider-cli/ plugins/consensus/scripts/
```

If `host-guard.ts` or `structured-output.ts` changed, re-read the guard branch logic and compare with the evidence above. A material mismatch is a STOP condition.

## Repository conventions

- Build: `pnpm run build` → regenerates committed `.mjs` outputs under `plugins/` and `skills/`
- Typecheck: `pnpm run type-check` → clean
- Test: `pnpm test` → all Vitest suites pass (108 files / ~1090 tests at planning time)
- Generated-output sync: `pnpm run build:check` → clean
- Structure/manifest validation: `npm run validate` → clean
- Skill-version gate: any change under a canonical skill directory requires that skill's `SKILL.md` version bump; verify with `pnpm run validate:skill-versions -- --base-ref main`. Changes limited to `src/consensus/provider-cli/` regenerate `plugins/consensus/scripts/consensus.mjs` (plugin-level, not under a skill directory) — but run the validator anyway to confirm no skill-scoped output changed.
- Commits: Conventional Commits (e.g. `fix(provider-cli): enforce recursion depth across providers`). Do not push or open a PR unless instructed.

## Scope

### In scope

- `src/consensus/provider-cli/host-guard.ts` — depth propagation and cap semantics.
- `src/consensus/provider-cli/structured-output.ts` — only if the `child_env` spread site needs adjustment (it likely needs none once `child_env` is always populated).
- `tests/consensus/provider-cli/host-guard.test.ts` — new cross-provider cases.
- Regenerated `plugins/consensus/scripts/consensus.mjs` (via `pnpm run build`).

### Out of scope

- The same-host `max_depth` semantics and default value — unchanged.
- `src/consensus/core/consensus-loop.ts` spawn behavior — separate plans cover it.
- Any new global run-budget/cost-cap feature — this plan only fixes the existing guard's blind spot.

## Current state

- `evaluateHostGuard` (in `host-guard.ts`) receives `{ host, provider }`. `host` carries `runtime`, `depth`, `max_depth` parsed from `CONSENSUS_HOST`/`CONSENSUS_DEPTH`-family env vars. Three branches: unknown host → allowed, no guard; different host → allowed, no guard, **no child env**; same host → depth check, blocked at `childDepth > max_depth`, else allowed with `buildChildHostEnv(host)`.
- `buildChildHostEnv(host)` produces the env (including incremented depth) that `structured-output.ts:146-156` spreads into the spawned peer's environment.
- The design intent (host recursion guard) is recorded in `reference/decisions/DR-260619-consensus-peer-invocation*` — read it before implementing. If it explicitly documents cross-provider depth reset as intentional, that is a STOP condition (decision conflict to surface, not silently override).

## Implementation steps

### 1. Read the decision record and confirm intent

Read the DR under `.oat/repo/reference/decisions/` matching `DR-260619-consensus-peer-invocation*`. Confirm it describes a recursion/depth guard without explicitly endorsing cross-provider depth reset.

**Verify:** the DR describes bounding recursive peer spawns; no text authorizes unbounded cross-provider chains. If it does, STOP.

### 2. Propagate depth on the `different_host` branch

In `host-guard.ts`, change the `host.runtime !== provider` branch to compute `childDepth = host.depth + 1`, block with `HOST_RECURSION_BLOCKED` when `childDepth > host.max_depth` (message should name the cross-provider chain), and otherwise return `allowed('different_host', 'subprocess_isolated', buildChildHostEnv(host))`. Ensure `buildChildHostEnv` emits the incremented depth and preserves `max_depth` (and run-id if present) regardless of provider. Keep the `unknown` branch as-is.

**Verify:** `pnpm run type-check` → clean.

### 3. Add cross-provider regression tests

In `tests/consensus/provider-cli/host-guard.test.ts`, mirroring the existing same-provider cases, add: (a) a `different_host` spawn returns `allowed` **with** a populated `child_env` carrying incremented depth; (b) a simulated alternating chain (feed each hop's `child_env` back as the next host context with the alternate provider) reaches `HOST_RECURSION_BLOCKED` at `max_depth`; (c) the `unknown` host branch still allows with no env.

**Verify:** `pnpm test -- tests/consensus/provider-cli/host-guard.test.ts` → all cases pass, including the new ones.

### 4. Regenerate outputs and run the full contract

```bash
pnpm run build && pnpm run build:check && pnpm test && npm run validate && pnpm run validate:skill-versions -- --base-ref main
```

**Verify:** all commands exit 0; `git status --short` shows only `host-guard.ts`, the test file, and regenerated generated outputs.

## Test plan

- New cases in `tests/consensus/provider-cli/host-guard.test.ts` (pattern: existing same-provider depth tests in the same file).
- Regression proven: an alternating-provider chain that previously reset depth at each hop now blocks at `max_depth`.
- Focused: `pnpm test -- tests/consensus/provider-cli/host-guard.test.ts` → pass.
- Full: `pnpm test` → no regressions in the ~30 provider-cli suites (env-propagation changes can surface in `structured-output`/integration tests — failures there mean the env contract changed more than intended; reconcile before proceeding).

## Done criteria

- [ ] `evaluateHostGuard` enforces the depth cap for cross-provider spawns and emits `child_env` on every allowed result with a known host.
- [ ] New tests cover different-host allow-with-env, alternating-chain block, and unknown-host behavior.
- [ ] `pnpm run build && pnpm run build:check && pnpm test && npm run validate` all pass.
- [ ] `git status --short` contains no unexplained files.

## STOP conditions

- The decision record explicitly documents cross-provider depth reset as intentional (report the decision conflict instead of implementing).
- Live guard code no longer matches the evidence above (drift).
- Propagating `child_env` on the `different_host` branch breaks provider-cli integration tests in ways that suggest peers depend on the *absence* of the host env (report; do not weaken the guard to pass tests).
- Any verification gate fails twice after one bounded correction.

## Review focus

- Semantics choice: this plan counts depth across the whole chain with the existing `max_depth`. If reviewers want a separate cross-provider cap, that is a design extension — flag, don't improvise.
- Confirm the generated `consensus.mjs` diff is exactly the regenerated output (no hand edits).
- Deferred: a global run-budget (cost cap) across chains is a follow-up feature, intentionally not built here.
