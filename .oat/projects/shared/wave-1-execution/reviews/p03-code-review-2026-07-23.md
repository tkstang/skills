# p03 Code Review — session-observer state robustness (disposition verification)

- Project: wave-1-execution, phase p03
- Branch: wave-1/p03 (head d66ae63), base ef3949b
- Contract: `.oat/repo/reference/external-plans/2026-07-17-session-observer-state-robustness.md`
- Prior round: Codex cross-model review (2 Critical + 1 Medium), all dispositioned FIXED in 2509a91 / 96f56f8
- Mode: READ-ONLY, disposition-verification (verify the fixes, not the claims)

## Verdict: FIXES_NEEDED

The Critical #2 (age-out) fix and the Medium (cache tmp-name) fix are genuine and
well-proven. The Critical #1 fix (unlink→rename reclaim) **narrows but does not
close** the two-contender theft race it targets: `tryReclaim` renames whatever
occupies the lock *path* without re-verifying it is the same stale instance
`isLockStale` observed, so a losing reclaimer can rename away the winning
reclaimer's freshly-created **live** lock. This reachable window contradicts the
plan's Done criterion ("Live-owner locks are never reclaimed") and its STOP
condition ("two contenders both reclaiming"), and the code's own comment overstates
the guarantee. Everything else (scope, generated-output sync, skill bump, focused
suites) is clean.

---

## Finding 1 — Critical: reclaim theft window not fully closed (Critical #1 fix incomplete)

- Files: `src/transcript/session-observer/lib/state.ts:157-202` (`tryReclaim` /
  `acquireLock`); identical twin `watch-state.ts:145-190`.
- Generated mirrors carry the same logic (`skills/session-observer/scripts/lib/state.mjs`, `watch-state.mjs`).

**The fix.** On `EEXIST`, `acquireLock` now does, at most once:
`(await isLockStale(lock)) && (await tryReclaim(lock))` then `continue` back to
`open(lock,'wx')`. `tryReclaim` replaces the old unconditional `unlink(lock)` with
`rename(lock, <unique .reclaim>)`, treating `ENOENT` as "lost the race."

**Why it does not fully close the race.** `rename`'s source is the lock *path*, not
the specific inode `isLockStale` inspected. The exclusivity argument in the twin
comment ("at most one contender's rename can ever succeed against a given stale
instance") is true **per inode**, but it does not prevent a rename from acting on a
**different, fresh** inode that has repopulated the path. Reachable interleaving
(two processes A, B, both recovering the same orphaned dead-PID lock `L_old` — the
exact scenario this plan exists to fix):

1. B: `isLockStale` reads `L_old` (dead PID) → true. B is now "authorized" to reclaim.
2. B's process is preempted between the `isLockStale` await and the `tryReclaim` await
   (no cross-process happens-before orders these).
3. A: `rename(L_old→A_claim)`, `unlink(A_claim)`, `continue`, `open('wx')` → creates
   fresh `L_A` with A's **live** PID. A now holds the lock and enters its critical
   section (readState/mutate/writeState — potentially many ms).
4. B resumes: `tryReclaim` → `rename(path=L_A → B_claim)` **succeeds** (source exists),
   detaching A's live lock. B returns true, `continue`, `open('wx')` → creates `L_B`.
5. A and B both believe they hold the lock → concurrent state.json mutation (lost
   update / the corruption the lock exists to prevent). Later A's unconditional
   `releaseLock` unlinks whatever is at the path (`L_B`), so a third contender can
   also enter while B is still active.

The vulnerable window is not a sub-instruction gap — it is the **entire duration A
holds the lock**, gated only on B being preempted at the `isLockStale`→`tryReclaim`
boundary (ordinary OS preemption under load). `tryReclaim` performs **no
re-verification** of what it renamed: after a successful rename it just unlinks the
claim and returns true, even if the claim file holds a live PID.

**Contract impact.** Violates Done criterion "Live-owner locks are never reclaimed
(test-proven)" (A is a live owner whose lock B reclaims) and the STOP condition
"reclaim design cannot avoid a theft race under test (two contenders both
reclaiming)." Probability in production is **low** (low-contention per-user CLI;
requires orphan + two simultaneous recoverers + a preemption at the exact
boundary), but the plan sets an explicit exclusivity bar and the code comment
asserts closure that is not achieved.

