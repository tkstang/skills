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
- **p04 cannot run beside p03.** Both phases run `pnpm run build`, which rewrites shared generated roots (`skills/**`, `plugins/session/**`, and observer/export reference copies when the stale-path fix lands). p04's docs and changelog also describe what p03 ships, so they would conflict or drift in isolated worktrees.

---

## Phase 1: Core library (options, matching, redaction, tool probe)

### Task p01-t01: Scaffold source tree, shared-library shim, and core types

**Files:**

- Create: `src/skills/session-search/src/lib/runtimes.ts` (one-line shim: `export * from '../../../../shared/transcript/runtimes.js';`)
- Create: `src/skills/session-search/src/lib/sanitize.ts`. A one-line shim re-exporting `HIDDEN_PAYLOAD_MATCHERS` from the export skill: `export { HIDDEN_PAYLOAD_MATCHERS } from '../../../session-export-transcript/src/sanitize.js';`. This reuses the repo's injected-payload table rather than duplicating it; p03-t02 adds the matching `allowedSourceRoots` entry, following the session-observer-collab precedent for cross-skill roots.
- Create: `src/skills/session-search/src/lib/types.ts`. Shared types from `design.md` Data Models:
  - `Runtime` (re-exported with `export type` because of `verbatimModuleSyntax`)
  - `SearchOptions`
  - `SessionFile`
  - `SessionInfo`
  - `TextUnit` (role `user | assistant | context | tool`)
  - `Hit`
  - `SessionHit`
  - `SearchResult` (with `schema: 'session-search/v1'`)
  - `SourceAdapter`
  - `AdapterContext`
  - `StoreRoots`

This task has no runtime test: types-only code is verified by `type-check`, because hand-built fixture assertions are disallowed by `src/AGENTS.md`.

**Step 1: Implement.** Add the types and the two shims.
**Step 2: Format/Lint.** `pnpm exec oxfmt --write src/skills/session-search/src/lib/*.ts && pnpm exec oxlint src/skills/session-search/src/lib`
**Step 3: Verify.** `pnpm run type-check`. Expected: pass.
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

**Behavior:** `redact(text)` masks the following as `[REDACTED]`, leaving ordinary prose, slash-separated paths, and UUIDs intact:

- `sk-…`/`sk-ant-…` keys
- `ghp_`/`gho_`/`ghs_`/`github_pat_…`
- `xox[abprs]-…`
- `AKIA[0-9A-Z]{16}`
- `Bearer <token>`
- case-insensitive key-value secrets whose key contains a credential word, allowing identifier prefixes and suffixes, **in plain, JSON-quoted, and JSON-escaped forms**:
  - The key may be wrapped in `"`, `'`, or an escaped `\"` (as in raw serialized records).
  - The separator is `:` or `=` with optional surrounding whitespace.
  - The value is masked **completely**:
    - a full double-quoted string, honoring escapes and spaces, e.g. `"pass word"`
    - a full escaped-quoted string (`\"…\"`)
    - a single-quoted string
    - otherwise the `\S+` run up to a delimiter (`,`, `}`, `&`)

  The credential words are `password|passwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key`. Examples: `API_KEY=…`, `AWS_SECRET_ACCESS_KEY=…`, `{"password":"x"}`, `{"API_KEY":"x y"}`, `{\"token\":\"x\"}`.
- **Representation boundary:** every emitted string (snippet, title, firstPrompt) is redacted from the full text unit before windowing. On the deep raw fallback, the full raw line is redacted before the window is cut, so escaped forms are covered.
- hex runs of 40 or more chars
- base64-like runs `[A-Za-z0-9+/_-]{40,}={0,2}` that include at least one digit and mixed case, **except** path-like runs whose `/`-split segments are all lowercase word-like (so `documentation/docs/engineering/architecture` survives while AWS-style secrets containing `/`/`+` are masked)

Callers redact the **full text unit before snippet windowing**, so a secret cut at a window edge can never survive as an unmatched fragment. This contract is used by `rank.ts`.

**Steps:**

- RED tests:
  - Positives, one per shape, including:
    - uppercase `API_KEY=…`
    - a prefixed `AWS_SECRET_ACCESS_KEY=…`
    - a 40-char AWS-style secret containing `/` and `+`
    - **short JSON credentials** `{"password":"synthetic-only"}` and `{"API_KEY":"synthetic-only"}`
    - a quoted value with spaces, masked entirely
    - an **escaped raw-record** credential `{\"token\":\"synthetic-only\"}` placed near a snippet edge (asserted through `redact` → `buildSnippet`) A 40-hex git SHA is intentionally masked; document this in a test name.
  - Negatives: UUIDs, normal words, and a long slash path such as `documentation/docs/engineering/architecture` stay untouched.
