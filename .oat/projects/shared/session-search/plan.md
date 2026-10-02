---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-10-02
oat_phase: plan
oat_phase_status: in_progress
oat_plan_parallel_groups: []
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: true
---

# Implementation Plan: session-search

> Execute this plan using `oat-project-implement` — sequential by default, parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Ship a `session-search` skill (standalone + `session` plugin `search`). It lets any coding agent find a past Claude Code, Codex, or Cursor session on the local machine from agent-expanded patterns plus optional time and cwd hints. Results are a ranked, redacted candidate list.

**Architecture:** Agent guidance (`SKILL.md`) and a dependency-free bundled Node CLI. The CLI runs tiers cheapest-first: history files, then metadata indexes (Codex `state_5.sqlite` via the optional `sqlite3` CLI), then bounded user/assistant content (optional `rg -l` prefilter plus Node streaming verification), then a deep tool-output rung. It applies cwd-first auto-widening, a large-scan guard, and subagent roll-up, and reuses `src/shared/transcript/runtimes.ts`. See `design.md`.

**Tech Stack:** TypeScript (ESM, Node 22+, `node:` builtins only), esbuild generated bundles via `scripts/build-generated.ts`, Vitest, oxlint/oxfmt.

**Commit Convention:** `{type}({scope}): {description}`, e.g. `feat(p01-t01): add session-search option parsing`

**Conventions every task follows:**

- Source lives only under `src/skills/session-search/`. Never hand-edit the generated `skills/session-search/**` or `plugins/session/skills/search/**`; regenerate with `pnpm run build`.
- **Format** each authored file the task creates or edits (never generated outputs, `AGENTS.md`/`CLAUDE.md`, or `.agents/**`): `pnpm exec oxfmt --write <files…>`. **Lint** them: `pnpm exec oxlint <files…>`.
- Scoped tests: `pnpm run test:vitest <path>`.
- Tests that execute the CLI use the generated bundle and a temporary `HOME` + `STATE_DIR`, with harness-detection env vars blanked (per `src/AGENTS.md`).

## Planning Checklist

- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter
- [ ] Confirmed HiLL checkpoints (`oat-project-implement` confirms at start)

---

## Parallelism

The plan is sequential (`oat_plan_parallel_groups: []`):

- **p02 depends on p01.** The adapters, scanner, pipeline, and ranker import p01's options, matcher, redact, tools, and types.
- **p03 depends on p02.** CLI integration tests execute the generated bundle, which needs the complete source and the distribution entry.
- **p04 cannot run beside p03.** Both phases run `pnpm run build`, which rewrites shared generated roots (`skills/**`, `plugins/session/**`, and observer/export reference copies when the stale-path fix lands). Both also touch the session plugin manifests and marketplace metadata, so they would conflict in isolated worktrees.

---

## Phase 1: Core library (options, matching, redaction, tool probe)

### Task p01-t01: Scaffold source tree, shared-library shim, and core types

**Files:**

- Create: `src/skills/session-search/src/lib/runtimes.ts` (one-line shim: `export * from '../../../../shared/transcript/runtimes.js';`)
- Create: `src/skills/session-search/src/lib/types.ts`. Shared types from `design.md` Data Models:
  - `Runtime` (re-exported)
  - `SearchOptions`
  - `SessionFile`
  - `SessionInfo`
  - `TextUnit`
  - `Hit`
  - `SessionHit`
  - `SearchResult` (with `schema: 'session-search/v1'`)
  - `SourceAdapter`
  - `AdapterContext`
  - `StoreRoots`
- Create: `src/skills/session-search/src/lib/types.test.ts`. A compile-level test: a minimal `SearchResult` object literal type-checks, and `schema` is the literal `'session-search/v1'`.

**Step 1: Write test (RED).** Write `types.test.ts` asserting a constant built from the types has the expected shape.
**Step 2: Implement (GREEN).** Add the types and the shim.
**Step 3: Format/Lint.** `pnpm exec oxfmt --write src/skills/session-search/src/lib/*.ts && pnpm exec oxlint src/skills/session-search/src/lib`
**Step 4: Verify.** `pnpm run test:vitest src/skills/session-search/src/lib/types.test.ts && pnpm run type-check`. Expected: pass.
**Step 5: Commit.** `git add src/skills/session-search && git commit -m "feat(p01-t01): scaffold session-search types and transcript shim"`

