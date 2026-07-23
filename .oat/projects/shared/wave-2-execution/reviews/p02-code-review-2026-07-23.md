---
phase: p02
branch: wave-2/p02
commits:
  - de4ff6c (perf(session-observer): cache transcript classification in watch loop)
  - ecb9a45 (fix(p02-t01): derive classification and meta from one parsed-record pass)
  - e25749f (fix(p02-t01): raise classification cache default cap to avoid scan thrashing)
base: df9b89965616e0e5c1164f596f06fccf304aee1
contract: .oat/repo/reference/external-plans/2026-07-17-watch-loop-classification-cache.md
reviewed_at: 2026-07-23
reviewer: code-review subagent (read-only, live worktree at .worktrees/wave-2/p02)
verdict: APPROVE
---

# p02 code review — watch-loop classification cache

## Verdict

**APPROVE.** The three-commit series delivers exactly the outcome the contract specifies — a
signature-keyed classification cache threaded through the watch loop's per-tick discovery —
and the two prior Codex-round findings (single-pass meta derivation, 300→5000 cap) are both
genuinely fixed, not just claimed fixed: I re-derived both from first principles against the
live diff rather than trusting the commit messages. `pnpm run type-check`, `pnpm run
build:check`, `node scripts/validate-skill-versions.mjs`, and the full `tests/session-observer/`
suite (208/208) all pass clean in the worktree. No action items block merge; one minor
documentation gap (the plan's requested "note as follow-up" for the deferred directory-mtime
short-circuit) is not present anywhere in the diff, phase artifacts, or backlog and should be
captured before this phase's contract is considered fully closed out.

## 1. Plan review-focus items

**mtime-granularity residual — documented.** `locate.ts:97-101` carries an explicit comment:
a same-size/same-mtime rewrite on a coarse-mtime filesystem could be missed; judged acceptable
because cached candidates are past, non-watched sessions not expected to be rewritten in place
during a live watch. This satisfies the plan's "note the residual edge in a comment" requirement
verbatim.

**Memory bound — sane, and I independently verified the estimate.** Cap is `5000`
(`DEFAULT_CLASSIFICATION_CACHE_MAX_ENTRIES`, `locate.ts:127`). Each entry is `{ mtimeMs, size,
result: { meta: {sessionId, recordedCwd}, classification: {status, engaged, recordCount,
genuineUserMessages, syntheticUserMessages, assistantMessages, realMessageCount,
hasAssistantAndUser, bootstrapRecordIndexes, bootstrapRecordCount} } }` — no transcript content,
only derived scalars plus a Map key string (an absolute transcript path, typically 100-150
chars). Back-of-envelope: ~4 nested small objects (~40-80 bytes V8 overhead each) + ~7 numeric/
boolean fields (~8 bytes each) + 2 short strings (sessionId, recordedCwd, ~50-200 UTF-16 bytes
combined) + Map key/bucket overhead (~300-400 bytes including the path string) ≈ 800 bytes-1.2KB
per entry. At 5000 entries that is roughly **4-6 MB worst case**, matching the code comment's own
claim of "a low single-digit-MB bound." Sane for a long-lived watch process.

**Deferred directory-mtime short-circuit — NOT noted as a follow-up anywhere (finding, Minor).**
The plan's Review focus says: "Deferred intentionally: persistent cross-process cache;
directory-mtime short-circuit for skipping discovery entirely ... note as follow-up." I searched
the full diff (`git diff df9b899..HEAD | grep -i "follow-up\|directory-mtime\|deferred"`), the
locate.ts doc comments, all three commit messages, the wave-2-execution `plan.md`/`state.md`/
`implementation.md`, and the `BL-260718-cache-transcript` backlog item (still `status: open`,
acceptance criteria only cover the cache itself) — no code comment, phase report, or backlog
note captures the directory-mtime short-circuit as a deferred follow-up. This item is not covered
by the plan's own explicit "Out of scope" section either (that section lists on-disk caching,
poll-cadence changes, and observable-output changes — not this). So per the task's own escape
hatch ("absence in code is fine if the deferral is per plan's own Out-of-scope") this is not
excused. It is a documentation-only gap with no behavioral risk — recommend a one-line addition
to the `ClassificationCache` doc comment or a backlog note before closing the phase, not a
blocker for this diff.

## 2. Behavioral equivalence

`npx vitest run tests/session-observer/` in the worktree: **10 files, 208 tests, all pass**
(11.15s wall / 34.6s test time).

I independently re-derived the `extractMeta`/`extractMetaFromRecords` split in
`src/transcript/core/runtimes.ts` line-by-line against the pre-change version rather than
trusting the commit message. The diff is:

```
export async function extractMeta(runtime, transcriptPath) {
  const records = await readRecords(transcriptPath);
  return extractMetaFromRecords(runtime, records, transcriptPath);
}

export function extractMetaFromRecords(runtime, records, transcriptPath) {
  if (runtime === 'claude-code') { ...unchanged body... }
  if (runtime === 'codex') { ...unchanged body... }
  if (runtime === 'cursor') { ...unchanged body... }
}
```

