---
oat_status: complete
oat_ready_for: oat-project-review-provide
oat_blockers: []
oat_last_updated: 2026-05-22
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ["p06"]
oat_auto_review_at_hill_checkpoints: false
oat_plan_parallel_groups: [["p04", "p05"]]
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: session-observer

> Execute this plan using `oat-project-implement`. Phases p01–p03 run sequentially; phases p04 and p05 run in parallel worktrees and merge back in plan order; p06 runs last.

**Goal:** Ship a portable, user-installable Agent Skill at `.agents/skills/session-observer/` that lets Claude Code and Codex inspect each other's transcripts for the current project, render a tool-free digest, and track per-runtime read offsets. v1 covers `review`, `catch-up`, `locate`, and `state` subcommands. The continuous `watch` mode is designed but not implemented.

**Architecture:** Thin SKILL.md routing layer plus a Node CLI (`scripts/session-observer.mjs`) backed by five focused `scripts/lib/` modules (`runtimes`, `locate`, `rank`, `digest`, `state`). Node ESM, Node 22, stdlib only. State at `~/.local/state/session-observer/`.

**Tech Stack:** Node ≥ 22, Node ESM, Node standard library only. `node --test` for the test suite. No third-party runtime dependencies.

**Commit Convention:** `{type}({scope}): {description}` — e.g., `feat(p02-t01): add claude-code transcript adapter`.

## Planning Checklist

- [x] Confirmed HiLL checkpoints with user (none required for quick mode)
- [x] Set `oat_plan_hill_phases` in frontmatter (`[]` — implementation has no HiLL pauses)
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter (`[["p04", "p05"]]`)

---

## Parallelism

**Phases p01–p03 run sequentially:**

- `p01` writes `.agents/skills/session-observer/SKILL.md` (skeleton frontmatter only) and `scripts/lib/state.mjs` (+ tests). Everything downstream needs both.
- `p02` depends on p01 (uses `state.mjs` patterns); writes `scripts/lib/runtimes.mjs` and the fixture set. Phases p03 and p04 both consume `runtimes`.
- `p03` depends on p02 (`locate.mjs` uses `runtimes.extractMeta`); writes `scripts/lib/locate.mjs` and `scripts/lib/rank.mjs`.

**Phases p04 and p05 run in parallel:**

- `p04` writes `scripts/lib/digest.mjs`, `scripts/session-observer.mjs`, `scripts/probe-local.mjs`, and the CLI + integration tests under `tests/session-observer/`.
- `p05` writes the full body of `.agents/skills/session-observer/SKILL.md` (the frontmatter skeleton from p01 stays untouched), `references/watch-design.md`, and `references/transcript-formats.md`.

**Write-set disjointness:** p04 touches `scripts/`, `tests/session-observer/`; p05 touches only `.agents/skills/session-observer/SKILL.md` and `.agents/skills/session-observer/references/`. p05 does not modify the frontmatter that p01 created. SKILL.md body addition is purely additive against p01's skeleton. p04's CLI contract is fully specified in `design.md` and the source-of-truth spec, so p05 doesn't need p04's code to write the SKILL.md body.

**Verification disjointness:** p04's tests live under `tests/session-observer/` and exercise the JS modules; p05's validation is `npm run validate` (manifest + docs) which doesn't depend on p04's test results.

**p06 (validation) runs last** and is intentionally sequential — it executes the whole test suite and `npm run validate` against the merged result of p04+p05, plus the manual local probe.

---

## Phase 1: Skill scaffolding + state

### Task p01-t01: Scaffold skill directory and SKILL.md skeleton

**Files:**

- Create: `.agents/skills/session-observer/SKILL.md` (frontmatter + section headers only; body is filled in p05-t01)
- Create: `.agents/skills/session-observer/scripts/.gitkeep`
- Create: `.agents/skills/session-observer/scripts/lib/.gitkeep`
- Create: `.agents/skills/session-observer/references/.gitkeep`

**Step 1: Write test (RED)** — not applicable; this task is scaffolding (no executable code yet). A validation test is added in p06.

**Step 2: Implement (GREEN)**

Create `SKILL.md` with the frontmatter from `design.md` and `discovery.md`:

```yaml
---
name: session-observer
version: 1.0.0
description: Use when checking what the other coding agent (Claude Code or Codex) just did in this project, reviewing a peer session, or catching up on new messages. Locates the active transcript, renders a tool-free digest, and tracks per-runtime read offsets.
argument-hint: '[review|catch-up|locate|state] [--runtime <claude-code|codex|auto>] [--debug]'
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, AskUserQuestion
---

# session-observer

<!-- Body filled in p05-t01 -->
```

Add `.gitkeep` files in `scripts/`, `scripts/lib/`, and `references/` so the directory structure is committed.

**Step 3: Refactor** — n/a.

**Step 4: Verify**

Run: `head -10 .agents/skills/session-observer/SKILL.md`
Expected: frontmatter prints with `name: session-observer` and `version: 1.0.0`.

Run: `ls -la .agents/skills/session-observer/{scripts,scripts/lib,references}`
Expected: all three directories exist.

**Step 5: Commit**

```bash
git add .agents/skills/session-observer/
git commit -m "feat(p01-t01): scaffold session-observer skill directory"
```

---

### Task p01-t02: Implement scripts/lib/state.mjs + tests

**Files:**

- Create: `.agents/skills/session-observer/scripts/lib/state.mjs`
- Create: `tests/session-observer/state.test.mjs`
- Create: `tests/session-observer/helpers/tmpdir.mjs` (shared test helper for per-test temp `STATE_DIR`)

**Step 1: Write test (RED)**

`tests/session-observer/state.test.mjs`:

- Setup helper: each test creates a unique temp dir via `node:fs/promises mkdtemp`, sets `process.env.STATE_DIR` to it, cleans up after.
- Cases:
  - `mutate` creates `state.json` on first write.
  - `mutate` writes atomically (temp file + rename; no lingering `.tmp` on success path).
  - Lock contention: two `mutate` calls in `Promise.all` both succeed; final state contains both mutations.
  - `getSession` returns `null` when missing; returns stored entry when present.
  - `markRead` updates `lastRecordIndex`, `lastTotalRecords`, `lastReadAt`, `transcriptPath`, `recordedCwd`.
  - `resetByRuntime('codex')` zeros only codex entries; leaves claude-code untouched.
  - `resetBySession('codex', 'abc')` zeros only that entry.
  - `clear` empties `sessions` but preserves `schemaVersion`.
  - `migrateIfNeeded` writes `state.v0.json.bak` when reading an older schema, then upgrades in place.
  - Corrupt `state.json` (invalid JSON) is moved to `state.json.corrupt-<ts>.bak`; subsequent load returns empty.

