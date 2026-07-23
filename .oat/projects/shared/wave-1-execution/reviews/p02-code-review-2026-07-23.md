# Phase p02 Code Review — Cross-provider recursion guard

- Project: wave-1-execution
- Phase: p02
- Branch/commit: wave-1/p02 @ ad21e89
- Base: ef3949b5be35f101c0c82e0bb29cb9c777df29a1 (`git diff ef3949b...wave-1/p02`)
- Worktree read: /Users/tstang/Code/repo-improve-2/.worktrees/wave-1/p02
- Contract plan: .oat/repo/reference/external-plans/2026-07-17-cross-provider-recursion-guard.md
- Reviewer mode: READ-ONLY, disposition-verification (verifying the transcribed Codex xreview at scratchpad/wave1-p02-xreview.md, plus independent adversarial analysis)
- Date: 2026-07-23

## Verdict: PASS

The `different_host` branch of `evaluateHostGuard` now mirrors the `same_host`
branch exactly (`childDepth = host.depth + 1`, block when `> max_depth`, else
allow with `buildChildHostEnv(host)`). The change is strictly monotone-stronger:
the `different_host` branch previously blocked nothing, so no previously-blocked
input can become allowed on any branch, and the `unknown`/`same_host` branches
are byte-for-byte unchanged. Depth now propagates cross-provider via the
unchanged env contract, the generated `consensus.mjs` is an exact regeneration
(build:check in sync, no hand edits), scope is exactly the 3 planned files, the
decision record contains no cross-provider-reset endorsement, and the full
Vitest suite (1094 passed / 1 skipped), type-check, and build:check are green.
No cross-provider-specific cap was invented — whole-chain depth under the
existing `max_depth`, as the plan's Review focus requires.

## Independent verification of xreview claims

The transcribed Codex xreview verdict was PASS with: 128-case matrix zero
blocked->allowed, child_env populated on different-host allow, mjs in sync,
type-check clean, whitespace clean, full suite 1094/1. I re-derived the
weaker-anywhere result analytically (below), and independently confirmed:
child_env population (host-guard.ts:112-116), mjs sync (`pnpm run build:check`
=> `consensus-provider-cli: in sync`), type-check (`tsc --noEmit` clean), and
the 1094 passed / 1 skipped test count. xreview claims stand.

## Adversarial probes (my own) and results

Analyzed `host-guard.ts:93-138` over the full input domain
(host undefined/unknown/same/different x depth 0..max x max_depth incl. <=0 x
NaN/missing depth). `parseNonNegativeInteger` maps missing/NaN/negative-looking
`CONSENSUS_DEPTH` to `undefined` -> `?? 0`, so `host.depth` is always a
non-negative integer on both branches; no asymmetry in parsing.

- Probe A — boundary `childDepth == max_depth` (depth=0, max_depth=1,
  claude->codex): crossDepth=1, `1 > 1` false => ALLOWED, child_env DEPTH=1.
  same_host with identical inputs: childDepth=1 => ALLOWED. PARITY; no
  off-by-one. Matches test case 1.
- Probe B — chain already AT cap (depth=1, max_depth=1, claude->codex):
  crossDepth=2, `2 > 1` => BLOCKED. same-provider identical inputs: childDepth=2
  => BLOCKED. Identical behavior — a claude->codex chain at cap behaves exactly
  like same-provider. Matches test case 2.
- Probe C — degenerate `max_depth=0` (depth=0): crossDepth=1 `> 0` => BLOCKED on
  both branches. Previously `different_host` was unconditionally ALLOWED even at
  max_depth=0; now blocked => STRONGER, not weaker.
- Probe D — NaN/missing depth: -> depth 0 -> crossDepth 1, handled identically
  to same_host. No newly-allowed input.
- Probe E — weaker-anywhere sweep: `different_host` previously returned
  `allowed('different_host','none')` for ALL inputs (blocked nothing). New code
  yields only allow-with-env (formerly-allowed, still allowed) or block
  (formerly-allowed, now blocked). Zero blocked->allowed transitions exist on
  any branch; `unknown` and `same_host` untouched. CONFIRMED no weaker-anywhere.

## Detailed checks