Every branch's body (claude-code sessionId scan + `decodeCwdDirName`, codex sessionId/cwd scan
with `payload.cwd` fallback, cursor basename/parent-dir logic) is byte-identical to the
pre-change `extractMeta`, just relocated into the new synchronous function; `extractMeta` is now
a thin two-line wrapper. This is a pure refactor, not a behavior change — confirmed by direct
read, not inference.

## 3. Cache correctness

**Keying and invalidation.** `ClassificationCache.get(path, mtimeMs, size)` rejects on either
component mismatching the stored entry and lazily deletes the stale entry (`locate.ts:157-173`).
`candidateDerivedFields` (`locate.ts:213-234`) is the single choke point: on miss it does exactly
one `readRecords()` call, derives both `classification` (`classifyTranscriptRecords`) and `meta`
(`extractMetaFromRecords`) from that one parse, and stores both together — satisfying "entries
keyed (path, mtimeMs, size) hold {meta, classification} from ONE readRecords pass."

**Torn-read reasoning (stat-then-read race).** Discovery calls `stat()` first, then passes that
signature into `candidateDerivedFields`, which on a miss calls `readRecords()` afterward — so if
a candidate file is concurrently rewritten between the `stat()` and the `readRecords()`, the read
can observe more (or different) bytes than the signature that will be used as the cache key. I
traced this through to its actual consequence: the mis-keyed entry is stored under the *pre-write*
`(mtimeMs, size)`, but the file's *true* signature after the write completes is different (content
changes essentially always change `size`, and in practice `mtimeMs` too). On the *next* poll tick,
`stat()` reads the new, final signature and `cache.get()` looks up that new signature — which
cannot match the stale entry stored under the old one — producing a miss, a fresh accurate
re-read, and an overwrite of the bad entry. **Conclusion: self-healing, not stale-forever**, with
a bounded worst case of exactly one poll tick (default 2s) serving a possibly-torn read before
self-correcting. This is not a regression introduced by the cache — the pre-existing uncached
code had the identical stat-then-read race on every tick with no cache at all — and in practice
it is close to non-issue for this cache's actual target: cached candidates are, per the plan's
own "Current state," *past, non-watched* sessions that are not expected to be under concurrent
write during a live watch (the transcript that is being actively written is the watched target,
which this cache is explicitly not trying to help). I did not find any code path where a torn
read's captured signature could coincidentally match the eventual stable signature (that would
require the file to be truncated back to an identical byte count after further writes, which does
not happen for append-only JSONL transcripts) — so there is no realistic "stale-forever" case.

**Failure handling.** A `readRecords`/parse failure in `candidateDerivedFields` returns
`UNKNOWN_CLASSIFICATION`/`null` meta **without calling `cache.set`** (`locate.ts:229-233`) — a
transient read failure does not poison the cache for when the file becomes readable again. Good.

## 4. Codex-Important fix (single-pass meta derivation)

Confirmed by call-site trace, not by re-reading the commit message: `grep -n "extractMeta\b"
src/transcript/session-observer/lib/locate.ts` shows exactly one remaining call to the async,
full-file-read `extractMeta` — inside `discoverCodex`'s own `cwdCache` miss branch
(`locate.ts:608`), which is codex's pre-existing, untouched, persistent cross-process cwd cache.
`discoverClaudeCode` and `cursorCandidate`/`discoverCursor` no longer call `extractMeta` at all;
both now go exclusively through `candidateDerivedFields` → `extractMetaFromRecords` (synchronous,
over already-parsed records, cached). This closes the exact gap the Codex round flagged: a
claude-code/cursor cache *hit* now costs zero I/O for meta as well as classification. The
`watch.test.ts` addition (`classification cache: a static newer-candidate transcript is
classified once across many poll ticks`) proves this at the integration level by wrapping
`readRecords` and asserting the candidate's read count stays at `1` across ~60+ poll ticks
(`tests/session-observer/watch.test.ts:565-660`), while also asserting the watched (actively
written) transcript's read count stays flat and sub-linear in tick count — i.e., the cache change
alters *how* classification is computed but not *what* watch events are produced (dedup count
still exactly 1 for the surfaced candidate).

## 5. LRU cap

Default raised to `5000` (`DEFAULT_CLASSIFICATION_CACHE_MAX_ENTRIES`, `locate.ts:127`), with a
~35-line doc comment (`locate.ts:103-119`) correctly framing this as a workload property, not
an eviction-policy defect: every `discover()` call is a full linear pass over one directory's
candidates, so a cap smaller than the candidate count guarantees the *next* pass's misses land
exactly on the keys the pass after that needs again — no eviction policy escapes that.

I read both new tests against `simulateScan`, which mirrors the actual `discover()` access
pattern (get-or-populate-on-miss per key, not blind-populate-then-read):

- `a small cap thrashes under repeated full-directory scans exceeding it` — cap=100, 101 unique
  keys, 3 full passes, asserts the **third** pass's hit count is `0` (steady-state thrash, not a
  one-tick artifact — the test comment correctly notes the first pass is trivially all-misses on
  an empty cache and the second pass is mid-cascade, so only the third is a valid steady-state
  assertion). This matches the report's claim.