Run: `node --test tests/session-observer/state.test.mjs`
Expected: all tests fail (RED — module doesn't exist yet).

**Step 2: Implement (GREEN)**

`scripts/lib/state.mjs` exports:

```javascript
export async function load();
export async function mutate(fn);              // fn: state => state
export async function getSession(runtime, sessionId);
export async function markRead(runtime, sessionId, { lastRecordIndex, lastTotalRecords, transcriptPath, recordedCwd });
export async function resetByRuntime(runtime); // returns count
export async function resetBySession(runtime, sessionId);
export async function clear();
```

Resolve state dir via `process.env.STATE_DIR ?? path.join(os.homedir(), '.local/state/session-observer')`.

Locking: `open(lockPath, 'wx')` retry loop (up to 100 × 50ms). Atomic write: temp `state.json.<pid>.tmp` → `fsync` → `rename`. `try/finally` to remove the lock.

Run: `node --test tests/session-observer/state.test.mjs`
Expected: all tests pass (GREEN).

**Step 3: Refactor**

Extract `acquireLock` / `releaseLock` helpers if `mutate` body exceeds ~40 lines.

**Step 4: Verify**

Run: `node --test tests/session-observer/state.test.mjs`
Expected: 100% of state tests pass.

**Step 5: Commit**

```bash
git add .agents/skills/session-observer/scripts/lib/state.mjs tests/session-observer/state.test.mjs tests/session-observer/helpers/tmpdir.mjs
git commit -m "feat(p01-t02): add state.mjs with atomic temp+rename and exclusive lock"
```

---

## Phase 2: Runtime parsing

### Task p02-t01: Author synthetic JSONL fixtures for both runtimes

**Files:**

- Create: `tests/session-observer/fixtures/README.md`
- Create: `tests/session-observer/fixtures/claude-code/typical.jsonl`
- Create: `tests/session-observer/fixtures/claude-code/with-tool-burst.jsonl`
- Create: `tests/session-observer/fixtures/claude-code/malformed.jsonl`
- Create: `tests/session-observer/fixtures/claude-code/partial-tail.jsonl`
- Create: `tests/session-observer/fixtures/claude-code/empty.jsonl`
- Create: `tests/session-observer/fixtures/codex/typical.jsonl`
- Create: `tests/session-observer/fixtures/codex/with-function-calls.jsonl`
- Create: `tests/session-observer/fixtures/codex/no-cwd-record.jsonl`
- Create: `tests/session-observer/fixtures/codex/malformed.jsonl`
- Create: `tests/session-observer/fixtures/codex/partial-tail.jsonl`

**Step 1: Write test (RED)** — n/a; fixtures are inputs.

**Step 2: Implement (GREEN)**

Hand-craft each fixture using the record shapes documented in Stoa's adapters (`/Users/thomas.stang/Code/stoa/apps/server/src/client/adapters/{claude-code,codex}.ts`). Keep each `typical.jsonl` to ~12 records: alternating user/assistant messages, one tool_use + tool_result for Claude / one function_call for Codex, one session-meta record at the top. Document each fixture's intent in `fixtures/README.md`.

**Step 3: Refactor** — n/a.

**Step 4: Verify**

Run: `for f in tests/session-observer/fixtures/{claude-code,codex}/*.jsonl; do echo "== $f =="; node -e "require('fs').readFileSync('$f','utf8').split('\n').filter(Boolean).forEach((l,i)=>{ try { JSON.parse(l); } catch(e) { console.log('line '+(i+1)+': non-JSON (expected for malformed/partial-tail fixtures)'); } })"; done`
Expected: only `malformed.jsonl` and `partial-tail.jsonl` files report non-JSON lines; all others parse cleanly.

**Step 5: Commit**

```bash
git add tests/session-observer/fixtures/
git commit -m "test(p02-t01): add synthetic JSONL fixtures for both runtimes"
```

---

### Task p02-t02: Implement scripts/lib/runtimes.mjs + tests

**Files:**

- Create: `.agents/skills/session-observer/scripts/lib/runtimes.mjs`
- Create: `tests/session-observer/runtimes.test.mjs`

**Step 1: Write test (RED)**

`tests/session-observer/runtimes.test.mjs`:

- `readRecords(typical.jsonl)` returns the expected count, parsed objects.
- `readRecords(malformed.jsonl)` returns valid records, emits a console warning, does not throw.
- `readRecords(partial-tail.jsonl)` drops the partial last line with a warning.
- `extractMeta('claude-code', typical.jsonl)` returns `{ sessionId, recordedCwd }` (cwd decoded from a synthetic dir name passed via path; for the test, pass a path under a temp dir whose name encodes the cwd).
- `extractMeta('codex', typical.jsonl)` extracts `sessionId` and `cwd` from session-meta record.
- `extractMeta('codex', no-cwd-record.jsonl)` returns `{ sessionId, recordedCwd: null }`.
- `normalizeEntries('claude-code', records, { includeToolCalls: false, includeToolResults: false })` returns only `message`-kind entries.
- `normalizeEntries('claude-code', records, { includeToolCalls: true })` includes `[Tool] truncated-args` entries, args truncated to 200 chars.
- `normalizeEntries('claude-code', records, { includeToolCalls: true, includeToolResults: true })` includes `[Tool → result] truncated-output` entries, body truncated to 500.
- Same matrix for `codex` runtime (with `function_call` records producing `tool_call` entries when included).
- `encodeCwd('claude-code', '/Users/x/Code/y')` returns `'-Users-x-Code-y'`.
- `encodeCwd('codex', '/Users/x/Code/y')` returns `null`.

Run: `node --test tests/session-observer/runtimes.test.mjs`
Expected: all fail (RED).

**Step 2: Implement (GREEN)**

`scripts/lib/runtimes.mjs` exports:

```javascript
export function discoverPaths(runtime);
export function encodeCwd(runtime, cwd);
export async function extractMeta(runtime, transcriptPath);
export async function readRecords(transcriptPath);
export function normalizeEntries(runtime, records, { includeToolCalls, includeToolResults });
```

Port logic from Stoa's `apps/server/src/client/adapters/claude-code.ts` and `codex.ts`. Tool args truncated at 200 chars; results at 500. Drop blank/whitespace-only lines without warning; emit a console warning on malformed mid-file lines and on partial trailing lines.

Run: `node --test tests/session-observer/runtimes.test.mjs`
Expected: all pass (GREEN).

**Step 3: Refactor**

Extract `truncate`, `safeParseLine`, `isObject`, `asString` into a small helpers section at the top of the module. If the two runtimes' `normalizeEntries` paths diverge significantly, factor each into its own internal helper but keep the public `normalizeEntries` switch in one place.

**Step 4: Verify**

Run: `node --test tests/session-observer/runtimes.test.mjs tests/session-observer/state.test.mjs`
Expected: full pass; no regressions in state tests.

**Step 5: Commit**

```bash
git add .agents/skills/session-observer/scripts/lib/runtimes.mjs tests/session-observer/runtimes.test.mjs
git commit -m "feat(p02-t02): add per-runtime transcript adapters (claude-code + codex)"
```

---

## Phase 3: Discovery + ranking

### Task p03-t01: Implement scripts/lib/locate.mjs + tests

**Files:**

- Create: `.agents/skills/session-observer/scripts/lib/locate.mjs`
- Create: `tests/session-observer/locate.test.mjs`

**Step 1: Write test (RED)**

`tests/session-observer/locate.test.mjs`:

- claude-code: builds a temp `HOME/.claude/projects/<encoded-cwd>/typical.jsonl`; `discover('claude-code', tempCwd)` returns one candidate with the right `sessionId`, `recordedCwd`, `mtime`.
- claude-code: when the encoded dir is missing, `discover` glob-falls-back to `projects/*/*.jsonl` and finds nothing under the target cwd (but doesn't throw).
- codex: builds temp `HOME/.codex/sessions/2026/05/14/session-*.jsonl`; `discover('codex', tempCwd)` returns the candidate with cwd derived from the session-meta record.
- codex: a file older than `LOOKBACK_DAYS = 7` is excluded.
- codex cwd cache: prove a cache hit via observable cache state, not an ESM spy. After a first `discover`, assert `${STATE_DIR}/codex-cwd-cache.json` contains the entry keyed by `${transcriptPath}:${mtime}`. Then rewrite the transcript's content so a fresh parse would yield a different cwd, restore its original mtime via `fs.utimes`, call `discover` again, and assert the originally-cached cwd is still returned — proving the cache was consulted rather than the transcript re-parsed.
- `gitWorktrees`: parses a known `git worktree list --porcelain` string; returns `[]` when `git` exec fails.

Run: `node --test tests/session-observer/locate.test.mjs`
Expected: all fail (RED).

**Step 2: Implement (GREEN)**

`scripts/lib/locate.mjs` exports:

```javascript
export async function discover(runtime, targetCwd);  // Candidate[]
export async function gitWorktrees(cwd);             // string[] (worktree paths)
```

Use `runtimes.discoverPaths` + `runtimes.encodeCwd` + `runtimes.extractMeta`. Implement the codex cwd cache at `${STATE_DIR}/codex-cwd-cache.json` keyed by `${transcriptPath}:${mtime}`. `gitWorktrees` shells out via `node:child_process` `execFile('git', ['-C', cwd, 'worktree', 'list', '--porcelain'])` and parses `worktree <path>` lines.

Run: `node --test tests/session-observer/locate.test.mjs`
Expected: all pass (GREEN).

**Step 3: Refactor**

Extract the cwd-cache read/write into a small helper section.

**Step 4: Verify**

Run: `node --test`
Expected: state + runtimes + locate tests all pass.

**Step 5: Commit**

```bash
git add .agents/skills/session-observer/scripts/lib/locate.mjs tests/session-observer/locate.test.mjs
git commit -m "feat(p03-t01): add candidate discovery with codex cwd cache and git worktree enumeration"
```

---

### Task p03-t02: Implement scripts/lib/rank.mjs + tests

**Files:**

- Create: `.agents/skills/session-observer/scripts/lib/rank.mjs`
- Create: `tests/session-observer/rank.test.mjs`

**Step 1: Write test (RED)**

`tests/session-observer/rank.test.mjs`:

- Tier A wins over Tier B and Tier C; non-A candidates filtered out.
- Tier B wins when no Tier A; Tier C candidates filtered out.
- No match → returns `{ winner: null, noMatch: true, sisters, globalRecent }`; `sisters` populated from a mocked `gitWorktrees`, `globalRecent` is top-5 by mtime.
- Ties: within the winning tier, candidates whose mtimes are within `TIE_WINDOW_SEC = 5s` of the winner appear in `ties[]`.
- `active: true` set on winner when `ageSec < 60`.
- `realpathSafe` handles `ENOENT` without throwing (test by passing a path that doesn't exist).
- Within a tier, sort by mtime DESC.

Run: `node --test tests/session-observer/rank.test.mjs`
Expected: fail (RED).

**Step 2: Implement (GREEN)**

`scripts/lib/rank.mjs` exports:

```javascript
export function rank(candidates, targetCwd, { tieWindowSec = 5 } = {});
// → { winner, tier, ties, fallbacks } | { winner: null, noMatch: true, sisters, globalRecent }
```

Constants: `TIE_WINDOW_SEC = 5`, `ACTIVE_THRESHOLD_SEC = 60`. Inject `gitWorktrees` and `globalRecent` provider via opts so tests can stub them.

Run: `node --test tests/session-observer/rank.test.mjs`
Expected: pass (GREEN).

**Step 3: Refactor**

Inline trivial helpers; keep `tierOf` as a named function so tests can import it for direct assertions if needed.

**Step 4: Verify**

Run: `node --test`
Expected: all module tests pass through p03.

**Step 5: Commit**

```bash
git add .agents/skills/session-observer/scripts/lib/rank.mjs tests/session-observer/rank.test.mjs
git commit -m "feat(p03-t02): add tier-based deterministic ranking with tie + active detection"
```

---

## Phase 4: Digest + CLI

> Runs in parallel with Phase 5. Write-set: `scripts/`, `tests/session-observer/`.

### Task p04-t01: Implement scripts/lib/digest.mjs + tests

**Files:**

- Create: `.agents/skills/session-observer/scripts/lib/digest.mjs`
- Create: `tests/session-observer/digest.test.mjs`

**Step 1: Write test (RED)**

`tests/session-observer/digest.test.mjs`:

- `buildDigest(runtime, fixturePath, { fromIndex: 0, ... })` returns a Digest with `entries.length === <typical fixture's message count>`; `range.fromIndex === 0`; `range.totalRecords === <records>`.
- `buildDigest` with `fromIndex: N` (where N is mid-stream) returns only entries with `recordIndex >= N` and sets `range.newRecords` correctly when `mode: 'catch-up'`.
- `renderMarkdown(digest)` groups consecutive same-role entries under a single `### User` / `### Assistant` header.
- Header contains the filter line, the active flag (when `digest.active`), and range metadata.
- 20K-char warning prepended when output exceeds threshold (use a fixture with enough records to cross 20K).
- `--max-turns` slices from the tail; `--max-bytes` does the same by byte count.
- `renderJson(digest)` returns valid JSON; round-trips via `JSON.parse` losslessly.

Run: `node --test tests/session-observer/digest.test.mjs`
Expected: fail (RED).

**Step 2: Implement (GREEN)**

`scripts/lib/digest.mjs` exports:

```javascript
export async function buildDigest(runtime, transcriptPath, opts);
export function renderMarkdown(digest);
export function renderJson(digest);
```

Use `runtimes.readRecords` + `runtimes.normalizeEntries`. Honor `--max-turns` / `--max-bytes` for `review` mode (tail-slice). Markdown header per the `design.md` sample (cwd, transcript, age, mode, range, filters lines). 20K threshold from spec.

Run: `node --test tests/session-observer/digest.test.mjs`
Expected: pass (GREEN).

**Step 3: Refactor**

Extract `groupByRole`, `formatHeader`, and `applyTailSlice` as small helpers if `renderMarkdown` exceeds ~50 lines.

**Step 4: Verify**

Run: `node --test`
Expected: all module tests pass.

**Step 5: Commit**

```bash
git add .agents/skills/session-observer/scripts/lib/digest.mjs tests/session-observer/digest.test.mjs
git commit -m "feat(p04-t01): add digest builder with filter-aware markdown and JSON renderers"
```

---

### Task p04-t02: Implement scripts/session-observer.mjs (CLI) + cli.test.mjs

**Files:**

- Create: `.agents/skills/session-observer/scripts/session-observer.mjs`
- Create: `tests/session-observer/cli.test.mjs`

**Step 1: Write test (RED)**

`tests/session-observer/cli.test.mjs`:

- argv parsing: `review`, `catch-up`, `locate`, `state get`, `state reset --runtime codex`, `state clear` all dispatch correctly (assert via a stub on the subcommand handlers exported from the module).
- Exit codes via `spawnSync`: `review` against an empty fixture → exit 2; `review` against a typical fixture → exit 0. Spawn the CLI by an absolute path to `.agents/skills/session-observer/scripts/session-observer.mjs` (resolve via `import.meta.url`) — never a bare relative `scripts/...` path.
- `locate --json` output is parseable JSON containing `{ winner, fallbacks }`.
- `--runtime auto` with `SESSION_OBSERVER_SELF=claude-code` env resolves to `codex`.
- `--runtime auto` with no env hint and candidates in both stores → exit 3 with `ambiguousRuntime: true` in the JSON payload.

Run: `node --test tests/session-observer/cli.test.mjs`
Expected: fail (RED).

**Step 2: Implement (GREEN)**

`scripts/session-observer.mjs` is the entrypoint:

- Use `node:util parseArgs` for argv.
- Subcommand dispatch via a switch.
- Default output is markdown; `--json` flips to JSON.
- Exit codes: 0 success / 1 hard error / 2 no candidates / 3 needs user input / 4 schema mismatch (per spec).
- `--runtime auto` resolves via: env `SESSION_OBSERVER_SELF` → tier-population fallback → exit 3 with `ambiguousRuntime`.

Add a shebang `#!/usr/bin/env node` and `chmod +x` so the file is executable.

Run: `node --test tests/session-observer/cli.test.mjs`
Expected: pass (GREEN).

**Step 3: Refactor**

Extract subcommand handlers (`runReview`, `runCatchUp`, `runLocate`, `runState`) into separate functions in the same file. Keep `main(argv)` small.

**Step 4: Verify**

Run: `node --test`
Expected: every test in `tests/session-observer/` passes.

**Step 5: Commit**

```bash
git add .agents/skills/session-observer/scripts/session-observer.mjs tests/session-observer/cli.test.mjs
git commit -m "feat(p04-t02): add CLI entrypoint with subcommand dispatch and exit-code contract"
```

---

### Task p04-t03: Implement scripts/probe-local.mjs

**Files:**

- Create: `.agents/skills/session-observer/scripts/probe-local.mjs`

**Step 1: Write test (RED)** — n/a; this is an opt-in manual verification helper. No automated test (would require real local transcripts which aren't committed).

**Step 2: Implement (GREEN)**

`scripts/probe-local.mjs`:

- Accept `--runtime <r>` and `--cwd <path>` (default `process.cwd()`).
- Resolve the sibling CLI path with `fileURLToPath(new URL('./session-observer.mjs', import.meta.url))` so it works regardless of the caller's cwd, then spawn it as `spawnSync('node', [cliPath, 'review', '--runtime', runtime, '--cwd', cwd])` and pipe stdout/stderr to the caller. Never spawn a bare relative `scripts/session-observer.mjs`.
- Print a brief header: which transcript store was searched, how many candidates were found, which won.

Exit codes propagate from the CLI.

**Step 3: Refactor** — keep small; this is a thin wrapper.

**Step 4: Verify**

Run: `node .agents/skills/session-observer/scripts/probe-local.mjs --runtime claude-code --cwd "$PWD"`
Expected: command runs without throwing. The output depends on whether the user has Claude transcripts for this cwd; if not, the CLI's exit-2 noMatch response is surfaced (this is correct behavior, not a test failure).

**Step 5: Commit**

```bash
git add .agents/skills/session-observer/scripts/probe-local.mjs
git commit -m "feat(p04-t03): add opt-in probe-local helper for manual verification"
```

---

### Task p04-t04: Integration test (synthetic fixtures, temp HOME)

**Files:**

- Create: `tests/session-observer/integration.test.mjs`

**Step 1: Write test (RED)**

`tests/session-observer/integration.test.mjs`:

- Setup: build a temp dir, populate `tempDir/.claude/projects/<encoded-cwd>/typical.jsonl` from the existing fixture. Set `HOME=tempDir`, `STATE_DIR=tempDir/.local/state/session-observer`. Spawn the CLI by an absolute path to `.agents/skills/session-observer/scripts/session-observer.mjs` (resolve via `import.meta.url`) — never a bare relative `scripts/...` path.
- Test 1: `review --runtime claude-code --cwd <cwd>` exits 0; stdout contains both `### User` and `### Assistant`; contains no `[Edit]` / `[Bash]` markers (tools excluded by default).
- Test 2: `review --runtime claude-code --include-tools` exits 0; stdout contains compact tool markers; results still excluded.
- Test 3: `review --debug` exits 0; stdout contains both tool markers and result markers.
- Test 4: `catch-up` twice in a row: first exits 0 with full delta; second exits 0 with "no new records" header.
- Test 5: `state reset --runtime claude-code` followed by `catch-up` re-emits the full content.
- Test 6: `review` against an empty fixture exits 2 with `noCandidates` (or `noMatch` depending on fixture state).

Run: `node --test tests/session-observer/integration.test.mjs`
Expected: fail (RED).

**Step 2: Implement (GREEN)** — code already exists from p04-t02; integration test should now pass once fixtures and CLI wiring align. If anything is missing in the CLI, fix it.

Run: `node --test tests/session-observer/integration.test.mjs`
Expected: pass (GREEN).

**Step 3: Refactor** — none expected; the integration test exercises the integrated behavior.

**Step 4: Verify**

Run: `node --test`
Expected: 100% pass across all module + integration tests.

**Step 5: Commit**

```bash
git add tests/session-observer/integration.test.mjs
git commit -m "test(p04-t04): add end-to-end integration test against synthetic transcripts"
```

---

## Phase 5: Documentation

> Runs in parallel with Phase 4. Write-set: `.agents/skills/session-observer/SKILL.md` (body only — frontmatter untouched), `.agents/skills/session-observer/references/`.

### Task p05-t01: Write full SKILL.md body

**Files:**

- Modify: `.agents/skills/session-observer/SKILL.md` (replace the skeleton body left by p01-t01; do not modify frontmatter)

**Step 1: Write test (RED)** — n/a; this is documentation. Validation runs in p06.

**Step 2: Implement (GREEN)**

Write the SKILL.md body per the section order required by `create-agnostic-skill`:

1. Title + one-line purpose.
2. **When to Use** — bullet list of triggers (`check Codex`, `check Claude`, `check again`, `what do you think of what was just said?`, etc.) and the natural-language → subcommand mapping table from the spec.
3. **When NOT to Use** — when you already know what the peer did; when you want to capture findings into Stoa (use `stoa-capture` instead); when you want continuous monitoring (designed but not implemented — see `references/watch-design.md`).
4. **Arguments** — full CLI flag matrix: subcommands, `--runtime`, `--cwd`, `--include-tools`, `--debug`, `--include-tool-results`, `--json`, `--max-turns`, `--max-bytes`, `--session`.
5. **Workflow** —
   - **Step 1: Clarify if needed** — if any of mode, runtime, or candidate selection is ambiguous, ask the user. Claude Code: `AskUserQuestion`. Codex: structured user-input tooling when available. Fallback: conversational ask.
   - **Step 2: Run the CLI** — exact invocation template per mode. How to interpret exit codes 2 (noCandidates / noMatch — present widening options) and 3 (ties / ambiguousRuntime — present options to pick).
   - **Step 3: Present digest and comment** — read the markdown digest; offer a take on what the peer did or said.
   - **Step 4: Catch-up bookkeeping** — note that catch-up has advanced the offset; next "check again" will only show what arrives after.
6. **Examples** — Basic Usage block (`/session-observer review --runtime codex`) and Conversational block ("Can you check what Codex just did?").
7. **Troubleshooting** — common issues: no candidates found, ties, ambiguous runtime, lock-exhausted, transcript shrank, corrupt state. For each, the recovery the user can take. Include the nuke option (`rm -rf ~/.local/state/session-observer`).
8. **Success Criteria** — bullet checklist matching the spec's acceptance criteria.

Keep total body under 500 lines / ~5K tokens (Agent Skills spec constraint).

**Step 3: Refactor** — read the body through once; ensure no duplication between SKILL.md and `references/`.

**Step 4: Verify**

Run: `wc -l .agents/skills/session-observer/SKILL.md`
Expected: ≤ 500 lines.

Run: `head -10 .agents/skills/session-observer/SKILL.md`
Expected: frontmatter from p01-t01 is intact (name, version, description, argument-hint, disable-model-invocation, user-invocable, allowed-tools).

**Step 5: Commit**

```bash
git add .agents/skills/session-observer/SKILL.md
git commit -m "docs(p05-t01): write SKILL.md body with workflow and examples"
```

---

### Task p05-t02: Write references/watch-design.md

**Files:**

- Create: `.agents/skills/session-observer/references/watch-design.md`

**Step 1: Write test (RED)** — n/a.

**Step 2: Implement (GREEN)**

Author the watch design from the spec's Section 9. Includes:

- Why design-only in v1.
- CLI shape: `session-observer watch [--runtime <r>|both] [--cwd <p>] [--debounce-sec 2] [--poll-sec 2] [--event-log <path>] [--json]`.
- Polling (not `fs.watch`) and rationale.
- Polling pseudocode.
- Debounce strategy.
- Event emission pipeline (`locate → rank → digest → state.markRead`).
- `watch.json` schema and singleton enforcement (one watcher per runtime, stale-pid sweep on startup).
- Event-log JSONL schema (metadata only, no content).
- `--runtime both` semantics.
- Control surface: `watch-ctl flush|pause|resume|status|stop` + `watch.control.json` schema (no SIGUSR1).
- SIGTERM/SIGINT graceful-shutdown contract.
- Future hook integration notes (post-v2, out of scope).
- Safety rules (read-only on transcripts; no memory/vault writes; no network).
- Decisions locked: no SIGUSR1, no `--notify` / macOS notification center.

**Step 3: Refactor** — n/a.

**Step 4: Verify**

Run: `wc -l .agents/skills/session-observer/references/watch-design.md`
Expected: file exists and is non-trivial (~200 lines).

**Step 5: Commit**

```bash
git add .agents/skills/session-observer/references/watch-design.md
git commit -m "docs(p05-t02): add frozen design for the v2 continuous watcher"
```

---

### Task p05-t03: Write references/transcript-formats.md

**Files:**

- Create: `.agents/skills/session-observer/references/transcript-formats.md`

**Step 1: Write test (RED)** — n/a.

**Step 2: Implement (GREEN)**

Short reference for the Claude Code and Codex JSONL record shapes that `runtimes.mjs` parses. Includes:

- File location patterns (`~/.claude/projects/<encoded-cwd>/*.jsonl`; `~/.codex/sessions/**/*.jsonl`).
- Claude Code record example with `message.role`, `message.content[]` blocks, `tool_use`, `tool_result`.
- Codex record example with `payload.type === 'message'` vs `function_call`, session-meta record shape.
- Session-id placement quirks per runtime.
- Cwd extraction strategy per runtime (encoded dir name vs session-meta record).
- A note that these formats may drift; the canonical adapters live in `scripts/lib/runtimes.mjs`.

**Step 3: Refactor** — n/a.

**Step 4: Verify**

Run: `head -20 .agents/skills/session-observer/references/transcript-formats.md`
Expected: file exists with the documented section structure.

**Step 5: Commit**

```bash
git add .agents/skills/session-observer/references/transcript-formats.md
git commit -m "docs(p05-t03): add transcript-formats reference doc"
```

---

## Phase 6: Validation

### Task p06-t01: Confirm npm run validate passes; update scripts/validate.mjs if needed

**Files:**

- Modify (if needed): `scripts/validate.mjs`

**Step 1: Write test (RED)** — n/a; validation is the test.

**Step 2: Implement (GREEN)**

Run: `npm run validate`

If it fails because it doesn't yet know about the new skill, inspect `scripts/validate.mjs` and add the necessary entry or pattern so it recognizes `.agents/skills/session-observer/SKILL.md`. Make the minimum change required.

Re-run: `npm run validate`
Expected: pass.

**Step 3: Refactor** — n/a.

**Step 4: Verify**

Run: `npm test && npm run validate`
Expected: both pass cleanly.

**Step 5: Commit** (only if `validate.mjs` was modified)

```bash
git add scripts/validate.mjs
git commit -m "chore(p06-t01): teach validate.mjs about session-observer skill"
```

---

### Task p06-t02: Manual local probe verification

**Files:**

- Modify: `.oat/projects/shared/session-observer/implementation.md` (append local probe results to the implementation log)

**Step 1: Write test (RED)** — n/a; manual verification.

**Step 2: Implement (GREEN)**

Run the local probe against both runtimes from a project the user actively uses:

```bash
node .agents/skills/session-observer/scripts/probe-local.mjs --runtime claude-code --cwd "$PWD"
node .agents/skills/session-observer/scripts/probe-local.mjs --runtime codex --cwd "$PWD"
```

For each invocation, capture:

- Exit code.
- Whether the right session was picked (header `cwd:` matches `$PWD`; `transcript:` is plausible).
- A brief paste of the rendered digest header (no content).

Append a results section to `implementation.md` under "Manual Verification" with the captured info.

If either probe shows a clear bug, file it as a follow-up task in the same implementation log (do not block this task on follow-ups — the goal is verifying the skill works end-to-end on real data).

**Step 3: Refactor** — n/a.

**Step 4: Verify**

Run: `node .agents/skills/session-observer/scripts/probe-local.mjs --runtime claude-code --cwd "$PWD"` (or `--runtime codex`)
Expected: exit code is one of `{0, 2}`; output is well-formed; either a digest with the right cwd or a `noMatch` response is acceptable. Only exit code 1 (hard error) is a failure.

**Step 5: Commit**

```bash
git add .oat/projects/shared/session-observer/implementation.md
git commit -m "chore(p06-t02): record manual local probe verification results"
```

---

## Phase 7: Final Review Fixes

> Fix tasks generated by `oat-project-review-receive` from the final-scope code review `reviews/archived/final-review-2026-05-15.md` (1 Critical, 1 Important, 1 Medium, plus 3 user-converted deferred p01 Mediums and 1 user-converted Minor). Run sequentially.

### Task p07-t01: (review) Read Codex `payload.cwd` in transcript metadata extraction

**Files:**

- Modify: `.agents/skills/session-observer/scripts/lib/runtimes.mjs`
- Modify: `.agents/skills/session-observer/scripts/lib/locate.mjs`
- Create: `tests/session-observer/fixtures/codex/payload-cwd.jsonl`
- Modify: `tests/session-observer/runtimes.test.mjs`

**Step 1: Understand the issue**

Review finding C1 (Critical): `extractMeta` reads only top-level `record.cwd` for Codex, but current Codex `session_meta` records carry the cwd under `payload.cwd`. Such transcripts are discovered with `recordedCwd: null`, which forces a `noMatch` and breaks the core v1 goal of matching the active project's Codex session.
Location: `runtimes.mjs:304` (Codex `extractMeta` cwd read).

**Step 2: Implement fix**

In the Codex branch of `extractMeta`, read `payload.cwd` in addition to top-level `record.cwd` (prefer whichever is present; check `payload.cwd` on `type: "session_meta"` records). Add a hand-crafted fixture `tests/session-observer/fixtures/codex/payload-cwd.jsonl` whose session-meta record stores `cwd` under `payload.cwd`. In `locate.mjs`, cache `sessionId` alongside `recordedCwd` in the codex cwd-cache so a cache hit does not re-parse the transcript (review C1 fix guidance). Add `runtimes.test.mjs` coverage proving `extractMeta` resolves `recordedCwd` from the `payload.cwd` fixture.

**Step 3: Verify**

Run: `npm test`
Expected: full suite passes including the new `payload.cwd` extraction test.

**Step 4: Commit**

```bash
git add .agents/skills/session-observer/scripts/lib/runtimes.mjs .agents/skills/session-observer/scripts/lib/locate.mjs tests/session-observer/fixtures/codex/payload-cwd.jsonl tests/session-observer/runtimes.test.mjs
git commit -m "fix(p07-t01): read Codex payload.cwd in transcript metadata extraction"
```

---

### Task p07-t02: (review) Apply `--session` pinned override before tie and no-match returns

**Files:**

- Modify: `.agents/skills/session-observer/scripts/session-observer.mjs`
- Modify: `tests/session-observer/cli.test.mjs`

**Step 1: Understand the issue**

Review findings C1 (recovery half) + I1 (Important): the CLI evaluates the tie (exit 3) and no-match (exit 2) early returns *before* it applies the `--session` pinned override. `SKILL.md` documents `--session <runtime>:<id>` as the recovery path for exit-3 ties and exit-2 no-match, but the re-invocation hits the same early-return branch and fails again.
Location: `session-observer.mjs:255` and `:375` (tie/no-match returns ahead of the pinned override at `:270`).

**Step 2: Implement fix**

In both `runReview` and `runCatch-up`, resolve and validate the `--session <runtime>:<sessionId>` pinned override **before** the tie and no-match early-return branches. When a valid pinned session is supplied, select that candidate directly and skip the tie/no-match returns. Validate the pinned runtime and id; on an invalid or unresolvable pinned session, exit 1 with a clear message. Add `cli.test.mjs` cases: (a) tie recovery — `review` and `catch-up` with two same-mtime candidates plus `--session` resolves to a digest (exit 0); (b) no-match recovery — `--session` pins a candidate that cwd-ranking would have missed.

**Step 3: Verify**

Run: `npm test`
Expected: full suite passes including the new tie- and no-match-recovery tests.

**Step 4: Commit**

```bash
git add .agents/skills/session-observer/scripts/session-observer.mjs tests/session-observer/cli.test.mjs
git commit -m "fix(p07-t02): apply --session override before tie/no-match returns"
```

---

### Task p07-t03: (review) Make rank.mjs Tier B path matching bidirectional

**Files:**

- Modify: `.agents/skills/session-observer/scripts/lib/rank.mjs`
- Modify: `tests/session-observer/rank.test.mjs`

**Step 1: Understand the issue**

Review finding M1 (Medium): `tierOf` treats only `recordedCwd.startsWith(targetCwd + '/')` as Tier B. The approved spec requires *either* side to be a path-prefix of the other, so a session started at the repo root still matches when the agent runs from a subdirectory. Today `tierOf({ recordedCwd: "/tmp/project" }, "/tmp/project/src")` returns Tier C → `noMatch`.
Location: `rank.mjs:47`.

**Step 2: Implement fix**

Change the Tier B test so it matches when `recordedCwd` is under `targetCwd` **or** `targetCwd` is under `recordedCwd`, using a path-boundary-safe comparison (append a `/` sentinel to both sides, or use `path.relative` and reject `..`-escaping results). Add a `rank.test.mjs` case for the target-cwd-under-recorded-cwd direction (e.g. `tierOf({recordedCwd:"/tmp/project"}, "/tmp/project/src")` → `'B'`).

**Step 3: Verify**

Run: `npm test`
Expected: full suite passes including the new bidirectional Tier B test.

**Step 4: Commit**

```bash
git add .agents/skills/session-observer/scripts/lib/rank.mjs tests/session-observer/rank.test.mjs
git commit -m "fix(p07-t03): make rank.mjs Tier B path matching bidirectional"
```

---

### Task p07-t04: (review) Harden state.mjs backup and migration write paths

**Files:**

- Modify: `.agents/skills/session-observer/scripts/lib/state.mjs`
- Modify: `tests/session-observer/state.test.mjs`

**Step 1: Understand the issue**

Bundles four `state.mjs` findings the user elected to fix now — three deferred p01 Mediums plus one final-review Minor (all touch the same backup/migration write paths, so one coherent task avoids churn):

- p01-M1: `load()`'s callee writes backup files (corrupt-state + migration) without holding the `mutate` lock.
- p01-M2: `migrateIfNeeded` upgrades the in-memory object but never persists the upgraded `state.json` to disk.
- p01-M3: backup writes use non-atomic `writeFile` with a fixed name (`state.v0.json.bak`), so a repeat migration/corruption clobbers a prior backup.
- m1 (final-review Minor): `state.mjs:17` imports `access` from `node:fs/promises` unused.

**Step 2: Implement fix**

- p01-M1: route backup-on-corrupt and backup-on-migration writes through the lock (perform them inside a locked section, or have the recovery read path acquire the lock before writing).
- p01-M2: after `migrateIfNeeded` upgrades the schema, persist the upgraded state to `state.json` via the atomic temp+rename path so a later bare `load()` sees the upgraded file.
- p01-M3: give backup files unique names (timestamp and/or pid suffix) and write them atomically (temp+rename), so repeat migrations/corruptions never clobber an existing `.bak`.
- m1: remove the unused `access` import.

Add `state.test.mjs` cases: migration persists to disk (re-load returns the upgraded schema, not v0); a repeat backup does not overwrite a prior backup file.

**Step 3: Verify**

Run: `npm test`
Expected: full suite passes including the new migration-persistence and backup-uniqueness tests.

**Step 4: Commit**

```bash
git add .agents/skills/session-observer/scripts/lib/state.mjs tests/session-observer/state.test.mjs
git commit -m "fix(p07-t04): harden state.mjs backup and migration write paths"
```

---

## Phase p-rev1: Revision 1 — Dogfood hardening + Cursor runtime support

Source: inline feedback and local spike (2026-05-21)

Scope notes:

- Fold the already-implemented dogfood patch into this revision record so it is not a separate untracked history line.
- Add Cursor **agent transcript** support from `~/.cursor/projects/*/agent-transcripts/*/*.jsonl`.
- Keep `~/.cursor/chats/*/store.db` SQLite chat-history support out of scope for this revision.

### Task prev1-t01: (revision) Finalize dogfood-driven matching and digest hardening

**Files:**

- Modify: `skills/session-observer/scripts/lib/runtimes.mjs`
- Modify: `skills/session-observer/scripts/lib/locate.mjs`
- Modify: `skills/session-observer/scripts/lib/rank.mjs`
- Modify: `skills/session-observer/scripts/lib/digest.mjs`
- Modify: `skills/session-observer/scripts/lib/state.mjs`
- Modify: `skills/session-observer/scripts/session-observer.mjs`
- Modify: `skills/session-observer/SKILL.md`
- Modify: `skills/session-observer/references/transcript-formats.md`
- Modify: `tests/session-observer/*.test.mjs`

**Step 1: Normalize the existing dogfood patch into the revision**

Finalize the already-applied dogfood changes under this task:

- Claude Code project slug lookup supports dot-sanitized slugs and fallback slug evidence.
- Same-worktree/cwd evidence outranks unrelated global recency.
- `--snippet` can identify a session by an excerpt before review/catch-up.
- Raw transcript bookkeeping is separated from rendered digest bookkeeping.
- High-water offsets are exclusive (`nextIndex`), avoiding one-record overlap.
- Claude `<command-message>` / `<command-name>` / `<command-args>` payloads are `command_message` entries and excluded by default.
- `--include-command-messages` opts command payloads back in.
- Large digests automatically fall back to the last 8 user/assistant turn groups.
- `--max-turns` / `--max-bytes` apply to catch-up as well as review.
- `--runtime auto` can prefer a previously read same-cwd runtime when both Claude and Codex match.

**Step 2: Verify**

Run:

```bash
node --test 'tests/session-observer/*.test.mjs'
npm test
npm run validate
npm run smoke
```

Expected: all commands pass.

**Step 3: Refresh installed copies**

Refresh the user-level installed skill copies:

```bash
rsync -a --delete skills/session-observer/ ~/.agents/skills/session-observer/
```

`~/.claude/skills/session-observer` is a symlink to `~/.agents/skills/session-observer`; verify it still resolves there.

**Step 4: Commit**

```bash
git add skills/session-observer tests/session-observer
git commit -m "fix(prev1-t01): harden session-observer dogfood paths"
```

---

### Task prev1-t02: (revision) Add Cursor runtime adapter and fixtures

**Files:**

- Modify: `skills/session-observer/scripts/lib/runtimes.mjs`
- Create: `tests/session-observer/fixtures/cursor/typical.jsonl`
- Create: `tests/session-observer/fixtures/cursor/with-tool-use.jsonl`
- Modify: `tests/session-observer/runtimes.test.mjs`

**Step 1: Implement Cursor adapter**

Add `cursor` support to runtime parsing:

- `discoverPaths('cursor')` returns `~/.cursor/projects`.
- `encodeCwdVariants('cursor', cwd)` returns Cursor's observed project slug: split path on `/` and `.` and join non-empty segments with `-` (for example `/Users/thomas.stang/Code/vox/duet` → `Users-thomas-stang-Code-vox-duet`).
- `extractMeta('cursor', transcriptPath)` returns `sessionId` from the transcript basename or parent transcript directory.
- `normalizeCursor()` parses Cursor agent JSONL records shaped as `{ "role": "user|assistant", "message": { "content": [...] } }`.
- `text` blocks become `message` entries.
- `tool_use` blocks become compact `tool_call` entries when `includeToolCalls` is true.

Do not add SQLite support for `~/.cursor/chats` in this task.

**Step 2: Verify**

Run: `node --test tests/session-observer/runtimes.test.mjs`
Expected: Cursor fixtures parse; default output excludes tool calls; `includeToolCalls` includes `[ToolName] args` markers.

**Step 3: Commit**

```bash
git add skills/session-observer/scripts/lib/runtimes.mjs tests/session-observer/fixtures/cursor tests/session-observer/runtimes.test.mjs
git commit -m "feat(prev1-t02): add Cursor transcript runtime adapter"
```

---

### Task prev1-t03: (revision) Add Cursor transcript discovery and ranking evidence

**Files:**

- Modify: `skills/session-observer/scripts/lib/locate.mjs`
- Modify: `skills/session-observer/scripts/lib/rank.mjs`
- Modify: `tests/session-observer/locate.test.mjs`
- Modify: `tests/session-observer/rank.test.mjs`

**Step 1: Implement Cursor discovery**

Add `discoverCursor(targetCwd)`:

- Direct lookup: `~/.cursor/projects/<encoded-cwd>/agent-transcripts/*/*.jsonl`.
- Direct hits set `recordedCwd = targetCwd` and `cwdEvidence = "direct-parent-dir"`.
- Glob fallback scans `~/.cursor/projects/*/agent-transcripts/*/*.jsonl` within the same lookback policy as other runtimes.
- Fallback candidates carry `cwdSlug` and `cwdEvidence = "project-dir-slug"`.
- Do not depend on `repo.json`; local spike found repo files with only an `id` key, so slug evidence is the reliable baseline.

**Step 2: Verify**

Run: `node --test tests/session-observer/locate.test.mjs tests/session-observer/rank.test.mjs`
Expected: direct Cursor cwd lookup produces Tier A candidates; fallback slug evidence can rank above unrelated global recency.

**Step 3: Commit**

```bash
git add skills/session-observer/scripts/lib/locate.mjs skills/session-observer/scripts/lib/rank.mjs tests/session-observer/locate.test.mjs tests/session-observer/rank.test.mjs
git commit -m "feat(prev1-t03): discover Cursor agent transcripts"
```

---

### Task prev1-t04: (revision) Wire Cursor through CLI, state, and auto-runtime behavior

**Files:**

- Modify: `skills/session-observer/scripts/session-observer.mjs`
- Modify: `skills/session-observer/scripts/probe-local.mjs`
- Modify: `tests/session-observer/cli.test.mjs`
- Modify: `tests/session-observer/integration.test.mjs`

**Step 1: Wire runtime surface**

- Add `cursor` to the runtime allowlist, help text, `--session` validation, and state reset validation.
- Update `--runtime auto` behavior for three runtimes:
  - If `SESSION_OBSERVER_SELF` is set to a known runtime and exactly one other runtime has candidates, choose it.
  - If state has exactly one previously read same-cwd runtime among matching candidates, choose that runtime.
  - Otherwise return `ambiguousRuntime` with all matching runtimes.
- Update `probe-local.mjs --runtime cursor` to report `~/.cursor/projects/`.

**Step 2: Verify**

Run: `node --test tests/session-observer/cli.test.mjs tests/session-observer/integration.test.mjs`
Expected: `review`, `catch-up`, `locate`, `state reset --runtime cursor`, and pinned `--session cursor:<id>` work against temp HOME fixtures.

**Step 3: Commit**

```bash
git add skills/session-observer/scripts/session-observer.mjs skills/session-observer/scripts/probe-local.mjs tests/session-observer/cli.test.mjs tests/session-observer/integration.test.mjs
git commit -m "feat(prev1-t04): wire Cursor runtime through session-observer CLI"
```

---

### Task prev1-t05: (revision) Update docs and validate Cursor support end-to-end

**Files:**

- Modify: `skills/session-observer/SKILL.md`
- Modify: `skills/session-observer/references/transcript-formats.md`
- Modify: `.oat/projects/shared/session-observer/implementation.md`

**Step 1: Update docs**

- Add Cursor to runtime examples, flag docs, troubleshooting, and success criteria.
- Document Cursor's supported store as `~/.cursor/projects/<encoded-project>/agent-transcripts/<session-id>/<session-id>.jsonl`.
- Document `~/.cursor/chats/*/store.db` as intentionally out of scope for this revision.
- Record the local spike evidence in `implementation.md`: 19 agent transcript JSONL files across 12 project dirs; JSONL records have top-level `role` and `message.content[]`; observed blocks are `text` and `tool_use`; `repo.json` was not useful for cwd recovery.

**Step 2: Verify**

Run:

```bash
node --test 'tests/session-observer/*.test.mjs'
npm test
npm run validate
npm run smoke
node skills/session-observer/scripts/probe-local.mjs --runtime cursor --cwd "$PWD"
```

Expected: tests/validate/smoke pass. Cursor probe exits 0 or 2; exit 1 is a failure.

**Step 3: Refresh installed copies**

```bash
rsync -a --delete skills/session-observer/ ~/.agents/skills/session-observer/
```

Verify `~/.claude/skills/session-observer` still resolves to the refreshed `~/.agents/skills/session-observer`.

**Step 4: Commit**

```bash
git add skills/session-observer/SKILL.md skills/session-observer/references/transcript-formats.md .oat/projects/shared/session-observer/implementation.md
git commit -m "docs(prev1-t05): document Cursor session-observer support"
```

---

### Task prev1-t06: (review) Fix pinned-session auto-runtime ambiguity

**Files:**

- Modify: `skills/session-observer/scripts/session-observer.mjs`
- Modify: `tests/session-observer/cli.test.mjs`

**Step 1: Understand the issue**

Review finding: `runReview` and `runCatchUp` resolve `--runtime auto` before parsing `--session`, so `--runtime auto --session cursor:<id>` can return `ambiguousRuntime` before it reaches the pinned-session branch.
Location: `skills/session-observer/scripts/session-observer.mjs:258`

**Step 2: Implement fix**

Parse and validate `args.session` before auto-runtime resolution. When present, use the pinned runtime as the effective runtime, discover only that runtime, and keep the existing pinned-session validation/error behavior. Apply consistently to `review` and `catch-up`.

**Step 3: Verify**

Run: `node --test tests/session-observer/cli.test.mjs`
Expected: tests pass, including coverage for `--runtime auto --session cursor:<id>` when multiple runtimes have matching candidates.

**Step 4: Commit**

```bash
git add skills/session-observer/scripts/session-observer.mjs tests/session-observer/cli.test.mjs
git commit -m "fix(prev1-t06): honor pinned sessions before auto runtime"
```

---

### Task prev1-t07: (review) Add Cursor malformed and partial-tail fixtures

**Files:**

- Create: `tests/session-observer/fixtures/cursor/malformed.jsonl`
- Create: `tests/session-observer/fixtures/cursor/partial-tail.jsonl`
- Modify: `tests/session-observer/runtimes.test.mjs`

**Step 1: Understand the issue**

Review finding: Cursor fixture coverage is thinner than Claude/Codex; tolerant JSONL parsing is shared, but Cursor-flavored malformed and partial-tail fixtures would catch future Cursor-specific parser drift.
Location: `tests/session-observer/fixtures/cursor/`

**Step 2: Implement fix**

Add Cursor malformed and partial-tail JSONL fixtures mirroring the existing Claude/Codex tolerance cases. Add `readRecords` tests for Cursor warn-and-skip and warn-and-drop behavior.

**Step 3: Verify**

Run: `node --test tests/session-observer/runtimes.test.mjs`
Expected: Cursor fixture parity tests pass.

**Step 4: Commit**

```bash
git add tests/session-observer/fixtures/cursor tests/session-observer/runtimes.test.mjs
git commit -m "test(prev1-t07): add Cursor malformed transcript fixtures"
```

---

### Task prev1-t08: (review) Document Cursor direct-hit fallback behavior

**Files:**

- Modify: `skills/session-observer/scripts/lib/locate.mjs`
- Modify: `tests/session-observer/locate.test.mjs`

**Step 1: Understand the issue**

Review finding: Cursor direct lookup currently falls back to global project-dir scans when an encoded direct directory exists but has no JSONL transcripts; Claude suppresses fallback once the encoded directory is readable. This is acceptable, but the branch-specific behavior is easy to miss if Cursor gains more slug variants.
Location: `skills/session-observer/scripts/lib/locate.mjs:461-482`

**Step 2: Implement fix**

Document the intentional Cursor behavior in `locate.mjs` strategy comments and add/adjust a targeted locate test proving an empty direct Cursor transcript directory still allows fallback candidates.

**Step 3: Verify**

Run: `node --test tests/session-observer/locate.test.mjs`
Expected: Cursor fallback behavior is documented and covered.

**Step 4: Commit**

```bash
git add skills/session-observer/scripts/lib/locate.mjs tests/session-observer/locate.test.mjs
git commit -m "test(prev1-t08): document Cursor empty-direct fallback"
```

---

### Task prev1-t09: (review) Avoid duplicate stat in Cursor fallback discovery

**Files:**

- Modify: `skills/session-observer/scripts/lib/locate.mjs`
- Modify: `tests/session-observer/locate.test.mjs`

**Step 1: Understand the issue**

Review finding: `discoverCursor` stats fallback transcript files once for the 7-day cutoff and then `cursorCandidate()` stats them again to build the candidate. This is correct but unnecessary I/O.
Location: `skills/session-observer/scripts/lib/locate.mjs:502-517`

**Step 2: Implement fix**

Allow `cursorCandidate()` to accept a pre-read `fileStat` (or equivalent mtime/size values) and pass it from fallback discovery so each fallback transcript is statted only once.

**Step 3: Verify**

Run: `node --test tests/session-observer/locate.test.mjs`
Expected: Cursor direct/fallback discovery tests still pass.

**Step 4: Commit**

```bash
git add skills/session-observer/scripts/lib/locate.mjs tests/session-observer/locate.test.mjs
git commit -m "fix(prev1-t09): avoid duplicate Cursor transcript stat"
```

---

### Task prev1-t10: (review) Normalize symlinked cwd paths before ranking

**Files:**

- Modify: `skills/session-observer/scripts/lib/rank.mjs`
- Modify: `tests/session-observer/rank.test.mjs`

**Step 1: Understand the issue**

Review finding: `rank.tierOf` still compares raw path strings, so symlink-equivalent paths such as `/tmp/foo` and `/private/tmp/foo` may fail to match on macOS.
Location: `skills/session-observer/scripts/lib/rank.mjs:50-58`

**Step 2: Implement fix**

Add realpath normalization for `recordedCwd` and `targetCwd` before Tier A/B comparison, falling back to the original path when realpath fails. Preserve the current synchronous `tierOf` API or introduce a compatible async ranking path only if necessary.

**Step 3: Verify**

Run: `node --test tests/session-observer/rank.test.mjs`
Expected: existing rank tests pass and symlink-equivalent cwd coverage is added.

**Step 4: Commit**

```bash
git add skills/session-observer/scripts/lib/rank.mjs tests/session-observer/rank.test.mjs
git commit -m "fix(prev1-t10): normalize cwd paths before ranking"
```

---

### Task prev1-t11: (review) Skip no-op catch-up state writes

**Files:**

- Modify: `skills/session-observer/scripts/session-observer.mjs`
- Modify: `tests/session-observer/cli.test.mjs`
- Modify: `tests/session-observer/integration.test.mjs`

**Step 1: Understand the issue**

Review finding: `runCatchUp` calls `markRead` even when `digest.range.newRecords === 0`, causing unnecessary locked writes and lock contention for no-op catch-up runs.
Location: `skills/session-observer/scripts/session-observer.mjs:629-639`

**Step 2: Implement fix**

Guard catch-up state writes so the CLI skips `markRead` when no new raw records were consumed and an existing session state already matches the current offset. Preserve the first-read/session-initialization path.

**Step 3: Verify**

Run: `node --test tests/session-observer/cli.test.mjs tests/session-observer/integration.test.mjs`
Expected: catch-up behavior remains correct and no-op write coverage is added.

**Step 4: Commit**

```bash
git add skills/session-observer/scripts/session-observer.mjs tests/session-observer/cli.test.mjs tests/session-observer/integration.test.mjs
git commit -m "fix(prev1-t11): skip no-op catch-up state writes"
```

---

### Task prev1-t12: (review) Add Cursor digest smoke coverage

**Files:**

- Modify: `tests/session-observer/digest.test.mjs`

**Step 1: Understand the issue**

Review finding: Cursor digest behavior is covered by parser and CLI tests, but `digest.test.mjs` has direct `buildDigest` smoke cases only for Claude Code and Codex.
Location: `tests/session-observer/digest.test.mjs`

**Step 2: Implement fix**

Add a `buildDigest('cursor', ...)` smoke test using the Cursor typical fixture to ensure future digest refactors exercise Cursor directly.

**Step 3: Verify**

Run: `node --test tests/session-observer/digest.test.mjs`
Expected: digest tests pass with Cursor coverage.

**Step 4: Commit**

```bash
git add tests/session-observer/digest.test.mjs
git commit -m "test(prev1-t12): add Cursor digest smoke coverage"
```

---

### Task prev1-t13: (review) Lock load-time state backup writes

**Files:**

- Modify: `skills/session-observer/scripts/lib/state.mjs`
- Modify: `tests/session-observer/state.test.mjs`

**Step 1: Understand the issue**

Review finding: final re-review confirmed `load()` can still write corrupt/v0 backup files outside the `mutate` lock. Existing unique atomic backup filenames make this bounded, but routing load-time backups through the lock removes the residual race entirely.
Location: `skills/session-observer/scripts/lib/state.mjs:139`, `:154`, `:158`

**Step 2: Implement fix**

Ensure backup writes triggered by the public `load()` path are lock-protected, or refactor backup writing so lock ownership is explicit and safe. Preserve current state-file schema, migration persistence, and corrupt-state recovery behavior.

**Step 3: Verify**

Run: `node --test tests/session-observer/state.test.mjs`
Expected: state tests pass and load-time backup locking behavior is covered.

**Step 4: Commit**

```bash
git add skills/session-observer/scripts/lib/state.mjs tests/session-observer/state.test.mjs
git commit -m "fix(prev1-t13): lock load-time state backups"
```

---

## Reviews

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | passed  | 2026-05-15 | reviews/archived/p01-review-2026-05-15.md |
| p02    | code     | passed  | 2026-05-15 | reviews/archived/p02-rereview-2026-05-15.md |
| p03    | code     | passed  | 2026-05-15 | reviews/archived/p03-review-2026-05-15.md |
| p04    | code     | passed  | 2026-05-15 | reviews/archived/p04-review-2026-05-15.md |
| p05    | code     | passed  | 2026-05-15 | reviews/archived/p05-rereview-2026-05-15.md |
| p06    | code     | passed  | 2026-05-15 | reviews/archived/p06-review-2026-05-15.md |
| p07    | code     | passed  | 2026-05-15 | reviews/archived/p07-review-2026-05-15.md |
| p-rev1 | code     | passed | 2026-05-22 | reviews/archived/p-rev1-rereview-2026-05-22.md |
| final  | code     | received | 2026-05-22 | reviews/final-review-2026-05-22.md |
| spec   | artifact | pending  | -          | -                                               |
| design | artifact | received | 2026-05-14 | reviews/artifact-design-review-2026-05-14.md   |
| plan   | artifact | received | 2026-05-14 | reviews/artifact-plan-review-2026-05-14.md     |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

---

## Implementation Complete

**Summary (to be filled by oat-project-implement):**

- Phase 1: 2 tasks — Skill scaffolding + state module with locking
- Phase 2: 2 tasks — JSONL fixtures + per-runtime adapters
- Phase 3: 2 tasks — Candidate discovery + tier-based ranking
- Phase 4: 4 tasks — Digest builder + CLI + probe-local helper + integration test
- Phase 5: 3 tasks — Full SKILL.md body + watch-design reference + transcript-formats reference
- Phase 6: 2 tasks — npm run validate + manual local probe verification
- Phase 7: 4 tasks — Final-review fix tasks (Codex payload.cwd, --session override ordering, bidirectional Tier B, state.mjs hardening)
- Phase p-rev1: 13 tasks — Dogfood hardening + Cursor agent transcript support + review fixes

**Total: 32 tasks**

Ready for focused p-rev1/final re-review. Not ready for merge until p-rev1/final re-reviews pass.

---

## References

- Design: `.oat/projects/shared/session-observer/design.md`
- Discovery: `.oat/projects/shared/session-observer/discovery.md`
- Source-of-truth spec: `.superpowers/specs/2026-05-14-session-observer-design.md`
- Implementation reference (read-only): `/Users/thomas.stang/Code/stoa/apps/server/src/client/adapters/{claude-code,codex}.ts`
- Implementation reference (read-only): `/Users/thomas.stang/Code/stoa/apps/server/src/client/templates/claude-code-stoa-session-capture.sh.tpl`
- Skill authoring convention: `/Users/thomas.stang/Code/stoa/.agents/skills/create-agnostic-skill/SKILL.md`