- GREEN.
- Format/lint.
- Verify `pnpm run test:vitest src/skills/session-search/src/lib/redact.test.ts`.
- Commit `feat(p01-t04): add session-search snippet redaction`.

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
- Create: `src/skills/session-search/src/helpers/test-helpers.ts`. A temp-HOME builder that writes synthetic, **real-shaped** stores for all three runtimes and sets mtimes via `utimes`:
  - Claude records with `cwd`, `sessionId`, `tool_result` blocks, `ai-title`/`custom-title`, and `subagents/agent-*.jsonl` plus a `subagents/workflows/…/journal.jsonl` decoy.
  - Codex `rollout-<ts>-<uuid>.jsonl` with a `session_meta` header, `function_call_output`, and child files with inherited records.
  - Cursor transcripts with `turn_ended` records and an open trailing turn.

  `src/helpers/` is the build's runtime-closure exemption (`scripts/lib/packaging.ts`), so it is never bundled. It is shared by later tests.

- Create: `src/skills/session-search/src/lib/classify.ts`. Shared role mapping for `DigestEntry` values:
  - `kind` `tool_call`/`tool_result` → `tool`.
  - `origin`/`displayRole` `automatic-control`, `runtime-notification`, or `runtime-diagnostic` → `context`.
  - Otherwise the entry `role`.
  - Then **injected-context demotion**: user text for which any `HIDDEN_PAYLOAD_MATCHERS` entry (via the `lib/sanitize.ts` shim) returns true, or that starts with `<user_instructions>`, becomes `context`.

**Behavior (per `design.md` Source adapters):**

- Enumerate using stat only:
  - parent `~/.claude/projects/*/*.jsonl` files
  - subagent `*/<sid>/subagents/**/agent-*.jsonl` files only (`isSubagent`, `parentSessionId=<sid>`). Workflow `journal.jsonl` files are excluded.
- `historyHits` streams `~/.claude/history.jsonl` (`display`, `project`, `sessionId`, `timestamp`). A hit is user-typed, with tier `history`.
- `metadataHits` reads the **latest** title for candidate files:
  - A bounded tail read (`readTailRecordsBounded`) preferring the last `custom-title` over the last `ai-title`.
  - Falls back to a bounded prefix read (`readMetadataRecordsBounded`).
- `sessionInfo` reads cwd, first prompt, and `startedAt` with a bounded read.
- `classifyRecord`:
  - Ordinary messages and provenance go through `normalizeEntries('claude-code', [record], …)` + `classify.ts`. Tools are disabled there.
  - With `includeTools`, the adapter **extracts `tool_result` content (string or array `.text` blocks) and `tool_use` input directly from the raw record at full length**, labeled `tool`. The shared normalizer truncates tool results to 500 chars and inputs to 200, which would hide phrases further in.
  - Redaction and windowing happen only when building output.
- Open hint: `claude --resume <sessionId>` plus "run from <cwd>".

**Steps:**

- RED tests:
  - Enumeration includes `agent-*` subagents and excludes the workflow journal.
  - History parsing.
  - The latest title wins, and custom-title beats ai-title.
  - classifyRecord roles.
  - **A Claude `tool_result` containing the pattern is `tool`, never user-typed.**
  - A Claude `tool_result` whose only target phrase sits **past character 600** (line below `maxLineBytes`) is found with includeTools and not without.
  - Tool text appears only with includeTools.
  - Injected demotion uses the shared matchers.
  - A missing root yields `absent`.
- GREEN.
- Format/lint.
- Verify `pnpm run test:vitest src/skills/session-search/src/lib/adapters/claude-code.test.ts`.
- Commit `feat(p02-t01): add session-search Claude Code adapter`.

---

### Task p02-t02: Codex adapter (history, session_index, sqlite threads, archived)

**Files:**

- Create: `src/skills/session-search/src/lib/adapters/codex.ts`
- Create: `src/skills/session-search/src/lib/adapters/codex.test.ts`

**Behavior:**