---

### Task p01-t02: Options and time-window parsing

**Files:**

- Create: `src/skills/session-search/src/lib/options.ts`
- Create: `src/skills/session-search/src/lib/options.test.ts`

**Behavior:**

- `parseTimeSpec(spec, now)` accepts:
  - `Nh`, `Nd`, `Nw` (relative to `now`)
  - `today` / `yesterday` (local midnight boundaries; `yesterday` as `--since` means start-of-yesterday, as `--until` means start-of-today)
  - ISO dates and date-times

  It returns epoch ms, and throws a usage error naming the bad value.
- `resolveOptions(rawValues)` produces a `SearchOptions` with:
  - defaults: `limit` 15, `maxLineBytes` 65536, `largeScanBytes` 2 GiB, `deep` on, `includeTools` false, all runtimes, tiers `history,meta,content`
  - `--until` earlier than `--since` rejected
  - `--cwd` normalized (resolved, trailing slash stripped, `~` expanded against `HOME`)

**Step 1 (RED):** Tests for each spec form, the boundaries, invalid input, the since/until ordering, cwd normalization, and the defaults.
**Step 2 (GREEN):** Implement.
**Step 3:** Format and lint the two files (commands as in p01-t01, scoped to these files).
**Step 4 (Verify):** `pnpm run test:vitest src/skills/session-search/src/lib/options.test.ts`. Expected: pass.
**Step 5 (Commit):** `feat(p01-t02): add session-search option and time-window parsing`

---

### Task p01-t03: Pattern matcher and snippet builder

**Files:**

- Create: `src/skills/session-search/src/lib/matcher.ts`
- Create: `src/skills/session-search/src/lib/matcher.test.ts`

**Behavior:**

- `compileMatcher(patterns, { literal })`
  - Builds case-insensitive regexes, escaping patterns when `literal` is set. An invalid regex becomes a usage error naming the pattern and suggesting `--literal`.
  - `matcher.match(text)` returns `{ patterns: string[], firstIndex, firstLength } | null`.
- `buildSnippet(text, index, length)`
  - Takes ±80 chars around the hit and collapses whitespace.
  - Caps the result at 240 chars, with ellipses when truncated.

**Steps:** RED tests (regex vs literal, case-insensitivity, per-pattern attribution with several patterns, snippet windowing, truncation) → GREEN → format/lint → verify `pnpm run test:vitest src/skills/session-search/src/lib/matcher.test.ts` → commit `feat(p01-t03): add session-search pattern matcher and snippets`.

---

### Task p01-t04: Redaction

**Files:**

- Create: `src/skills/session-search/src/lib/redact.ts`
- Create: `src/skills/session-search/src/lib/redact.test.ts`

**Behavior:** `redact(text)` masks the following as `[REDACTED]`, leaving ordinary prose, paths, and UUIDs intact:

- `sk-…`/`sk-ant-…` keys
- `ghp_`/`gho_`/`ghs_`/`github_pat_…`
- `xox[abprs]-…`
- `AKIA[0-9A-Z]{16}`
- `Bearer <token>`
- `(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S+` values
- hex runs of 40 or more chars and base64 runs of 40 or more chars

**Steps:** RED tests (one per shape, plus negatives: a git SHA of exactly 40 hex chars inside an obvious `commit` context is still masked, which is acceptable and documented; UUIDs and normal words are untouched) → GREEN → format/lint → verify `pnpm run test:vitest src/skills/session-search/src/lib/redact.test.ts` → commit `feat(p01-t04): add session-search snippet redaction`.

---

### Task p01-t05: External tool probe

**Files:**

- Create: `src/skills/session-search/src/lib/tools.ts`
- Create: `src/skills/session-search/src/lib/tools.test.ts`

**Behavior:**

- `probeTools(env)` resolves `rg` and `sqlite3` paths. Resolution order:
  1. Explicit `SESSION_SEARCH_RG` / `SESSION_SEARCH_SQLITE3`. An invalid explicit path becomes `null` with a note.
  2. Forced fallback `SESSION_SEARCH_NO_RG=1` / `SESSION_SEARCH_NO_SQLITE3=1`, which yields `null`.
  3. A `PATH` lookup.
  4. The absolute candidates `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`.