- `the default capacity comfortably survives repeated realistic long-lived project directory
  scans` — default cap (5000), 2000 candidate keys, 3 full passes, asserts pass 2 and pass 3 both
  hit `2000/2000` (zero re-derivation from the second pass onward). This matches the report's
  claim of "2000 candidates zero re-derivation."

Both tests assert exactly what the commit message and doc comment claim; no gap between claim and
test.

## 6. Hygiene

- **SKILL.md bumps:** `skills/session-observer/SKILL.md` 1.0.6→1.0.7 (top-level `version` and
  `metadata.version` both bumped, in sync) landed in `de4ff6c`; `skills/export-session-transcript/
  SKILL.md` 1.0.3→1.0.4 landed in `ecb9a45`. `node scripts/validate-skill-versions.mjs --base-ref
  df9b89965616e0e5c1164f596f06fccf304aee1` passes: "2 changed skill(s) verified."
- **Generated-runtime diff exactness:** `diff skills/session-observer/scripts/lib/runtimes.mjs
  skills/export-session-transcript/scripts/lib/runtimes.mjs` → **identical** (both mirror the same
  shared `src/transcript/core/runtimes.ts`). The diff to `skills/export-session-transcript/
  scripts/lib/runtimes.mjs` is exactly the `extractMeta`/`extractMetaFromRecords` split plus the
  new export, matching the source diff line-for-line — nothing hand-added or drifted.
  `pnpm run build:check` passes clean across all 27 generated-output pairs, including
  `session-observer-locate`, `session-observer-watch`, and `transcript-core-*`.
- **`core/runtimes.ts` change was necessary and in-scope.** The only production change there is
  the `extractMetaFromRecords` extraction — required so `locate.ts`'s single-pass
  `candidateDerivedFields` can derive meta from already-parsed records without re-reading. This is
  squarely "threading the cache through call paths," not a test-instrumentation-driven production
  change — I verified this is architecturally distinct from the *test* seam change (which moved
  the read-counting mock from wrapping `classifyTranscript` to wrapping `readRecords`, a
  test-only file). No finding.
- **`build:check`/`type-check`/validators:** all clean (`pnpm run build:check`, `pnpm run
  type-check`, `node scripts/validate-skill-versions.mjs`) — see command output captured during
  this review.
- **Conventional commits:** all three (`perf(session-observer): ...`, `fix(p02-t01): ...` ×2)
  conform.
- **No `.oat/projects` writes:** `git status --short` in the worktree is clean; `git diff
  df9b899..HEAD -- .oat/` is empty. (The `BL-260718-cache-transcript` backlog item at repo root
  remains `status: open` — expected, since per-phase reviews inside a wave don't own backlog
  close-out; flagging only because it's the natural place the missing "follow-up" note from
  finding §1 could land.)

## 7. Adversarial probe (own)

**Probe: two watch targets in the same directory sharing one `ClassificationCache` instance —
cross-target contamination?** I traced this against live code, not hypothetically: `runWatchLoop`
constructs exactly **one** `ClassificationCache` per process (`watch.ts:1103-1108`) and
`emitNewerSessionCandidates` loops `for (const target of targets.values())`, passing the *same*
`classificationCache` and the *same* `args.cwd` into every target's `findNewerSameCwdCandidates`
call (`watch.ts:872-895`). `WatchTarget`/`targets: Map<string, WatchTarget>` (`watch.ts:46-56`,
`establishBaseline`) confirms a single watch process genuinely can hold multiple concurrent
targets (keyed by `runtime:sessionId`) — so this scenario is not contrived, it is real production
usage (e.g. watching two sessions in the same project directory simultaneously). Reasoning: cache
correctness depends only on `(path, mtimeMs, size)`, never on which target issued the query, and
`discover()` for a given `(runtime, cwd)` returns the identical candidate set regardless of which
target is asking — the per-target exclusion of "don't surface my own watched session as a
candidate" happens as a *filter* in `findNewerSameCwdCandidates` *after* `discover()` returns,
never inside the cache. **Verdict: no contamination is possible** — sharing the cache instance
across targets in the same watch process is the intended design, not an accepted residual.

**Second probe (as suggested by the task): a transcript replaced by a same-size, same-mtime,
different-content file.** This is exactly the residual the code comment already documents
(`locate.ts:97-101`, "Residual edge") — I did not find a distinct new failure mode beyond what's
already written up: on a coarse-mtime filesystem, such a replacement could be missed and served
stale, judged acceptable because the affected candidates are past, non-watched sessions. No new
finding; existing documentation is accurate and sufficient.

## Findings requiring action

- **Minor (non-blocking):** the plan's Review-focus instruction to "note as follow-up" the
  deferred directory-mtime short-circuit optimization is not captured anywhere (code comment,
  phase report, or backlog) — recommend adding one line to the `ClassificationCache` doc comment
  or a backlog/follow-up note before this phase's contract is considered fully closed out. Does
  not block merge of this diff.

No other findings. All three Codex-round items (single-pass meta derivation, 5000 cap, test
quality) are genuinely fixed on independent re-verification, not merely claimed.