### 1. Semantics parity (different_host vs same_host)
`host-guard.ts:94-95` `crossDepth = host.depth + 1` and `crossDepth > host.max_depth`
are identical arithmetic and block condition to `same_host` at lines 119-120.
Only differences are cosmetic: `host_relation` label and message/warning text.
No asymmetry.

### 2. Env contract
`buildChildHostEnv` (lines 76-82) is unchanged/verbatim — still emits exactly
`CONSENSUS_RUN_ID`, `CONSENSUS_PARENT_HOST` (= host runtime), `CONSENSUS_DEPTH`
(incremented). No key added/removed. Consumer `structured-output.ts:150-156`
spreads `...hostGuard.child_env` (unchanged); now populated for `different_host`.
`buildChildEnvironment` (runtime-policy.ts:124-144) applies the env allowlist
only to parent env, then spreads `...hostEnv` (which carries the guard env)
AFTER — so the host guard keys bypass the allowlist and always propagate for
cross-provider spawns. For `unknown` host, `child_env` is absent; spreading
undefined is a no-op (correct).

### 3. Generated output
`plugins/consensus/scripts/consensus.mjs` diff is exactly the regenerated
`evaluateHostGuard` hunk (`->` emitted as `→`), no hand edits, no unrelated
churn. `pnpm run build:check` => `consensus-provider-cli: in sync`.

### 4. Tests (4 new cases)
- different_host allow-with-env, DEPTH '1' (asserts child_env) — matches report.
- different_host block at cap — asserts HOST_RECURSION_BLOCKED + warnings.
- alternating chain — a REAL chain sim: feeds `result.child_env.CONSENSUS_DEPTH`
  back into the next `host.depth`, breaks the loop on block, asserts 3 results
  (allow d1, allow d2, block). Not three independent calls.
- unknown host allows with no child_env.
All 4 assert what the phase report claims. `pnpm test -- tests/consensus/provider-cli/`
=> 1094 passed / 1 skipped.

### 5. Decision record
`.oat/repo/reference/decisions/DR-260619-consensus-peer-invocation.md` lists
"host recursion guard" as a CLI responsibility and contains NO text endorsing or
authorizing cross-provider depth reset. No decision conflict / no STOP condition.

### 6. Plan review-focus
Semantics choice implemented as documented: whole-chain depth under the existing
`max_depth`; NO separate cross-provider cap invented. Message names the
cross-provider chain. Consistent with plan Review focus.

## Observations (informational, non-blocking)

- The alternating-chain test manually sets `host.runtime = provider` each hop to
  keep every evaluation on the `different_host` branch. In a real spawn,
  `buildChildHostEnv` sets `CONSENSUS_PARENT_HOST` to the current host runtime,
  which `detectHostRuntime` reads first — so a real deep chain would tend to pin
  the detected host runtime to the root and land some hops on `same_host`. This
  does NOT weaken the test's value: the security invariant (depth increments and
  the chain is bounded at the cap) now holds IDENTICALLY on both branches, so the
  chain is bounded regardless of which branch each hop takes. The test correctly
  carries the security-relevant value (depth) forward. Noted for context only;
  not a finding.

## Checklist

| # | Item | Result |
|---|------|--------|
| 1 | Weaker-anywhere: no previously-blocked input now allowed | PASS (Probe E; monotone-stronger) |
| 1a | Boundary childDepth == max_depth parity | PASS (Probe A) |
| 1b | Chain at cap == same-provider behavior | PASS (Probe B) |
| 1c | Degenerate max_depth<=0 | PASS — stronger (Probe C) |
| 1d | Missing/NaN depth parsing | PASS (Probe D) |
| 2 | different_host depth arithmetic/block mirrors same_host | PASS |
| 3 | buildChildHostEnv verbatim; consumers carry env; no key add/remove | PASS |
| 3a | consensus.mjs = exact regeneration, no churn (build:check) | PASS |
| 4 | 4 new tests assert report claims; chain is real sim | PASS |
| 4a | Focused suite green | PASS (1094 passed / 1 skipped) |
| 5 | DR has no cross-provider-reset endorsement | PASS |
| 6 | Whole-chain semantics documented; no new cap invented | PASS |
| - | type-check | PASS (tsc --noEmit clean) |
| - | Scope = 3 planned files only | PASS |

## Findings requiring implementer action

None.