- Each candidate is verified by `spawnSync(path, ['--version'], { timeout: 3000 })`, with `ENOENT` treated as absent. The probe never throws.

**Steps:**

- RED tests:
  - The `NO_*` overrides yield `null`.
  - An override pointing at a temp executable stub script (`#!/bin/sh\necho stub`) resolves to that path.
  - A nonexistent override yields `null` plus a note.
- GREEN.
- Format/lint.
- Verify `pnpm run test:vitest src/skills/session-search/src/lib/tools.test.ts`.
- Commit `feat(p01-t05): add session-search rg/sqlite3 probe`.

---

## Phase 2: Adapters, scanner, pipeline, ranker, CLI

### Task p02-t01: Claude Code adapter

**Files:**

- Create: `src/skills/session-search/src/lib/adapters/claude-code.ts`
- Create: `src/skills/session-search/src/lib/adapters/claude-code.test.ts`
- Create: `src/skills/session-search/src/lib/test-helpers.ts`. A temp-HOME builder that writes synthetic stores for all three runtimes, including real-shaped Codex `rollout-<ts>-<uuid>.jsonl` with a `session_meta` header, and sets mtimes via `utimes`. It is shared by later tests.

**Behavior (per `design.md` Source adapters):**

- Enumerate the parent `~/.claude/projects/*/*.jsonl` files and the subagent `*/<sid>/subagents/**/*.jsonl` files (`isSubagent`, `parentSessionId=<sid>`) using stat only.
- `historyHits` streams `~/.claude/history.jsonl` (`display`, `project`, `sessionId`, `timestamp`). A hit is user-typed, with tier `history`.
- `metadataHits` reads `ai-title`/`custom-title` from candidate files via `readMetadataRecordsBounded` (bounded bytes).
- `sessionInfo` reads cwd, first prompt, and `startedAt` with a bounded read.
- `classifyRecord` maps the record through `normalizeEntries('claude-code', [record], {includeToolCalls, includeToolResults})` to role-tagged `TextUnit`s.
- Injected-context demotion: user text starting with `<system-reminder>`, `<environment_context>`, `<user_instructions>`, `<command-` or `# AGENTS.md instructions` becomes `context`.
- Open hint: `claude --resume <sessionId>` plus "run from <cwd>".

**Steps:** RED tests (enumeration incl. subagents; history parse; title extraction; classifyRecord roles; tool text only with includeTools; injected demotion; missing root yields `absent`) → GREEN → format/lint → verify `pnpm run test:vitest src/skills/session-search/src/lib/adapters/claude-code.test.ts` → commit `feat(p02-t01): add session-search Claude Code adapter`.

---

### Task p02-t02: Codex adapter (history, session_index, sqlite threads, archived)

**Files:**

- Create: `src/skills/session-search/src/lib/adapters/codex.ts`
- Create: `src/skills/session-search/src/lib/adapters/codex.test.ts`

**Behavior:**

- **Enumerate** `~/.codex/sessions/**/rollout-*.jsonl` and `~/.codex/archived_sessions/rollout-*.jsonl` (`archived: true`).
- **Parent/child:** a bounded `session_meta` read determines this. When `payload.id !== payload.session_id`, the file is a child with `parentSessionId = payload.session_id`. The adapter caches the header per file.
- **History:** `~/.codex/history.jsonl` `{session_id, ts(seconds), text}`, user-typed.
- **Meta:**
  - `session_index.jsonl` `{id, thread_name, updated_at}` provides title hits.
  - When `sqlite3` is available and `~/.codex/state_5.sqlite` exists:
    1. Run `sqlite3 -readonly -json <db> "PRAGMA table_info(threads)"` and require `id, rollout_path`.
    2. Select the available subset of `title, first_user_message, cwd, created_at, updated_at, archived, git_origin_url`.
    3. Match title/first message in Node (title tier `meta`; first message is user-typed).
  - Any failure marks the source `degraded` with a note and never throws. `spawnSync` has a timeout and output cap.
- **Open hint:** `codex resume <id>`.

**Steps:**

- RED tests:
  - Archived enumeration and labeling.
  - Child detection via `session_meta`.
  - History and session_index parsing.
  - The sqlite path using a **stub `sqlite3` script** that prints canned JSON for the PRAGMA and the SELECT (selected through `SESSION_SEARCH_SQLITE3`).
  - A stub missing `rollout_path` yields `degraded`.
  - `SESSION_SEARCH_NO_SQLITE3=1` skips the sqlite tier cleanly.
