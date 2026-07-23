---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-session-observer-stale-lock
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Add stale-lock recovery and atomic cache writes to session-observer state stores

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

A crashed session-observer process can no longer permanently wedge state persistence. Today, a SIGKILL between lock creation and the `finally` cleanup orphans `state.json.lock`/`watch.json.lock` forever: every later invocation blocks ~5 seconds, throws, and (because most callers swallow the error) silently loses all read-offset and watcher tracking until a human deletes the lock by hand. After this plan, lock acquisition detects and reclaims stale locks (dead owner PID or age beyond threshold), and the codex cwd cache is written atomically like the module family's other state files.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (correctness lane), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Verified evidence (read live at planning time):
  - `src/transcript/session-observer/lib/state.ts:83-97` — `acquireLock` loops `LOCK_RETRIES` times on `EEXIST` then throws; the lock file is created empty (`open(lock, 'wx')` then immediate close); the only unlink path is the holder's own `finally { releaseLock() }`.
  - `src/transcript/session-observer/lib/watch-state.ts:~86-100` — identical pattern for `watch.json.lock` (source-lane claim; spot-verify at execution).
  - `src/transcript/session-observer/lib/watch-state.ts:~178-215` — `isPidLive` (`process.kill(pid, 0)`) already exists for watcher-entry staleness, but is not applied to lock files.
  - `src/transcript/session-observer/lib/locate.ts:140-147` — `saveCwdCache` does a bare `writeFile` with no lock and no temp+rename; `loadCwdCache` treats parse failure as empty cache (silent data loss, not crash).
  - Atomic-write pattern to copy: `state.ts:226-256` (temp + fsync + rename).

## Drift check

```bash
git diff --stat 8309623..HEAD -- src/transcript/session-observer/lib/ tests/session-observer/ skills/session-observer/
```

If `state.ts`, `watch-state.ts`, or `locate.ts` changed, re-verify the lock-acquire and cache-write sites against the evidence above. A material mismatch is a STOP condition.

## Repository conventions

- Build: `pnpm run build` → regenerates `skills/session-observer/scripts/lib/*.mjs` (generated, never hand-edit)
- Typecheck: `pnpm run type-check` → clean
- Test: `pnpm test` → all suites pass; session-observer suites live under `tests/session-observer/`
- Generated-output sync: `pnpm run build:check` → clean
- Skill-version gate: changes regenerate outputs under `skills/session-observer/` — **bump `skills/session-observer/SKILL.md` version** (top-level and `metadata.version` in sync); confirm with `pnpm run validate:skill-versions -- --base-ref main`.
- Dogfooding convention (AGENTS.md): after closeout, refresh the user-level install `~/.agents/skills/session-observer/` and run `oat sync --scope user` — but only reconcile machine-wide from `main` after merge.
- Commits: Conventional Commits (e.g. `fix(session-observer): recover stale state locks`). Do not push or open a PR unless instructed.

## Scope

### In scope

- `src/transcript/session-observer/lib/state.ts` — lock file carries owner PID; `acquireLock` gains one bounded stale-lock reclaim.
- `src/transcript/session-observer/lib/watch-state.ts` — same treatment for `watch.json.lock` (share the helper if practical without new build mappings; otherwise mirror it).
- `src/transcript/session-observer/lib/locate.ts` — `saveCwdCache` becomes temp+rename.
- Tests under `tests/session-observer/`.
- Regenerated `.mjs` outputs + `session-observer` SKILL.md version bump.

### Out of scope

- Adding the full lock protocol to the cwd cache (it is a soft cache; atomic write is enough).
- `skills/session-observer-collab/` lease-state logic — separately owned, already hardened.
- Changing lock retry counts/intervals for the healthy path.

## Current state

- Lock files are empty markers; there is no owner identity recorded, so staleness must be established before reclaim is safe.
- Two racing processes must not both reclaim: the reclaim must be unlink-then-retry-`open('wx')` (the winner of the second `wx` open owns the lock), never an unconditional overwrite.
- `isPidLive` exists in `watch-state.ts`; `state.ts` has no equivalent today.