- **Enumerate** `~/.codex/sessions/**/rollout-*.jsonl` and `~/.codex/archived_sessions/rollout-*.jsonl` (`archived: true`) using stat only.
- **Lazy headers:** read the `session_meta` header only for files that survive the time window (via `readMetadataRecordsBounded` with a `maxBytes` large enough for a `session_meta` line that carries `base_instructions`, e.g. 1 MiB, and `maxRecords` 2). When sqlite threads are available, prefer their `rollout_path`/`cwd` and skip the header read for cwd scoping.
  - When `payload.id !== payload.session_id`, the file is a child with `parentSessionId = payload.session_id`.
  - Record `subagent_history_start_ordinal` when present.
  - Cache the header per file.
- **Inherited records:** in child files, tiers 3 and 4 skip records whose `ordinal` is below `subagent_history_start_ordinal`. These are inherited parent history, and scanning them would duplicate parent hits.
- **classifyRecord:**
  - Only `response_item` `message` records go through `normalizeEntries('codex', [record], …)` + `classify.ts`. `event_msg` `user_message`/`agent_message` records are **ignored**: the normalizer returns nothing for them and they duplicate the `response_item` text, so including them would double-count hits.
  - With `includeTools`, the adapter **also** emits `tool` units directly, because the shared normalizer drops tool output and this deep-rung case is the motivating incident. Sources:
    - `response_item` `function_call_output`/`custom_tool_call_output` `payload.output`, handling all documented shapes (session-schemas/codex.md):
      - a bare string
      - an array of `input_text` blocks (join their `.text`; the dominant shape)
      - a JSON-encoded string (try `JSON.parse`, else use it raw)
    - `function_call` arguments
    - `event_msg` `item_completed` with `item.type === 'CommandExecution'` (`item.aggregated_output`, falling back to `item.stdout`)
    - legacy `exec_command_end` output, tolerated when present
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
  - Headers are read only for in-window files.
  - Inherited child records are skipped.
  - A phrase inside an **array-form** `custom_tool_call_output` and inside a `CommandExecution` `aggregated_output` is matched only with includeTools.
  - An `event_msg` `user_message` record yields no units.
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
- `classifyRecord` extracts text **directly from the raw record** and does **not** call `normalizeEntries`. The shared Cursor normalizer only emits at `turn_ended` and returns nothing for a lone record.
  - Read `role` and the `message.content` text blocks as user/assistant, then apply `classify.ts` demotion.
  - With includeTools, emit `tool_use`/tool-result blocks as `tool`.
- Open hint: the transcript path ("open in Cursor").

**Steps:**

- RED tests:
  - Enumeration.
  - Slug match.
  - On a real-shaped transcript with `turn_ended` records and an **open trailing turn**, both user and assistant text match.
  - Tool blocks match only with includeTools.
- GREEN.
- Format/lint.
- Verify `pnpm run test:vitest src/skills/session-search/src/lib/adapters/cursor.test.ts`.
- Commit `feat(p02-t03): add session-search Cursor adapter`.

---

### Task p02-t04: Content scanner

**Files:**

- Create: `src/skills/session-search/src/lib/scan.ts`
- Create: `src/skills/session-search/src/lib/scan.test.ts`

**Behavior:**

- **Prefilter (must be a provable superset of the Node scan):** `prefilterWithRg(rgPath, patterns, files, {literal})`
  - Runs only when **every** pattern is prefilter-safe. A pattern qualifies when it contains only:
    - literal ASCII text without quotes, backslashes, or control characters
    - `.*` and `.+`
    - `|` and groups

    It is rejected when it contains:
    - any backslash (escapes, `\s`, `\n`, …)
    - a `.` not immediately followed by `*` or `+`
    - **any character class `[…]`**, negated or not. A range like `[ -~]` can match decoded `"`/`\`, whose raw JSON form is two bytes.
    - lookaround or backreferences
    - non-ASCII characters

    Raw JSONL stores `"`, `\`, tab, and newline as two-byte escapes, so single-character wildcards could miss text that Node matches after decoding.

  - Otherwise it returns `null` with a diagnostic note, and the caller scans all candidates in Node.
  - When it runs: `rg -l -i --no-messages [-F] -e p… -- <chunk>`, chunking the argument list to ≤ 100 KB per call. Exit 1 means no matches. Any other error (e.g. exit 2 on a regex dialect mismatch) returns `null`, which also falls back.