- GREEN.
- Format/lint.
- Verify `pnpm run test:vitest src/skills/session-search/src/lib/adapters/codex.test.ts`.
- Commit `feat(p02-t02): add session-search Codex adapter`.

---

### Task p02-t03: Cursor adapter

**Files:**

- Create: `src/skills/session-search/src/lib/adapters/cursor.ts`
- Create: `src/skills/session-search/src/lib/adapters/cursor.test.ts`

**Behavior:**

- Enumerate `~/.cursor/projects/*/agent-transcripts/<id>/<id>.jsonl` plus `subagents/`. Time is the mtime.
- There is no history or meta tier: both return `[]`.
- Cwd hint matching uses `encodeCwdVariants('cursor', cwd)` against the project dir slug.
- `classifyRecord` uses `normalizeEntries('cursor', …)`.
- Open hint: the transcript path ("open in Cursor").

**Steps:** RED (enumeration, slug match, classification) → GREEN → format/lint → verify `pnpm run test:vitest src/skills/session-search/src/lib/adapters/cursor.test.ts` → commit `feat(p02-t03): add session-search Cursor adapter`.

---

### Task p02-t04: Content scanner

**Files:**

- Create: `src/skills/session-search/src/lib/scan.ts`
- Create: `src/skills/session-search/src/lib/scan.test.ts`

**Behavior:**

- **Prefilter:** `prefilterWithRg(rgPath, patterns, files, {literal})` runs `rg -l -i --no-messages [-F] -e p… -- <chunk>`, chunking the argument list to ≤ 100 KB per call. Exit 1 means no matches. Any other error returns `null`, so the caller falls back to scanning all files.
- **Verification:** `scanFile(path, adapter, matcher, {maxLineBytes, includeTools, maxHitsPerSession})`
  - Streams with a LF-only splitter: read in chunks and split on `0x0A`, not with `readline`, because U+2028/2029 can appear inside strings.
  - Skips oversize lines before `JSON.parse` and counts them.
  - Calls `adapter.classifyRecord`, matches each unit, and returns hits with role, tier `content` or `deep`, and snippet inputs.
  - Counts parse errors.

**Steps:**

- RED tests:
  - LF-only splitting with U+2028 inside a string.
  - Oversize-line skip counted.
  - Tool-output text not matched by default and matched with `includeTools`.
  - `maxHitsPerSession` stop.
  - The rg prefilter (when `rg` is available in the test env; otherwise `it.skipIf`) returns the same matching file set as a full Node scan.
  - The Node-only path (`SESSION_SEARCH_NO_RG=1`) gives identical hits.
- GREEN.
- Format/lint.
- Verify `pnpm run test:vitest src/skills/session-search/src/lib/scan.test.ts`.
- Commit `feat(p02-t04): add session-search content scanner`.

---

### Task p02-t05: Ranker

**Files:**

- Create: `src/skills/session-search/src/lib/rank.ts`
- Create: `src/skills/session-search/src/lib/rank.test.ts`

**Behavior:**

- `rankSessions(hits, sessions, {patterns, cwdHints, limit})`
  - Groups hits by session and rolls subagent hits up to an existing parent (`via: 'subagent'`, half weight). Orphans are listed with `isSubagent: true`.
  - Scores with the `design.md` formula.
  - Ties break by `lastActivity` desc, then `runtime`, then `sessionId`.
  - Attaches up to 3 redacted snippets (user > title > assistant > context > tool, then by tier order), and `matchedPatterns` and `matchedTiers`.
  - Applies `limit` and assigns `rank`.

**Steps:**

- RED tests:
  - User-typed beats assistant-only with an equal pattern count.
  - More distinct patterns beats more raw hits.
  - The title boost.
  - The cwd-hint boost.
  - The recency tie-break.
  - Subagent roll-up and orphan listing.
  - Redaction applied to snippets and firstPrompt.
  - Deterministic output across input orderings.
- GREEN.
- Format/lint.
- Verify `pnpm run test:vitest src/skills/session-search/src/lib/rank.test.ts`.
- Commit `feat(p02-t05): add session-search ranking`.

---