## Implementation steps

### 1. Record owner PID in lock files

In `state.ts` `acquireLock`, write `String(process.pid)` into the lock file before closing (same for `watch-state.ts`'s variant). Keep creation `wx`-exclusive.

**Verify:** `pnpm test -- tests/session-observer/` → existing lock tests still pass.

### 2. Add bounded stale-lock reclaim

On `EEXIST`: read the lock file; if it contains a PID that is not live (`process.kill(pid, 0)` throwing `ESRCH`), or the lock's mtime is older than a stale threshold (use `LOCK_RETRIES * LOCK_INTERVAL_MS` as the floor; a lock older than the entire retry window cannot belong to a healthy writer), `unlink` it and immediately retry `open(lock, 'wx')`. Attempt reclaim at most once per acquisition; unreadable/empty lock files fall back to the age check. Apply identically in `watch-state.ts` (extract a shared helper only if it does not require new `build-generated.mjs` mappings — otherwise duplicate deliberately with a comment naming the twin).

**Verify:** `pnpm run type-check` → clean.

### 3. Make `saveCwdCache` atomic

In `locate.ts:140-147`, write to a same-directory temp file and `rename` over `codex-cwd-cache.json`, preserving the existing best-effort `catch {}` (cache writes must stay non-fatal).

**Verify:** `pnpm test -- tests/session-observer/` → locate/discovery tests pass.

### 4. Add stale-lock and atomicity tests

In the state suites under `tests/session-observer/` (pattern: existing real-temp-dir tests, no mocks): (a) pre-create a lock file containing a dead PID → acquisition succeeds without the full retry wait; (b) pre-create a lock with the *current* process PID (live owner) → acquisition still times out and throws (no theft from live owners); (c) empty/garbage lock older than the stale threshold → reclaimed; (d) `saveCwdCache` leaves no `*.tmp` residue and produces parseable JSON.

**Verify:** `pnpm test -- tests/session-observer/` → new cases pass.

### 5. Regenerate, bump the skill version, run the contract

Bump `skills/session-observer/SKILL.md` (patch), then:

```bash
pnpm run build && pnpm run build:check && pnpm test && npm run validate && pnpm run validate:skill-versions -- --base-ref main
```

**Verify:** all exit 0; `git status --short` shows only canonical sources, tests, SKILL.md, and regenerated outputs.

## Test plan

- New cases as in step 4; structural pattern: existing `tests/session-observer/state`/`watch-state` suites (temp dirs, injected clocks where present).
- Regressions proven: orphaned lock no longer wedges persistence; live locks are never stolen; cache write can no longer leave partial JSON.
- Focused: `pnpm test -- tests/session-observer/` → pass.
- Full: `pnpm test` → no regressions (watch suites are timing-sensitive; they use an injected virtual clock — do not introduce real-time waits in new tests).

## Done criteria

- [ ] Lock files record owner PID; stale locks (dead PID or over-age) are reclaimed exactly once per acquisition attempt.
- [ ] Live-owner locks are never reclaimed (test-proven).
- [ ] `saveCwdCache` is temp+rename atomic.
- [ ] `session-observer` SKILL.md bumped; full contract passes; `git status --short` clean of unexplained files.

## STOP conditions

- Live code no longer matches the verified evidence (drift).
- The reclaim design cannot avoid a theft race under test (two contenders both reclaiming) — report the race rather than shipping a weaker exclusivity guarantee.
- Sharing a helper between `state.ts` and `watch-state.ts` would require new `build-generated.mjs` mappings and cascading config edits — prefer deliberate duplication; if that feels wrong, stop and surface the tradeoff.
- Any verification gate fails twice after one bounded correction.

## Review focus

- The reclaim path's race window: reclaim must funnel back through `open('wx')` so exactly one contender wins.
- PID reuse edge case: a recycled PID that happens to be live keeps the lock until the age threshold — acceptable and worth a code comment.
- Deferred intentionally: lock-protocol for the soft cwd cache; any cross-process lock metrics.
