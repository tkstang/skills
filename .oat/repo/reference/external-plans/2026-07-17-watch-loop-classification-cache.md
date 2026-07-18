---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-cache-transcript
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Cache transcript classification in the session-observer watch loop

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

The session-observer watch loop stops re-reading and re-parsing every candidate transcript in full on every poll tick. Today `emitNewerSessionCandidates` runs inside the main watch loop (default 2s poll) and calls fresh discovery for every watched target; claude-code discovery classifies every candidate `.jsonl` in the project directory via a full file read + line-split + JSON parse — O(candidates × transcript size) disk and CPU churn every 2 seconds for the life of the watch, with no cache (unlike codex discovery, which already has an mtime-keyed cwd cache). After this plan, classification results are cached in-memory keyed by `(path, mtime, size)` and unchanged transcripts are never re-parsed.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (correctness lane, PERF-01), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none (BL-260713-* observer items cover different follow-ups; this is a performance fix inside shipped v1 behavior)
- Verified evidence (read live at planning time):
  - `src/transcript/session-observer/lib/watch.ts:1148,1177` — `while (true)` main loop calls `emitNewerSessionCandidates` each tick; `watch.ts:1086` default poll from `DEFAULT_POLL_SEC`.
  - `src/transcript/session-observer/lib/watch.ts:872` — `emitNewerSessionCandidates(...)` per watched target per tick.
  - `src/transcript/session-observer/lib/locate.ts:661-680` — `findNewerSameCwdCandidates` calls `discover(runtime, targetCwd)` fresh each call (lane claim; re-verify lines at execution).
  - `src/transcript/session-observer/lib/locate.ts:200-221` → `session-classifier.ts:165-170` → `src/transcript/core/runtimes.ts:399-403` — claude-code candidates go through full `readRecords` per discovery (lane claim; re-verify).
  - Existing precedents: codex `cwdCacheKey` cache in `locate.ts:65-77`; `FileSignature` (mtime/size) shape in `watch.ts:41-44`.

## Drift check

```bash
git diff --stat 8309623..HEAD -- src/transcript/session-observer/lib/ tests/session-observer/
```

If `watch.ts`/`locate.ts` discovery paths changed, re-map the call chain before editing. Coordinate with `2026-07-17-session-observer-state-robustness.md` if both are queued — run that plan first (both touch `locate.ts`; this plan rebases trivially on it).

## Repository conventions

- Build: `pnpm run build` (regenerates `skills/session-observer/scripts/lib/*.mjs`); sync: `pnpm run build:check`; Typecheck: `pnpm run type-check`; Test: `pnpm test`
- Skill-version gate: **bump `skills/session-observer/SKILL.md`** (top-level + `metadata.version`); confirm with `pnpm run validate:skill-versions -- --base-ref main`.
- Watch tests use an injectable virtual clock — new tests must not introduce real-time waits.
- Commits: Conventional Commits (`perf(session-observer): cache transcript classification`). Do not push or open a PR unless instructed.

## Scope

### In scope

- An in-memory classification cache keyed by `(path, mtimeMs, size)` consulted by claude-code candidate discovery (and any other runtime discovery that does full-file classification), scoped to the process lifetime and bounded in entry count.
- Threading the cache through `discover`/`findNewerSameCwdCandidates` call paths so watch-loop ticks reuse it (module-level or watch-session-owned — choose whichever the existing structure makes natural; document the choice).
- Tests proving cache hits skip re-reads and mtime/size changes invalidate.

### Out of scope

- On-disk caching for one-shot (non-watch) invocations — the codex cwd cache already covers its case; a new persistent cache is a bigger design.
- Changing poll cadence, debounce, or candidate-ranking behavior.
- Any observable output change: identical inputs must produce identical watch events.

## Current state

- Discovery classifies candidates to compute engagement fields (`classifyTranscriptRecords`/`candidateEngagementFields`), needing the parsed records of each candidate transcript.
- A transcript's classification is deterministic given file content; `(mtimeMs, size)` is the repo's established change signature (`FileSignature`).
- The watched transcript itself changes every tick while being actively written — the win is the *other* candidates (past sessions in the same project directory), which are typically static.

## Implementation steps

### 1. Map the exact call chain

Trace `emitNewerSessionCandidates` → `findNewerSameCwdCandidates` → `discover` → per-candidate classification for each runtime; identify every site doing a full `readRecords` for classification.

**Verify:** written list of classification read sites (expect claude-code primary; check cursor's path too).

### 2. Introduce the cache

Add a small `ClassificationCache` (Map keyed `path`, value `{ mtimeMs, size, result }`, LRU/size-capped at a few hundred entries) in the session-observer lib. Before classifying a candidate, `stat` it (discovery already stats candidates — reuse the stat, don't double-stat) and return the cached result on signature match; store after classification on miss. Wire one shared instance per watch process; for one-shot discovery calls, a per-call instance keeps semantics identical.

**Verify:** `pnpm run type-check` → clean.

### 3. Tests

In `tests/session-observer/` (virtual-clock patterns): (a) two discovery passes over an unchanged fixture transcript classify once (count via a read-counting seam or a temp-file access wrapper consistent with existing test style — no mocks; e.g. instrument by replacing the file with unreadable content after the first pass and asserting the second pass still returns the cached classification); (b) appending to the transcript (mtime/size change) re-classifies; (c) watch-loop integration: multi-tick run over static candidates produces identical events to the pre-cache behavior.

**Verify:** `pnpm test -- tests/session-observer/` → all pass, including unchanged existing watch suites (behavioral equivalence is the bar).

### 4. Regenerate, bump, run the contract

Bump `skills/session-observer/SKILL.md` (patch), then:

```bash
pnpm run build && pnpm run build:check && pnpm test && npm run validate && pnpm run validate:skill-versions -- --base-ref main
```

**Verify:** all exit 0; `git status --short` clean of unexplained files.

## Test plan

- New cases per step 3; the entire existing session-observer suite is the equivalence net.
- Regression proven: unchanged candidates are not re-read per tick; staleness is impossible under mtime/size change.
- Focused: `pnpm test -- tests/session-observer/`. Full: `pnpm test`.

## Done criteria

- [ ] Cache consulted on every discovery classification; hits skip file reads; signature change invalidates.
- [ ] Watch output proven byte-identical on existing suites.
- [ ] `session-observer` SKILL.md bumped; full contract passes.

## STOP conditions

- Step 1 shows classification is *not* deterministic per file content (e.g. time-dependent fields) — report; caching would change behavior.
- The cache cannot be wired without restructuring discovery signatures broadly — report the seam problem instead of a wide refactor.
- Any verification gate fails twice after one bounded correction.

## Review focus

- mtime granularity: coarse-mtime filesystems could miss a same-size same-mtime rewrite — mitigated by also keying size; note the residual edge in a comment.
- Memory bound on the cache and its behavior under long watches.
- Deferred intentionally: persistent cross-process cache; directory-mtime short-circuit for skipping discovery entirely (a further win the correctness lane suggested — note as follow-up).