### Task p02-t06: Search pipeline

**Files:**

- Create: `src/skills/session-search/src/lib/pipeline.ts`
- Create: `src/skills/session-search/src/lib/pipeline.test.ts`

**Behavior:** `runSearch(options, env)` follows the `design.md` data flow:

1. Probe tools.
2. Enumerate sessions per selected runtime and apply the time window (activity interval overlap via mtime; meta `created_at` when known).
3. Pass 1 scoped to cwd hints (equal or descendant after normalization; Cursor by slug).
4. Run T1, then T2, then T3 over the candidates, with the large-scan guard measured after window and scope narrowing. Over the threshold without `allowLargeScan`, restrict T3 to sessions hit in T1/T2 and set `needsConfirmation`.
5. Zero sessions with a cwd scope: run unscoped and set `widened: true`.
6. Still zero and `deep` enabled: T4 (`includeTools`) under the same guard.
7. Rank and assemble `SearchResult`, with `host` (os.hostname/platform), `tools`, `tiersRun`, `sources`, and `diagnostics`. An optional `deadlineMs` yields partial results with `incomplete: true`.

**Steps:**

- RED tests on temp-HOME corpora via `test-helpers.ts`:
  - Cross-runtime target found and ranked first.
  - Time window excludes old sessions.
  - A cwd-hint miss widens.
  - A tool-only phrase found only by deep; `deep: false` yields zero results.
  - The large-scan guard with a tiny threshold sets `needsConfirmation` and still returns T1/T2 hits; `allowLargeScan` returns full results.
  - Archived Codex is found and labeled.
  - No stores: all sources `absent`.
  - Each negative test fails if its feature is removed.
- GREEN.
- Format/lint.
- Verify `pnpm run test:vitest src/skills/session-search/src/lib/pipeline.test.ts`.
- Commit `feat(p02-t06): add session-search tiered pipeline`.

---

### Task p02-t07: CLI entry

**Files:**

- Create: `src/skills/session-search/src/session-search.ts`

**Behavior:**

- **Parsing:** `node:util` `parseArgs` with `strict: false` and narrowed values, following the repo convention.
- **Subcommands:** `search` (default) and `estimate`. `estimate` gives per-runtime file counts and bytes within the window.
- **Flags:** exactly as in `design.md` API Design. `-p/--pattern` is repeatable, and at least one pattern is required for search.
- **Output:**
  - `--json` emits `SearchResult` (2-space JSON plus a newline).
  - Otherwise it prints a compact text table plus notes for `widened`, `needsConfirmation`, and degraded sources.
  - Errors are prefixed `[session-search]` on stderr.
- **Exit codes:** 0 results, 2 none, 3 needsConfirmation, 1 usage or error.
- **Bundling:** a realpath-safe main guard so it runs through symlinked installs (match the existing CLI entry guard pattern; see commit `666daccc`).

**Steps:**

- Implement.
- Format/lint.
- Verify with `pnpm run type-check`. CLI behavior is integration-tested in p03 after the bundle exists.
- Commit `feat(p02-t07): add session-search CLI entry`.

---

## Phase 3: Skill packaging, distribution, CLI integration tests

### Task p03-t01: SKILL.md agent guidance and references

**Files:**

- Create: `src/skills/session-search/SKILL.md`
  - Frontmatter per repo contract (`name`, a "Use when…" `description` that triggers on "search/find a past session/conversation where we…", `license`, `compatibility: requires Node.js 22+…`, `argument-hint`, `allowed-tools`, `metadata.author`, `metadata.version: '0.1.0'`). The title is `# {{distribution.name}}`.
  - Body: the `design.md` "Agent guidance" outline:
    - intake (incl. asking for remembered exact phrases; skip what is already known)
    - pattern expansion
    - CLI invocation with `--json`
    - the presentation format
    - the empty/weak-result ladder (broaden, then large-scan confirmation, then deep rung reported, then the ChatGPT question, then the other-machine offer)
    - opt-in remote search
    - privacy rules
    - exit-code handling