- **Verification:** `scanFile(path, adapter, matcher, {maxLineBytes, includeTools, maxHitsPerSession})`
  - Streams with a LF-only splitter: read in chunks and split on `0x0A`, not with `readline`, because U+2028/2029 can appear inside strings.
  - Skips oversize lines before `JSON.parse` and counts them. On the **deep** tier only, oversize lines get a **narrow raw fallback**, so large tool dumps stay searchable without surfacing injected context:
    - Inspect only the line prefix (the first ~512 bytes) for the record type. Raw matching is allowed only for known tool-output carriers:
      - Codex `response_item` `function_call_output`/`custom_tool_call_output`
      - Codex `event_msg` `item_completed` whose `item.type` is `CommandExecution`, `McpToolCall`, or `FileChange`
      - Claude lines carrying `tool_result`
    - Explicitly skip `world_state`, `session_meta`, `turn_context`, and `compacted`.
    - Read `"ordinal":N` from the prefix with a regex and apply the child inherited-record skip.
    - On a hit, emit a redacted, windowed `tool` unit.
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
  - A `perceive\s*now` pattern spanning an embedded `\n` in a JSON string returns the same hits with and without rg, because the prefilter is skipped.
  - A deep-tier phrase inside an oversize `function_call_output` line is still found.
  - **Negative:** an oversize Codex `world_state` line (AGENTS.md text) containing the phrase produces no deep hit.
  - An oversize inherited child line is skipped.
  - `foo.bar` against text containing `foo"bar` gives the same hits with and without rg, because the prefilter is skipped.
  - `foo[ -~]bar` against decoded `foo"bar` and `foo\bar` gives the same hits with and without rg, because the prefilter is skipped.
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
  - Attaches up to 3 snippets (user > title > assistant > context > tool, then by tier order). Each snippet is built by **redacting the full text unit first, then windowing** (`redact` → `buildSnippet`). Also attaches `matchedPatterns` and `matchedTiers`.
  - Applies `limit` and assigns `rank`.

**Steps:**

- RED tests:
  - User-typed beats assistant-only with an equal pattern count.
  - More distinct patterns beats more raw hits.
  - The title boost.
  - Titles are redacted as well as snippets and firstPrompt.
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
4. Run T1, then T2, then T3 over the candidates, with the large-scan guard measured after window and scope narrowing. Over the threshold without `allowLargeScan`, restrict T3 to sessions hit in T1/T2 and set `needsConfirmation`. Then **recompute the restricted set's bytes**: if it still exceeds the threshold, skip the content and deep scans entirely and return the cheap-tier results plus `needsConfirmation`.
5. Zero sessions with a cwd scope: run unscoped and set `widened: true`.
6. Still zero and `deep` enabled: T4 (`includeTools`) under the same guard.
7. Rank and assemble `SearchResult`, with `host` (os.hostname/platform), `tools`, `tiersRun`, `sources`, and `diagnostics`. An optional `deadlineMs` yields partial results with `incomplete: true`.

**Steps:**

- RED tests on temp-HOME corpora via `src/helpers/test-helpers.ts`:
  - Cross-runtime target found and ranked first.
  - Time window excludes old sessions.
  - A cwd-hint miss widens.
  - A tool-only phrase **in a Codex `function_call_output`** is found only by deep, and a Claude `tool_result` case is likewise found only by deep; `deep: false` yields zero results.
  - Inherited Codex child records do not duplicate parent hits.
  - The large-scan guard with a tiny threshold sets `needsConfirmation` and still returns T1/T2 hits; `allowLargeScan` returns full results.
  - When the T1/T2-hit files alone exceed the threshold, content and deep scanning do **not** run (diagnostics `filesScanned` is 0) until `allowLargeScan` is set.
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
- **Exit codes:**
  - 3 whenever `needsConfirmation` is set, regardless of result count.
  - Otherwise 0 with results, 2 with none.
  - 1 for usage or hard errors.
  - An `incomplete: true` run (deadline) still exits 0 or 2 by results. SKILL.md tells the agent to check `incomplete`.
- **Bundling:** a realpath-safe main guard so it runs through symlinked installs: `if (process.argv[1] && isEntrypointPath(process.argv[1])) …`, mirroring `src/skills/consensus-review/src/review.ts`. `tests/tooling/entrypoint-symlink.test.ts` auto-discovers this guard and requires that importing with a non-file `argv[1]` does not run main.

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