**Concrete remedy options.**
- Re-verify after claim: in `tryReclaim`, after `rename(lock→claim)`, read `claim`;
  if it contains a **live** PID, we grabbed a fresh lock — `rename(claim→lock)` back
  (best-effort) and return false. Removes the "both hold" outcome in the common case.
- Or gate reclamation behind a separate `open('wx')` reclaim lock (Codex's original
  "separate exclusive reclamation gate") so only one process runs the
  detect+remove+recreate sequence.

**Note on the regression test.** `state.test.ts:...` "two concurrent mutate calls…"
and its watch-state twin run **in a single process** with no control over the
`isLockStale`→`tryReclaim` interleaving, so they cannot reproduce step 2-4 above.
They pass by not triggering the window — they do not prove it closed. (They do have
some lost-update detection power, which is why they still add value.)

---

## Finding 2 — Low/Medium: new tests use real-time waits (virtual-clock discipline)

- Files: `state.test.ts` tests 14 & 16, `watch-state.test.ts` live-owner tests
  (`await sleep(300)` / `await new Promise(r=>setTimeout(r,300))`), plus
  `elapsed < 1000` assertions in the dead-PID/aged-garbage cases.

The plan's test plan states explicitly: "watch suites … use an injected virtual
clock — **do not introduce real-time waits in new tests**." The new cases use real
wall-clock sleeps (~1.2s of the suite's runtime) and wall-clock `elapsed` bounds.
The `settled === false after 300ms` assertions are logically robust (a live-PID
lock is never reclaimed regardless of elapsed time), but the `elapsed < 1000`
bounds are load-sensitive and could flake on a busy CI runner. Non-blocking, but it
deviates from the stated discipline and is worth tightening (e.g. deterministic
reclaim signal rather than an elapsed bound; avoid real sleeps).

---

## Adversarial probe (my own): empty lock mid-write between open and pid write

**Probe.** `acquireLock` creates the lock with `open(lock,'wx')` (empty file) and
only *then* `fh.write(String(pid))`. Between create and write, the lock exists with
**no PID content**. Could a fast contender B run `isLockStale` in that gap, read
empty content (`pid=null`), fall to the age branch, and reclaim a **live,
just-created** lock as identity-less garbage?

**Result: SAFE.** The age branch is `Date.now() - st.mtimeMs > LOCK_STALE_MS`
(`LOCK_RETRIES*LOCK_INTERVAL_MS` = 5000ms). A just-created lock's mtime is ~now, so
the delta is ~0ms « 5000ms → `isLockStale` returns false → no reclaim. The age
floor is exactly the protection for this window; write-ordering (create-then-write)
is fine because the age threshold guards the identity-less interval. No hole here.

(The genuinely reachable hole is Finding 1, which is a *different* mechanism —
renaming a fresh *identified* live lock, where staleness is never re-checked.)

---

## Deviation judgment (item 5): live PID never aged out

The implementation makes `isLockStale` trust a parseable live PID **unconditionally**
(`if (pid !== null) return !isPidLive(pid)`), applying the age fallback **only** when
no identity is readable — deliberately deviating from plan step 2's literal "dead PID
OR age" wording. **Verdict: the deviation honors WHAT-must-be-true and is
non-narrowing.** The plan's Done criterion ("Live-owner locks are never reclaimed,
test-proven") and Review focus (PID-reuse residual explicitly acceptable) make
never-age-out-a-live-owner the binding requirement; the literal "OR age" was the
weaker draft. Trusting live PIDs unconditionally strictly strengthens the invariant.
Backdated-1-hour live-PID non-reclaim is test-proven (state test 16 + watch-state
twin: `utimes(lock, -1h)` with own PID, asserts the mutate stays pending until
`unlink`). Correct and well-covered.

---

## Checklist

| # | Item | Result |
|---|------|--------|
| 1 | Critical #1 double-acquisition fully closed | **NO** — Finding 1: reclaim window reachable; `tryReclaim` does not re-verify the renamed instance |
| 2 | isLockStale trusts live PID unconditionally; age only w/o identity; backdated-live-PID regression asserts non-reclaim | PASS (state:116-136; tests 16 + watch twin) |
| 3 | reclaimAttempted once-per-acquisition; reclaim funnels through open('wx'); no .reclaim/.tmp residue | PASS (once-bound + `continue`→`open('wx')`; claim unlinked; residue asserted). Minor: rename-then-unlink-fail could leave a `.reclaim.` file (best-effort, acknowledged) |
| 4 | Own adversarial probe + result | Done — empty-mid-write probe → SAFE (age floor protects); reachable hole is Finding 1 |
| 5 | Live-PID-never-aged deviation honors WHAT-must-be-true | PASS — non-narrowing; strengthens invariant |
| 6 | Cache tmp = pid+timestamp+UUID; concurrent-save test; best-effort catch{} preserved | PASS (locate:158-165, `randomUUID`; concurrent test; outer catch:188) |
| 7 | Scope only in-scope src+tests+generated .mjs+SKILL.md; generated exact; SKILL 1.0.5→1.0.6 in sync; twin cross-ref comments | PASS — 10 files all in scope; `build:check` in sync; SKILL top-level + metadata both 1.0.6. Minor: state.ts names its watch-state twin explicitly, watch-state.ts's isLockStale/tryReclaim lack a reciprocal "mirrors state.ts" note |
| 8 | Focused suites green; virtual-clock discipline | Suites green (58 passed). Finding 2: new tests use real-time waits, contra plan guidance |

## Verification run

- `npx vitest run` state.test.ts + watch-state.test.ts + locate.test.ts → 3 files, 58 tests passed
- `pnpm run build:check` → all bundles in sync (session-observer-state / watch-state / locate)
- `git status --short` clean; `git diff --check` clean
- Scope: state.ts, watch-state.ts, locate.ts (+3 generated .mjs), 3 test files, SKILL.md

---

## Fix-round disposition verification (2026-07-23)

Append-only fix round verified against worktree head 2121b4d (branch wave-1/p03).
`git log` confirms the original 8 commits (9c48fc2…d66ae63) are unchanged and three
commits are appended: **e8e567f** (TOCTOU fix), **8017823** (deterministic
interleaving test + virtual-clock cleanup), **2121b4d** (regenerate outputs).
History is append-only. All three prior findings verified.

### Finding 1 (Critical TOCTOU) — VERIFIED, closed

- **Code (both twins).** `state.ts:167-227` and `watch-state.ts:157-217` now, after
  `rename(lock→claim)` succeeds, re-read the claimed file; if it parses to a **live**
  PID (`isPidLive`, trusted unconditionally as in `isLockStale`), the reclaimer
  `rename(claim→lock)` restores it best-effort and `return false` — it never unlinks a
  live owner's data, and on a failed restore it leaves an orphaned `.reclaim.` file
  rather than risk discarding live data. Only a genuinely ownerless claim (dead/no
  PID) is unlinked and reclaimed (`return true`). Logic is byte-identical across the
  two files. This is exactly the remedy Finding 1 recommended (re-verify claimed
  content).
- **Comment.** The header comment (state.ts:138-166 / watch-state.ts:128-155) now
  states the window precisely — rename is exclusive *per-inode* but its source is the
  *path*, so a preempted loser can detach a winner's fresh live lock — and the inline
  block (state.ts:198-210 / watch-state.ts:188-200) documents the accepted residual:
  POSIX `rename(src,dest)` has no fail-if-exists mode, so a THIRD contender that
  created a fresh lock during the claim→restore gap would be silently overwritten;
  full closure would need a separate exclusive reclaim-intent gate (larger structural
  change).
- **Residual judgment: ACCEPTABLE.** The demonstrated two-contender theft is closed
  (the loser now backs off through the normal retry path and never creates a competing
  lock). The remaining residual requires a *third* concurrent reclaimer/acquirer to
  win `open('wx')` inside the ~one-syscall claim→restore gap, nested inside an already
  rare orphan + simultaneous-reclaimer scenario — and it still funnels through
  `open('wx')`. It is of the same narrowness class the plan explicitly accepts
  (PID-reuse) and does not defeat the Done criterion in any realistically reachable
  way. Documented honestly rather than papered over.
- **Test.** New test 18 in both suites forces the exact interleaving deterministically:
  a one-shot `vi.mock('node:fs/promises')` rename interceptor lets a simulated winner
  "A" run a full `unlink(lock)`+`writeFile(lock, ownLivePID)` reclaim-recreate with
  **real fs calls** before B's intercepted rename proceeds against A's now-fresh live
  lock; it asserts B does **not** acquire (`Promise.race` → `'timed-out'`, `bSettled`
  false), that the sole surviving lock still holds A's PID, and no `.reclaim.` residue,
  then releases A and confirms B proceeds via the ordinary path. Present for **both**
  state and watch-state. **Revert-assessment:** against the pre-fix unconditional
  reclaim (unlink claim + `return true`), B would find the path empty after the
  interceptor and win its own `open('wx')` → resolve → the `'timed-out'` assertion
  fails. So the test genuinely discriminates the fix from the bug, corroborating the
  implementer's (non-committed) revert check.

### Finding 2 (real-time waits) — VERIFIED, resolved

- All `elapsed < 1000` wall-clock bounds replaced with a path-scoped `open('wx')`
  call counter asserting `opens < 5` (deterministic; count, not time). All
  `sleep(300)`/`setTimeout(300)` "stays pending" waits replaced with
  `vi.waitFor` keyed to a *second* `open('wx')` attempt (condition-driven), then
  asserting `settled === false`. No load-flaky upper-bound timing assertions remain.
- The single remaining bounded real-time wait is test 18's
  `Promise.race([pending, sleep(500)])` absence-proof, explicitly commented as the
  deliberate exception (proving a non-resolution has no fully deterministic signal;
  it asserts *which* branch wins, not elapsed duration, so it is not load-flaky in the
  failing direction). Acceptable.

### Finding 3 (twin cross-reference comments) — VERIFIED

- `state.ts` `tryReclaim` header: "Mirrors watch-state.ts's tryReclaim."; `watch-state.ts`
  `tryReclaim` header: "Mirrors state.ts's tryReclaim." — reciprocal. `isPidLive` in
  state.ts already names its watch-state twin. Test harnesses carry mirror notes too.
  (Nit, non-blocking: the `isLockStale` pair still lacks an explicit reciprocal
  "mirrors" line, but the complex duplicated logic — `tryReclaim` — is now covered
  both ways.)

### Verification run (fix round)

- `npx vitest run state.test.ts watch-state.test.ts` → 2 files, **40 passed**
- `pnpm run build:check` → `session-observer-state` / `session-observer-watch-state`
  **in sync**; `git status --short` clean
- History append-only; SKILL.md remains 1.0.6 (top-level + metadata), still ahead of
  main's 1.0.5 — one bump covers the whole PR.

## Final verdict: PASS

All three phase-review findings are resolved. The Critical TOCTOU window is closed
in both twins with a precise comment and an honestly-documented, narrower-than-
PID-reuse residual; the demonstrated theft is now proven closed by a deterministic
interleaving regression that discriminates the fix from the bug in both suites; the
real-time waits are replaced with call-count/condition-driven signals (sole
exception commented); twin cross-references are reciprocal. Suites green, generated
outputs in sync, history append-only.