- Create: `src/skills/session-search/references/store-layouts.md`. A compact store map: paths, history and index fields, sqlite threads columns, subagent/child rules, archived sessions. It points to `documentation/docs/engineering/architecture/session-schemas/` for full schemas.
- Create: `src/skills/session-search/references/remote-fallback.md`
  - Opt-in remote recipe: BatchMode check, locating the remote skill install, PATH prefix for Homebrew tools.
  - Read-only tier 1–2 one-liners for when the skill isn't installed remotely: `rg -i` over the history files with absolute-path fallbacks, and a `sqlite3 -readonly` thread query.
  - No hostnames.

**Steps:** write the files → format/lint (`pnpm exec oxfmt --write src/skills/session-search/SKILL.md src/skills/session-search/references/*.md`) → verify via p03-t02's build and validate → commit `feat(p03-t01): add session-search skill guidance and references`.

---

### Task p03-t02: Build config, distribution entry, plugin metadata, pinned lists

**Files:**

- Create: `src/skills/session-search/build.json`. It lists `src/session-search.ts` and every `src/lib/**/*.ts` runtime file including `lib/runtimes.ts` (shape per `session-export-transcript/build.json`; no test files).
- Modify: `src/distributions.ts`. Add an owner entry `session-search` with `source: 'src/skills/session-search'` and `allowedSourceRoots: ['src/shared/transcript']`. Targets:
  - standalone `skills/session-search`
  - plugin `session` / `search` → `plugins/session/skills/search`
- Modify the pinned test lists so the new skill is expected:
  - `tests/release/versioning.test.ts` (skill file lists and the SKILL_FILES pin, generated list)
  - `tests/repo/layout.test.ts` (standaloneSkills, requiredDirectories)
  - `tests/repo/plugin-manifests.test.ts` and `tests/repo/marketplace-manifests.test.ts` (session skills list now includes `search`; description)
  - `tests/tooling/generated-output-sync.test.ts` only if its roots are enumerated explicitly
- Modify the session plugin description consistently to mention search, e.g. "Session messaging, retrospective, handoff, transcript export, session search, and destination-fork guidance for coding-agent conversations.". This covers:
  - `plugins/session/.claude-plugin/plugin.json`
  - `plugins/session/.cursor-plugin/plugin.json`
  - `plugins/session/.codex-plugin/plugin.json` (plus `interface` prose)
  - `.claude-plugin/marketplace.json`
  - `.cursor-plugin/marketplace.json`
  - `.agents/plugins/marketplace.json`
- Bump the session plugin version: `pnpm tsx scripts/bump-version.ts 0.4.0 --plugin session`. Do not hand-edit versions.

**Steps:**

- Edit.
- `pnpm run build`.
- `pnpm run build:check`.
- Format/lint the authored JSON/TS files with the oxfmt/oxlint file-scoped commands (generated outputs excluded).
- Verify `pnpm run validate && pnpm run test:vitest tests/repo tests/release tests/tooling`. Expected: pass.
- Commit `feat(p03-t02): distribute session-search standalone and in session plugin`. This includes the generated outputs produced by the build.

---

### Task p03-t03: CLI integration tests against the generated bundle

**Files:**

- Create: `src/skills/session-search/src/cli.test.ts`

**Behavior.** The test uses `CLI_PATH = new URL('../../../../skills/session-search/scripts/session-search.mjs', import.meta.url)` and `spawnSync('node', [CLI_PATH, …], { env: { HOME, STATE_DIR, …blank harness vars } })` with a temp HOME per test (from `test-helpers.ts`). Cases from `design.md` Integration Tests:

- cross-runtime ranked-first with valid `session-search/v1` JSON
- `--since 24h`
- cwd-hint widening
- deep rung, and `--no-deep` gives exit 2
- large-scan guard: exit 3, then `--allow-large-scan`
- no stores: exit 2
- `estimate` output
- text (non-JSON) output smoke
- `--help` exit 0, and a bad regex / missing pattern exit 1
- identical JSON results with `SESSION_SEARCH_NO_RG=1`

**Steps:**

- Write the tests.
- `pnpm run build`.
- Verify `pnpm run test:vitest src/skills/session-search/src/cli.test.ts`. Expected: pass.
- Format/lint the test file.
- Commit `test(p03-t03): add session-search CLI integration tests`.

---

## Phase 4: Documentation, stale-path fix, release notes, full verification

### Task p04-t01: User-guide and architecture docs

**Files:**