- Create: `src/skills/session-search/build.json`. The file is `{ "runtime": [...] }` only; packaging rejects any other key. List the entry plus the runtime lib modules, including both shims. Do not list `src/helpers/**`, tests, or the type-only `lib/types.ts`; the packager exempts helpers and tests itself.
- Modify: `src/distributions.ts`. Add an owner entry `session-search` with `source: 'src/skills/session-search'` and `allowedSourceRoots: ['src/shared/transcript', 'src/skills/session-export-transcript']`. Targets:
  - standalone `skills/session-search`
  - plugin `session` / `search` → `plugins/session/skills/search`
- Modify the pinned test lists so the new skill is expected:
  - `tests/release/versioning.test.ts` (skill file lists and the SKILL_FILES pin, generated list)
  - `tests/repo/layout.test.ts` (standaloneSkills, requiredDirectories)
  - `tests/repo/plugin-manifests.test.ts`: the session `version: '0.3.6'` → `'0.4.0'`, the description, and `search` added to `skills`. `scripts/bump-version.ts` does not rewrite this pin.
  - `tests/repo/marketplace-manifests.test.ts`: only the session skill membership if it is pinned there. It has no description pin.
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
- Verify `pnpm run validate && pnpm run test:vitest tests/repo tests/release tests/tooling`, including `tests/tooling/entrypoint-symlink.test.ts` and `generated-output-sync.test.ts`. Expected: pass.
- Commit `feat(p03-t02): distribute session-search standalone and in session plugin`. This includes the generated outputs produced by the build.

---

### Task p03-t03: CLI integration tests against the generated bundle

**Files:**

- Create: `src/skills/session-search/src/cli.test.ts`

**Behavior.** The test uses `CLI_PATH = fileURLToPath(new URL('../../../../skills/session-search/scripts/session-search.mjs', import.meta.url))` and `spawnSync(process.execPath, [CLI_PATH, …], { env: { ...process.env, HOME, STATE_DIR, …blank harness vars } })`, following export-transcript's `cli.test.ts`. Each test gets a temp HOME from `src/helpers/test-helpers.ts`. Cases from `design.md` Integration Tests:

- cross-runtime ranked-first with valid `session-search/v1` JSON
- `--since 24h`
- cwd-hint widening
- deep rung, and `--no-deep` gives exit 2
- large-scan guard: exit 3, including a **zero-results-plus-needsConfirmation** case, then `--allow-large-scan`
- no stores: exit 2
- `estimate` output
- text (non-JSON) output smoke
- `--help` exit 0, and a bad regex / missing pattern exit 1
- identical JSON results with `SESSION_SEARCH_NO_RG=1`. The non-NO_RG run asserts `tools.rg !== null`; use `it.skipIf` when `rg` is absent.

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
- Modify: `documentation/docs/user-guide/installation.md` (mapping table)
- Modify the enumerations of session plugin members and transcript-core consumers to include session-search:
  - `documentation/docs/user-guide/index.md`
  - `documentation/docs/user-guide/plugins/index.md`
  - `documentation/docs/engineering/repository-layout.md`
  - `documentation/docs/engineering/architecture/generated-runtime.md` (owner table, plus the bundled-code diagram edge from session-search to export-transcript's sanitizer)
  - `documentation/docs/engineering/architecture/transcript-core.md` (Consumers list)
- Regenerate (never hand-edit or format): `documentation/index.md` via `cd documentation && oat docs generate-index --docs-dir docs --output index.md`
- Modify: `documentation/docs/engineering/architecture/session-schemas/index.md`. Add a short "Discovery indexes" section: `~/.claude/history.jsonl`, `~/.codex/history.jsonl`, `session_index.jsonl`, `state_5.sqlite` threads, `archived_sessions/`, with field lists and a note that they are internal and may drift.

**Steps:**

- Write and edit the files.
- Regenerate the index.
- Format only the authored pages and meta files (`pnpm exec oxfmt --write <authored files>`, excluding `documentation/index.md`).
- Keep `session-schemas/meta.json` and the docs Contents map consistent.
- Verify `pnpm run test:vitest tests/repo`, `pnpm run validate`, and the docs production build (`cd documentation && pnpm build`, which also runs prebuild generation and link checks).
- Commit `docs(p04-t01): document session-search skill and discovery indexes`.

---

### Task p04-t02: Fix stale Codex transcript path in existing skill docs

**Files (canonical sources only):**

- Modify: `src/skills/session-export-transcript/SKILL.md` (store-locations table: `session-<id>.jsonl` → `rollout-<timestamp>-<uuid>.jsonl`)
- Modify: `src/skills/session-export-transcript/references/transcript-formats.md`
- Modify: `src/skills/session-observer/references/transcript-formats.md` (both occurrences)
- Bump the patch version of **every affected owner**. `validate-skill-versions` counts an owner as affected when the change touches its source root or any `allowedSourceRoots`. The owners are:
  - `session-export-transcript`
  - `session-observer`
  - `session-observer-collab` (allows `src/skills/session-observer`)
  - `session-fork-to-destination` (allows both roots)

  Use `pnpm tsx scripts/bump-version.ts <next-patch> --skill <owner>` and do not hand-edit. `session-search` is new and exempt.

**Steps:**

- Edit.
- Check `tests/repo/docs-presence.test.ts` expectations.
- `pnpm run build` to refresh the generated copies.
- `pnpm run build:check`.
- Verify `pnpm run test:vitest tests/repo src/skills/session-export-transcript src/skills/session-observer` and `pnpm run validate:skill-versions -- --base-ref "$(git merge-base HEAD origin/main)"`. The latter may still demand changelog lines, which p04-t03 adds; confirm `bumpedSkills` includes exactly the four owners and the only remaining failures are changelog coverage.
- Format the edited Markdown.
- Commit `docs(p04-t02): correct Codex rollout transcript path in session skill docs`.

---

### Task p04-t03: Changelog and full premerge verification

**Files:**

- Modify: `CHANGELOG.md`. Under `## [Unreleased]`, add new lines naming each version-bumped plugin and skill **with its new version**; `validate-skill-versions` `changelogCovers()` requires whole-word mentions:
  - `### Added`: "`session-search` 0.1.0 (standalone) and `session` plugin 0.4.0 member `search` …".
  - `### Fixed`: "`session-export-transcript` X.Y.Z, `session-observer` X.Y.Z, `session-observer-collab` X.Y.Z and `session-fork-to-destination` X.Y.Z correct the Codex rollout transcript path …", with the actual bumped versions.

**Steps:**

- Edit and format.
- Run `pnpm run premerge`. Expected: the full chain passes. If it fails, fix in scope and re-run.
- Run `pnpm run validate:skill-versions -- --base-ref "$(git merge-base HEAD origin/main)"`.
- Commit `docs(p04-t03): add session-search changelog entry`.

---

## Reviews

| Scope | Type     | Status          | Date       | Artifact                                           | Reviewed Head | Invocation | Gate Target |
| ----- | -------- | --------------- | ---------- | -------------------------------------------------- | ------------- | ---------- | ----------- |
| p01   | code     | pending         | -          | -                                                  | -             | -          | -           |
| p02   | code     | pending         | -          | -                                                  | -             | -          | -           |
| p03   | code     | pending         | -          | -                                                  | -             | -          | -           |
| p04   | code     | pending         | -          | -                                                  | -             | -          | -           |
| final | code     | pending         | -          | -                                                  | -             | -          | -           |
| plan  | artifact | fixes_completed | 2026-10-02 | structured (in-memory) x3                          | -             | auto       | -           |
| plan  | artifact | received        | 2026-10-02 | reviews/artifact-plan-review-2026-10-02T053829Z.md | -             | -          | -           |

For code-review events, `Reviewed Head` is the full 40-character SHA at the
head of the reviewed range. `Invocation` records `manual`, `auto`, or `gate`;
`Gate Target` is populated only for gate events. Legacy five-column rows remain
valid. Writers must preserve every existing row and every unknown trailing
cell; never truncate a widened row back to five columns.

Plan artifact review disposition (Step 3.6/3.7): the auto artifact-review loop ran 3 structured attempts with `oat-reviewer-claude-claude-opus-5-5-high`. Request IDs: session-search-plan-review-1/2/3. Route: native, policy-resolved under the `high` dispatch policy. Findings: attempt 1 had 3 High, 7 Medium, and 4 Low, all fixed. Attempt 2 had 1 High, 5 Medium, and 3 Low, all fixed. Attempt 3 had 1 High (deep-rung raw fallback scope) and 2 Medium (`validate:skill-versions` base ref; prefilter wildcard safety), all fixed in-artifact after the retry bound (2) was exhausted, so they have not been re-reviewed by this loop. They are re-reviewed by the configured cross-family `oat-project-quick-start` exit gate.

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