- Create: `documentation/docs/user-guide/skills/session-search.md` (what it searches, the tiers, hints, the ladder, ChatGPT and multi-machine notes, privacy, exit codes, `session:search` / standalone naming, and that "search sessions" requests route to it)
- Modify: `documentation/docs/user-guide/skills/meta.json` and `documentation/docs/user-guide/skills/index.md`
- Modify: `documentation/docs/user-guide/plugins/session/index.md` (skill table) and its `meta.json` if pages are listed
- Modify: `documentation/index.md` and `documentation/docs/user-guide/installation.md` (mapping table)
- Modify: `documentation/docs/engineering/architecture/session-schemas/index.md`. Add a short "Discovery indexes" section: `~/.claude/history.jsonl`, `~/.codex/history.jsonl`, `session_index.jsonl`, `state_5.sqlite` threads, `archived_sessions/`, with field lists and a note that they are internal and may drift.

**Steps:** write/edit → format (`pnpm exec oxfmt --write <those files>`) → verify `pnpm run test:vitest tests/repo` (docs presence and links) and `pnpm run validate` → commit `docs(p04-t01): document session-search skill and discovery indexes`.

---

### Task p04-t02: Fix stale Codex transcript path in existing skill docs

**Files (canonical sources only):**

- Modify: `src/skills/session-export-transcript/SKILL.md` (store-locations table: `session-<id>.jsonl` → `rollout-<timestamp>-<uuid>.jsonl`)
- Modify: `src/skills/session-export-transcript/references/transcript-formats.md`
- Modify: `src/skills/session-observer/references/transcript-formats.md` (both occurrences)
- Bump the patch `metadata.version` of `session-export-transcript` and `session-observer` (required by `validate-skill-versions`).

**Steps:**

- Edit.
- Check `tests/repo/docs-presence.test.ts` expectations.
- `pnpm run build` to refresh the generated copies.
- `pnpm run build:check`.
- Verify `pnpm run test:vitest tests/repo src/skills/session-export-transcript src/skills/session-observer`.
- Format the edited Markdown.
- Commit `docs(p04-t02): correct Codex rollout transcript path in session skill docs`.

---

### Task p04-t03: Changelog and full premerge verification

**Files:**

- Modify: `CHANGELOG.md`. Under `## [Unreleased]`, add `### Added` (session-search skill) and `### Fixed` (Codex path docs).

**Steps:**

- Edit and format.
- Run `pnpm run premerge`. Expected: the full chain passes. If it fails, fix in scope and re-run.
- Run `pnpm run validate:skill-versions -- --base-ref main`.
- Commit `docs(p04-t03): add session-search changelog entry`.

---

## Reviews

| Scope | Type     | Status  | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| ----- | -------- | ------- | ---- | -------- | ------------- | ---------- | ----------- |
| p01   | code     | pending | -    | -        | -             | -          | -           |
| p02   | code     | pending | -    | -        | -             | -          | -           |
| p03   | code     | pending | -    | -        | -             | -          | -           |
| p04   | code     | pending | -    | -        | -             | -          | -           |
| final | code     | pending | -    | -        | -             | -          | -           |
| plan  | artifact | pending | -    | -        | -             | -          | -           |

For code-review events, `Reviewed Head` is the full 40-character SHA at the
head of the reviewed range. `Invocation` records `manual`, `auto`, or `gate`;
`Gate Target` is populated only for gate events. Legacy five-column rows remain
valid. Writers must preserve every existing row and every unknown trailing
cell; never truncate a widened row back to five columns.

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

---

## Implementation Complete

**Summary:**

- Phase 1: 5 tasks. Core library: types/shim, options/time, matcher/snippets, redaction, tool probe.
- Phase 2: 7 tasks. Adapters (Claude Code, Codex, Cursor), content scanner, ranker, pipeline, CLI entry.
- Phase 3: 3 tasks. SKILL.md and references, build/distribution/plugin metadata/pinned lists, CLI integration tests.
- Phase 4: 3 tasks. Docs, stale-path fix, changelog plus premerge.

**Total: 18 tasks**

## References

- Discovery: `discovery.md`
- Design: `design.md`
- Execution learnings: `oat-execution-learnings.md`
- Session schemas: `documentation/docs/engineering/architecture/session-schemas/`
- Shared transcript library: `src/shared/transcript/runtimes.ts`
- Adding a skill: `documentation/docs/engineering/contributing/development/adding-a-skill.md`
