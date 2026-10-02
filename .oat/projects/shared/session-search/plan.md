---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-10-02
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ['p05']
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: false
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

Callers redact the **full text unit before snippet windowing**, so a secret cut at a window edge can never survive as an unmatched fragment. Emitted snippets go through `snippetFor(text, matcher)` (p01-t06), which owns this ordering.

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

### Task p01-t06: (review) Production redact-then-snippet helper

Source: reviews/archived/p01-review-2026-10-02T061433Z.md, Medium M1. `Hit.firstIndex` is measured on unredacted text, so windowing the redacted text can drop the matched phrase.

**Files:** `src/skills/session-search/src/lib/matcher.ts` (or `redact.ts`), `src/skills/session-search/src/lib/types.ts` (Hit doc), and the matching tests.

**Behavior:** `snippetFor(text, matcher)`:

1. Redacts the full unit.
2. Re-runs `matcher.match` on the redacted text and windows at that index.
3. When the hit itself was redacted, falls back to the first `[REDACTED]` marker or the start of the text.

Document that the `Hit` indices are pre-redaction and must not be reused on redacted text.

**Test:** with a long secret run before the hit, the snippet contains the hit phrase, and the existing no-fragment assertion is kept.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search/src/lib` and `pnpm run type-check`; format/lint the touched files (`pnpm exec oxfmt --write <files>`, `pnpm exec oxlint <files>`).
**Commit:** `fix(p01-t06): window snippets on redacted text`

### Task p01-t07: (review) Mask multi-level escaped JSON credentials

Source: reviews/archived/p01-review-2026-10-02T061433Z.md, Medium M2.

**Files:** `src/skills/session-search/src/lib/redact.ts`, `redact.test.ts`.

**Behavior:**

- Generalize the key wrapper to any backslash run before the quote. The value must open with the same run and close at its next occurrence.
- Keep the bare and unterminated fallbacks.
- Keep linear-time anchoring and re-run the 256 KiB timing test.

**Test:** the two-level positive `{\\\"password\\\":\\\"synthetic-only\\\"}` is masked.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search/src/lib` and `pnpm run type-check`; format/lint the touched files (`pnpm exec oxfmt --write <files>`, `pnpm exec oxlint <files>`).
**Commit:** `fix(p01-t07): redact multi-level escaped JSON credentials`

### Task p01-t08: (review) Mask URL-userinfo passwords and CLI-flag credentials

Source: reviews/archived/p01-review-2026-10-02T061433Z.md, Medium M3 (discovery: never echo credential-shaped strings).

**Files:** `redact.ts`, `redact.test.ts`.

**Behavior:**

- Mask only the password segment of `scheme://user:pass@host`.
- Mask the value of `--?<credential-word identifier>\s+<value>` flags. The flag form requires a leading `-`, so prose like "the token is" stays intact.

**Tests:** positives for postgres/https userinfo and `--password X`/`--token X`; a prose negative.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search/src/lib` and `pnpm run type-check`; format/lint the touched files (`pnpm exec oxfmt --write <files>`, `pnpm exec oxlint <files>`).
**Commit:** `fix(p01-t08): redact URL userinfo and CLI flag credentials`

### Task p01-t09: (review) Reject patterns that match empty text

Source: reviews/archived/p01-review-2026-10-02T061433Z.md, Low L1.

**Files:** `matcher.ts`, `matcher.test.ts`.

**Behavior:** after compiling, a pattern for which `regex.test('')` is true raises `UsageError("pattern matches empty text: …")`.

**Verify:** Verify `pnpm run test:vitest src/skills/session-search/src/lib` and `pnpm run type-check`; format/lint the touched files (`pnpm exec oxfmt --write <files>`, `pnpm exec oxlint <files>`).
**Commit:** `fix(p01-t09): reject empty-matching search patterns`

### Task p01-t10: (review) Let `.` cross newlines (dotAll)

Source: reviews/archived/p01-review-2026-10-02T061433Z.md, Low L2.

**Files:** `matcher.ts`, `matcher.test.ts`.

**Behavior:**

- Compile with flags `is`.
- `perceive.*now` now matches across a newline.
- The rg prefilter remains a superset, because raw JSONL stores the newline as the two characters `\n`.

SKILL.md guidance in p03-t01 must state the dotAll semantics.

**Verify:** Verify `pnpm run test:vitest src/skills/session-search/src/lib` and `pnpm run type-check`; format/lint the touched files (`pnpm exec oxfmt --write <files>`, `pnpm exec oxlint <files>`).
**Commit:** `fix(p01-t10): make pattern dot match newlines`

### Task p01-t11: (review) Stop the base64 rule from masking slugs and identifiers

Source: reviews/archived/p01-review-2026-10-02T061433Z.md, Low L3.

**Files:** `redact.ts`, `redact.test.ts`.

**Behavior:** exempt runs made only of `-`/`_`-separated word segments (e.g. Claude project slugs like `-Users-name-code-repo`) and long camelCase identifiers with no digit-dense segment. AWS-style secrets and the existing positives must stay masked.

**Tests:** negatives for a Claude slug and a long camelCase identifier; all existing positives still pass.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search/src/lib` and `pnpm run type-check`; format/lint the touched files (`pnpm exec oxfmt --write <files>`, `pnpm exec oxlint <files>`).
**Commit:** `fix(p01-t11): avoid redacting slugs and identifiers`

### Task p01-t12: (review) Narrow the enumerate context type

Source: reviews/archived/p01-review-2026-10-02T061433Z.md, Low L4.

**Files:** `types.ts`.

**Behavior:** `enumerate` takes `Omit<AdapterContext, 'files'>`, or `files` becomes optional for enumeration, so callers don't pass a placeholder.

**Verify:** `pnpm run type-check`
**Commit:** `fix(p01-t12): narrow adapter enumerate context`

### Task p01-t13: (review) Keep snippet edges off surrogate pairs

Source: reviews/archived/p01-review-2026-10-02T061433Z.md, Low L5.

**Files:** `matcher.ts`, `matcher.test.ts`.

**Behavior:** nudge the window start and end and the cap slice off low-surrogate positions, so an emoji at an edge is never split.

**Test:** an emoji at the window edge produces no lone surrogate.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search/src/lib` and `pnpm run type-check`; format/lint the touched files (`pnpm exec oxfmt --write <files>`, `pnpm exec oxlint <files>`).
**Commit:** `fix(p01-t13): avoid splitting surrogate pairs in snippets`

---

### Task p01-t14: (review) Tighten the camelCase/segment exemption so random tokens stay masked

Source: reviews/archived/p01-review-2026-10-02T062929Z.md, Medium M1.

**Files:** `redact.ts`, `redact.test.ts`.

**Behavior:**

- `isCamelIdentifier` also requires at most 2 uppercase-only pieces and at most 2 digit pieces, with no capital split off before a capitalized word. Alternatively, require that lowercase words of 3+ letters cover most of the run.
- The segmented-words exemption requires a lowercase-only first segment, so capitalized hyphen passphrases such as `Correct-Horse-Battery-Staple-Mountain-River7` are masked.
- Update the docstring to state the remaining exemption precisely.

**Tests:**

- A **seeded statistical test**: a fixed-PRNG sample of ≥ 20,000 random 40-char alphanumeric strings that pass the digit and mixed-case gate. Assert that ≥ 99.99% are masked (at most 2 exemptions).
- The reviewer's three leak samples are masked.
- `compileMatcherWithLiteralEscapingForV2Patterns`, `HTTPServerRequestHandlerFactoryForSessionSearch2`, and a Claude slug stay unmasked.
- Re-run the 256 KiB timing test.

**Verify:** Verify `pnpm run test:vitest src/skills/session-search/src/lib` and `pnpm run type-check`; format/lint the touched files (`pnpm exec oxfmt --write <files>`, `pnpm exec oxlint <files>`).
**Commit:** `fix(p01-t14): keep random tokens masked under identifier exemptions`

### Task p01-t15: (review) Harden URL-userinfo and auth-header redaction

Source: reviews/archived/p01-review-2026-10-02T062929Z.md, Low L1, plus the reviewer's out-of-scope note on `Authorization: Basic`.

**Files:** `redact.ts`, `redact.test.ts`.

**Behavior:**

- The userinfo password runs to the **last** `@` before whitespace, so passwords containing `/` or an unencoded `@` are fully masked. Keep the scheme anchoring that makes the scan linear, and accept over-masking when a later path contains `@`.
- Mask token-only userinfo (`https://<token>@host`) when the token is ≥ 20 characters.
- Mask `Authorization: (Basic|Bearer|Token) <value>` header values.

**Tests:** positives for `postgres://u:ab/cd@host/db`, `postgres://u:p@ss@host/db`, token-only userinfo, and a Basic header; prose negatives. Re-run the timing test.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search/src/lib` and `pnpm run type-check`; format/lint the touched files (`pnpm exec oxfmt --write <files>`, `pnpm exec oxlint <files>`).
**Commit:** `fix(p01-t15): harden URL userinfo and auth header redaction`

### Task p01-t16: (review) Anchor snippetFor at the real hit

Source: reviews/archived/p01-review-2026-10-02T062929Z.md, Low L2.

**Files:** `matcher.ts`, `matcher.test.ts`, `types.ts` (if the signature doc changes).

**Behavior:**

- `snippetFor(text, matcher, preHit?)` skips re-match hits that fall inside a `[REDACTED]` marker span.
- When the hit itself was redacted, it prefers the marker nearest the redacted-prefix offset `redact(text.slice(0, preHit.firstIndex)).length` over the first marker in the unit.

**Tests:** the reviewer's two repros (a pattern `redacted` with an earlier marker; an unrelated earlier `ghp_` token before a redacted hit).
**Verify:** Verify `pnpm run test:vitest src/skills/session-search/src/lib` and `pnpm run type-check`; format/lint the touched files (`pnpm exec oxfmt --write <files>`, `pnpm exec oxlint <files>`).
**Commit:** `fix(p01-t16): anchor redacted snippets at the original hit`

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
  - Attaches up to 3 snippets (user > title > assistant > context > tool, then by tier order). Each snippet is built with `snippetFor(hit.text, matcher, preHit)`, which redacts first and then windows. Never reuse pre-redaction `Hit.firstIndex` on redacted text. Also attaches `matchedPatterns` and `matchedTiers`.
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

### Task p02-t08: (review) Never lose Codex tool-output text when decoding

Source: reviews/archived/p02-review-2026-10-02T071003Z.md, **High** H1.

**Files:** `lib/adapters/codex.ts`, `lib/adapters/codex.test.ts`, `lib/pipeline.test.ts`, `helpers/test-helpers.ts`.

**Behavior:**

- When decoding yields an empty string or no `.text` blocks, `codexOutputText` falls back to the raw `output` string.
- Array or object blocks without a `.text` field are serialized with `JSON.stringify(block)` rather than dropped.

**Tests:**

- codex.test: a `function_call_output` whose string output is `[{"title":"Perceive Now vetting","id":1}]` yields a `tool` unit containing the phrase.
- pipeline: a deep-rung case with that shape finds the session only on the deep rung.

**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files. Each new test must fail against the pre-fix code (confirm by temporarily reverting the fix).
**Commit:** `fix(p02-t08): keep codex tool output text when JSON decoding finds no text blocks`

### Task p02-t09: (review) Treat agent-authored Codex threads as non-user-typed

Source: reviews/archived/p02-review-2026-10-02T071003Z.md, Medium M1.

**Files:** `lib/adapters/codex.ts`, `lib/types.ts` (add an `agentAuthored` flag to the session file), `lib/scan.ts`, the related tests.

**Behavior:**

- Any sqlite or header `source` carrying a `subagent` key marks the thread `agentAuthored`. This covers `thread_spawn`, `review`, `memory_consolidation`, and `{other: guardian}`.
- Meta `first_user_message` hits for such threads have `userTyped: false`.
- `scanFile` uses `userTyped = role === 'user' && !file.isSubagent && !file.agentAuthored`.

**Tests:**

- A `thread_spawn` row's first message is not user-typed.
- A `memory_consolidation`/`review` source's user-role content is not user-typed.

**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files. Each new test must fail against the pre-fix code (confirm by temporarily reverting the fix).
**Commit:** `fix(p02-t09): stop scoring agent-authored codex text as user-typed`

### Task p02-t10: (review) Make negative tests fail when their guarded feature is removed

Source: reviews/archived/p02-review-2026-10-02T071003Z.md, Medium M2.

**Files:** `lib/pipeline.test.ts`, `lib/scan.test.ts`, `helpers/test-helpers.ts` (tests only).

**Tests:**

- (a) The inherited-record skip: put the phrase only in the child's inherited range (the parent is out of window or uses different text) and expect no child-sourced hit.
- (b) `acceptHit`: a `--since` case where a history hit points at an out-of-window transcript, and a `--cwd` case where an out-of-scope history hit must not prevent `widened: true`.
- (c) A subagent file's user-role match is `userTyped: false`.

Each must fail when the corresponding guard (`scan.ts` inherited skip, `pipeline.ts` acceptHit filter, `!file.isSubagent`) is removed.

**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files. Each new test must fail against the pre-fix code (confirm by temporarily reverting the fix).
**Commit:** `test(p02-t10): pin inherited-skip, scope-filter and subagent user-typed guards`

### Task p02-t11: (review) Bound rg and per-file loops by --deadline-ms

Source: reviews/archived/p02-review-2026-10-02T071003Z.md, Medium M3.

**Files:** `lib/scan.ts`, `lib/pipeline.ts`, `lib/adapters/{codex,claude-code}.ts`, the related tests.

**Behavior:**

- Pass the remaining budget as `spawnSync`'s `timeout` for `rg`. On `ETIMEDOUT`, mark the run `incomplete` and skip that chunk; do not fall back to a full Node scan past the deadline.
- Check the deadline inside the enumeration header-read, scoping `sessionInfo`, and title tail-read loops.

**Test:** a pipeline test with a sleeping stub `rg` (via `SESSION_SEARCH_RG`) asserts `incomplete: true` within the budget.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files. Each new test must fail against the pre-fix code (confirm by temporarily reverting the fix).
**Commit:** `fix(p02-t11): honor deadline in rg prefilter and per-file loops`

### Task p02-t12: (review) Credit every pattern despite the per-file hit cap

Source: reviews/archived/p02-review-2026-10-02T071003Z.md, Low L1.

**Files:** `lib/scan.ts`, `lib/scan.test.ts`.

**Behavior:** after `MAX_HITS_PER_SESSION`, keep streaming without storing text until every pattern has been seen at least once (or until EOF), then stop.

**Test:** a file with 30 early hits of pattern A and a later pattern B credits both.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files. Each new test must fail against the pre-fix code (confirm by temporarily reverting the fix).
**Commit:** `fix(p02-t12): keep distinct-pattern credit past the per-file hit cap`

### Task p02-t13: (review) Surface diagnostic notes in JSON mode

Source: reviews/archived/p02-review-2026-10-02T071003Z.md, Low L2.

**Files:** `session-search.ts`.

**Behavior:** in `--json` mode, diagnostic notes (rg skipped or failed, probe notes) go to stderr prefixed `[session-search]`; stdout stays pure JSON.

**Verify:** `pnpm run type-check`, plus a manual CLI smoke run showing a stderr note with `SESSION_SEARCH_RG=/nonexistent --json` and valid JSON on stdout.
**Commit:** `fix(p02-t13): emit diagnostic notes on stderr in json mode`

### Task p02-t14: (review) Keep ask-user answers in the conversation tiers

Source: reviews/archived/p02-review-2026-10-02T071003Z.md, Low L3.

**Files:** `lib/scan.ts`, `lib/adapters/{claude-code,codex}.ts`, the related tests.

**Behavior:** keep a per-file Claude tool-name map and a Codex call-id map in `scanFile`, so `AskUserQuestion`/`request_user_input` questions and answers route through `normalizeEntries` as user/assistant decision content (not tool).

**Test:** an ask-user answer phrase is found on the content tier without `--include-tools`.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files. Each new test must fail against the pre-fix code (confirm by temporarily reverting the fix).
**Commit:** `fix(p02-t14): include ask-user answers in conversation tiers`

### Task p02-t15: (review) Skip the rg prefilter on the deep tier

Source: reviews/archived/p02-review-2026-10-02T071003Z.md, Low L4.

**Files:** `lib/scan.ts`, `lib/scan.test.ts`.

**Behavior:** on the deep tier (`includeTools`), the prefilter is skipped. Deep-tier text is decoded or re-serialized, so raw bytes may differ (`\/`, `\u003c`). Document this in the superset comment.

**Test:** a deep phrase `src/foo` stored as `src\\/foo` inside a JSON-encoded output gives identical results with and without rg.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files. Each new test must fail against the pre-fix code (confirm by temporarily reverting the fix).
**Commit:** `fix(p02-t15): skip rg prefilter for deep-tier scans`

---

### Task p02-t16: (review) Match ask-user answers on untruncated text, consistently across runtimes

Source: reviews/archived/p02-review-2026-10-02T072802Z.md, Medium (a regression from p02-t14).

**Files:** `lib/adapters/claude-code.ts`, `lib/adapters/codex.ts`, `lib/scan.test.ts` (or the adapter tests).

**Behavior:**

- Emit the conversational `user` unit for an ask-user answer from the **untruncated** raw text (Claude `tool_result` content or `toolUseResult.answers`; Codex output). Use normalizer output only for presentation, if at all.
- Apply one policy for both runtimes: answered ask-user records produce conversational units **only** (no duplicate `tool` unit on deep).

**Test:** a Claude answer longer than 500 characters with the phrase past the limit is found on the content tier. Codex questions and answers are not emitted twice on deep.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files. Each new test must fail against the pre-fix code.
**Commit:** `fix(p02-t16): match ask-user answers on untruncated text`

### Task p02-t17: (review) Pin the in-loop deadline checks and the stringify branch with tests

Source: reviews/archived/p02-review-2026-10-02T072802Z.md, Low ×2.

**Files:** `lib/adapters/codex.test.ts`, `lib/adapters/claude-code.test.ts`, `lib/pipeline.test.ts` (tests only).

**Tests:**

- With an already-expired deadline, no Codex header is read, Claude `metadataHits` returns no title hits, and a cwd-hinted run reports `incomplete: true` without `widened`.
- A mixed text and non-text array (JSON-encoded and real array) matches the non-text object's phrase.

Each must fail when the corresponding guard or branch is removed.

**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files. Each new test must fail against the pre-fix code.
**Commit:** `test(p02-t17): pin deadline loop guards and mixed-array tool output`

### Task p02-t18: (review) Don't fall back to raw base64 for image-only tool output

Source: reviews/archived/p02-review-2026-10-02T072802Z.md, Low.

**Files:** `lib/adapters/codex.ts`, `lib/adapters/codex.test.ts`.

**Behavior:** distinguish "decoded and intentionally empty (only skipped image blocks)" from "decoding lost text". Skip the raw fallback in the image-only case.

**Test:** image-only JSON-encoded output yields no unit (and no base64 match).
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files. Each new test must fail against the pre-fix code.
**Commit:** `fix(p02-t18): skip raw fallback for image-only codex tool output`

### Task p02-t19: (review) Deduplicate patterns so the early stop works

Source: reviews/archived/p02-review-2026-10-02T072802Z.md, Low.

**Files:** `lib/options.ts`, `lib/options.test.ts` (or `scan.ts`).

**Behavior:** `resolveOptions` deduplicates patterns while preserving order, or `done()` compares against the distinct pattern count.

**Test:** `-p zebra -p zebra` stops streaming after the cap.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files. Each new test must fail against the pre-fix code.
**Commit:** `fix(p02-t19): dedupe search patterns`

---

### Task p02-t20: (root) Make the tool-probe timeout configurable and de-flake stub tests

Source: root follow-up to a p02 fix-round-2 implementer concern. Under heavy load, stub `--version` scripts exceed the fixed 3 s probe timeout (`lib/tools.ts` `VERSION_TIMEOUT_MS`), so stub-based tests flake. Slow PATH wrapper shims (e.g. super.engineering's, about 5 s) would be misreported as absent too.

**Files:** `lib/tools.ts`, `lib/tools.test.ts`, `helpers/test-helpers.ts`, and the stub-using tests in `lib/adapters/codex.test.ts` and `lib/pipeline.test.ts` (env only).

**Behavior:**

- `probeTools(env)` honors `SESSION_SEARCH_PROBE_TIMEOUT_MS`: a positive integer, default 3000, clamped to [500, 60000]. Invalid values fall back to the default, with a probe note.
- Tests that spawn stub executables set it to 20000 through a shared helper.

**Test:** the override is honored (a stub that sleeps 1.5 s is found with 5000 and reported absent with 500), and invalid values fall back to the default.
**Verify:** `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files.
**Commit:** `fix(p02-t20): make tool probe timeout configurable`

---

### Task p02-t21: (root) Replace the flaky atime assertion with a deterministic scope-read counter

Source: root follow-up to the p02-t20 implementer concern. The p02-t17 test "reports a cwd-hinted run incomplete without scoping reads or widening" asserts on file access times, which macOS background services also update. It flaked in 13 of 24 runs under parallel load.

**Files:** `lib/pipeline.ts`, `lib/types.ts` (an additive `diagnostics.scopeReads: number` in `SearchResult`), `lib/pipeline.test.ts`.

**Behavior:** the pipeline counts `sessionInfo` reads performed during cwd scoping and reports them as `diagnostics.scopeReads`. The test asserts `scopeReads === 0` under an expired deadline instead of checking atime. This is an additive field under `session-search/v1`.

**Test:** the assertion fails when the scoping-loop deadline guard is removed, and the test is stable under parallel load (run the file 6 at a time for several rounds).
**Verify:** `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files.
**Commit:** `test(p02-t21): assert scoping reads via diagnostics counter`

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

- Create: `src/skills/session-search/build.json`. The file is `{ "runtime": [...] }` only; packaging rejects any other key. List the entry plus the runtime lib modules, including both shims. This includes the p02-derived helpers `lib/jsonl.ts` (the LF-only line reader) and `lib/window.ts` (the time-window overlap test), and `lib/classify.ts`. Do not list `src/helpers/**`, tests, or the type-only `lib/types.ts`; the packager exempts helpers and tests itself.
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

### Task p03-t04: (root) Extract Codex MCP and other item_completed tool results

Source: root real-store verification of the generated CLI (2026-10-02). In the motivating Codex rollout (`2026/08/30/rollout-…01a053ba….jsonl`), the ChatGPT thread title "Review Perceive Now" appears **only** in `event_msg` `item_completed` records whose `item.type` is `McpToolCall`: `{server, tool, arguments, result: {content: [{type: "text", text}], isError, structuredContent?}}`, with normal-sized lines. The Codex adapter emits tool text only for `function_call_output`/`custom_tool_call_output`/`CommandExecution`, so `--include-tools` and the deep rung miss the original incident's exact shape.

Item types observed in the September census: Reasoning, CommandExecution, AgentMessage, UserMessage, Extension, SubAgentActivity, McpToolCall, FileChange, CollabAgentToolCall, and others.

**Files:** `src/skills/session-search/src/lib/adapters/codex.ts`, `lib/adapters/codex.test.ts`, `lib/pipeline.test.ts`, `helpers/test-helpers.ts`, `lib/scan.ts` (only if the oversize raw-fallback carrier list needs aligning), plus the regenerated bundle via `pnpm run build`.

**Behavior:** with `includeTools`, emit `tool` units from `item_completed` items:

- `McpToolCall`: `result.content[].text` blocks (the same decoding rules as `codexOutputText`, never losing text), `structuredContent` (JSON-stringified), and `arguments`.
- `CollabAgentToolCall` and `Extension`: any `result`/`output`/`content` text, defensively.
- `FileChange`: the change summary text if present.

Do not emit `Reasoning`. `AgentMessage`/`UserMessage` items are already covered by `response_item` messages, so they must not be double-counted. Keep the oversize raw-fallback carrier list consistent.

**Tests:**

- An `item_completed` `McpToolCall` whose `result.content[0].text` carries the phrase is found only with `includeTools` and on the deep rung (pipeline).
- `Reasoning` is not emitted.
- The new tests fail before the fix.

**Verify:** `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files; `pnpm run build` and `pnpm run build:check`; `pnpm run test:vitest src/skills/session-search/src/cli.test.ts`.
**Commit:** `fix(p03-t04): search codex mcp tool call results`

### Task p03-t05: (root) Teach the widening ladder to try tool output when hits are only later discussion

Source: the same real-store verification. Without `--include-tools`, the top hits for the motivating query were later sessions **discussing** the incident. The deep rung only runs on zero results, so the original is never reached.

**Files:** `src/skills/session-search/SKILL.md`, plus the regenerated outputs via `pnpm run build`.

**Behavior (guidance only):** in the weak-results ladder, when the top hits look like later sessions talking about the thing rather than the session where it happened (they mention "found it", "another session", or the dates postdate the user's hint), re-run with `--include-tools` and/or an `--until` bound before the discussion. Explain that tool output (MCP results, command output) is excluded by default.

**Verify:** `pnpm run build`, `pnpm run build:check`, `pnpm run validate`; format the edited Markdown.
**Commit:** `docs(p03-t05): suggest tool-output reruns for discussion-only hits`

---

### Task p03-t06: (review) Make the remote fallback recipe single-shell and injection-safe

Source: reviews/archived/p03-review-2026-10-02T080403Z.md, **Medium** (security: a pattern containing `$(…)` or backticks would execute on the remote host).

**Files:** `src/skills/session-search/references/remote-fallback.md`, `src/skills/session-search/SKILL.md` (remote section, if it repeats the recipe), plus the regenerated outputs.

**Behavior:**

- Every remote recipe pipes a script through a quoted heredoc (`ssh -o BatchMode=yes <host> 'bash -s' <<'EOF' … EOF`) so only one shell parses it.
- Use sqlite3 parameter binding (`.parameter set :q '%term%'`, `… LIKE :q`) or remote single quotes, and `-readonly`.
- Fallback terms must be **plain substrings**: no regex operators, quotes, `$`, backticks, or backslashes. Reduce each regex pattern to a distinctive literal fragment. `LIKE` is a substring match, not a regex.
- Fix the step-3 CLI invocation and its quoting note to the same single-layer pattern.

**Verify:** run each recipe locally against a temp HOME by substituting `bash -s` for the ssh hop. A pattern containing `$(id -un)` must appear literally in the SQL or be rejected, and must never be expanded. Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint touched files; `pnpm run build` and `pnpm run build:check` when SKILL.md, references, or runtime code change.
**Commit:** `fix(p03-t06): make remote fallback recipes injection-safe`

### Task p03-t07: (review) De-duplicate Codex tool text per file

Source: reviews/archived/p03-review-2026-10-02T080403Z.md, Low.

**Files:** `lib/adapters/codex.ts`, `lib/adapters/codex.test.ts`.

**Behavior:** `createCodexFileClassifier` keeps a bounded per-file set of tool-unit text hashes (cap of about 4096 entries) and drops identical repeats. This covers `item_completed` items alongside `function_call_output`/`custom_tool_call_output`.

**Test:** the same output recorded both ways yields one `tool` unit.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint touched files; `pnpm run build` and `pnpm run build:check` when SKILL.md, references, or runtime code change.
**Commit:** `fix(p03-t07): dedupe repeated codex tool text per file`

### Task p03-t08: (review) Use template slots for sibling-skill and invocation names in SKILL.md

Source: reviews/archived/p03-review-2026-10-02T080403Z.md, Low.

**Files:** `src/skills/session-search/SKILL.md`, `src/distributions.ts` (declare `optionalSkills` for `session-export-transcript` and `session-observer` on the session-search entry, following session-handoff), plus the regenerated outputs.

**Behavior:**

- Replace hard-coded `session-export-transcript` with `{{skill:session-export-transcript}}` (and observer likewise).
- Phrase invocation generically, or build it from `{{distribution.name}}`, so the plugin copy renders `export-transcript`/`search` correctly.

**Verify:** the generated `plugins/session/skills/search/SKILL.md` names `export-transcript`, and the standalone copy names `session-export-transcript`. Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint touched files; `pnpm run build` and `pnpm run build:check` when SKILL.md, references, or runtime code change.
**Commit:** `fix(p03-t08): render sibling skill names per distribution`

### Task p03-t09: (review) Correct the incomplete-run exit-code wording

Source: reviews/archived/p03-review-2026-10-02T080403Z.md, Low.

**Files:** `src/skills/session-search/SKILL.md`, plus the regenerated outputs.

**Behavior:** "An incomplete run exits by its results (0 or 2), or 3 when `needsConfirmation` is also set."

**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint touched files; `pnpm run build` and `pnpm run build:check` when SKILL.md, references, or runtime code change.
**Commit:** `docs(p03-t09): fix incomplete-run exit-code wording`

### Task p03-t10: (review) Align item_completed extraction with observed record shapes

Source: reviews/archived/p03-review-2026-10-02T080403Z.md, Low.

**Files:** `lib/adapters/codex.ts`, `lib/adapters/codex.test.ts`, `lib/scan.ts`, `lib/scan.test.ts`, `helpers/test-helpers.ts`.

**Behavior:**

- Add the `Extension` `query` string to the extracted fields.
- Drop `CollabAgentToolCall` from both parsed extraction and `RAW_CODEX_ITEM`: observed records carry no searchable text (`tool`, `receiver_agents`, `agents_states`), so parsed and raw behavior now agree.
- Fixtures use observed key shapes.

**Test:** an Extension web-search `query` phrase is found with includeTools. A CollabAgentToolCall line, normal or oversize, yields no tool unit.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint touched files; `pnpm run build` and `pnpm run build:check` when SKILL.md, references, or runtime code change.
**Commit:** `fix(p03-t10): align codex item_completed extraction with observed shapes`

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

### Task p04-t04: (review) Mention session search on the README and docs home

Source: reviews/archived/p04-review-2026-10-02T083046Z.md, Medium.

**Files:** `README.md` (Session plugin row and description lines), `documentation/docs/index.md` (Session plugin mentions); regenerate `documentation/index.md` if needed.

**Behavior:** both front doors describe the Session plugin including session search, consistent with the plugins index wording.
**Verify:** Format the edited Markdown (`pnpm exec oxfmt --write <files>`). If a skill source changed, run `pnpm run build` and `pnpm run build:check`. Then run `pnpm run test:vitest tests/repo` and `pnpm run validate`; for docs changes also run `cd documentation && pnpm build`.
**Commit:** `docs(p04-t04): mention session search on readme and docs home`

### Task p04-t05: (review) Correct the history-file field lists

Source: reviews/archived/p04-review-2026-10-02T083046Z.md, Low.

**Files:** `documentation/docs/engineering/architecture/session-schemas/index.md`, `src/skills/session-search/references/store-layouts.md` (then regenerate).

**Behavior:** remove `pastedContents` from the fields "the code reads", or mark it as present but unused.
**Verify:** Format the edited Markdown (`pnpm exec oxfmt --write <files>`). If a skill source changed, run `pnpm run build` and `pnpm run build:check`. Then run `pnpm run test:vitest tests/repo` and `pnpm run validate`; for docs changes also run `cd documentation && pnpm build`.
**Commit:** `docs(p04-t05): correct history field lists`

### Task p04-t06: (review) State the deep-tier precondition in the docs tier table

Source: reviews/archived/p04-review-2026-10-02T083046Z.md, Low.

**Files:** `documentation/docs/user-guide/skills/session-search.md`.

**Behavior:** the deep row states that it runs only when the `content` tier is selected (and that `--include-tools` labels the content scan `deep`).
**Verify:** Format the edited Markdown (`pnpm exec oxfmt --write <files>`). If a skill source changed, run `pnpm run build` and `pnpm run build:check`. Then run `pnpm run test:vitest tests/repo` and `pnpm run validate`; for docs changes also run `cd documentation && pnpm build`.
**Commit:** `docs(p04-t06): state deep-tier precondition`

### Task p04-t07: (review) Say the remote fallback is unranked and unredacted

Source: reviews/archived/p04-review-2026-10-02T083046Z.md, Low.

**Files:** `documentation/docs/user-guide/skills/session-search.md`. Also `src/skills/session-search/SKILL.md` and/or `references/remote-fallback.md` if they lack it (then regenerate).

**Behavior:** the remote-search section notes that the no-install fallback returns raw, **unranked** and **unredacted** matches, so the agent must show only short excerpts and must not echo credential-shaped text.
**Verify:** Format the edited Markdown (`pnpm exec oxfmt --write <files>`). If a skill source changed, run `pnpm run build` and `pnpm run build:check`. Then run `pnpm run test:vitest tests/repo` and `pnpm run validate`; for docs changes also run `cd documentation && pnpm build`.
**Commit:** `docs(p04-t07): note remote fallback is unranked and unredacted`

---

## Phase 5: Final review fixes

Source: reviews/archived/final-review-2026-10-02T084934Z.md (final code review, 0C/0H/3M/4L). Fix tasks for the final-review findings. L2 was aligned by root; L3 was rejected with rationale (see implementation.md).

### Task p05-t01: (review) Confine deep raw-fallback matching to tool content

Source: reviews/archived/final-review-2026-10-02T084934Z.md, Medium M1.

**Files:** `src/skills/session-search/src/lib/scan.ts`, `lib/scan.test.ts`, `lib/pipeline.test.ts`.

**Behavior:** the deep-tier raw fallback for oversize lines must not match record metadata (Claude `cwd`, `gitBranch`, `sessionId`, `version`, `uuid`/`parentUuid`, `timestamp`, `userType`, `slug`; Codex envelope fields). Either match only within the raw span of the tool-content value (e.g. from the `"content":`/`"output":`/`"result":` key of the carrier), or exclude spans of the known metadata keys before matching.

**Test:** an oversize Claude `tool_result` line whose only occurrence of the pattern is in `cwd`/`gitBranch` yields no deep hit. The same pattern inside the tool content is still found.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files; `pnpm run build` and `pnpm run build:check`. Each new test must fail against the pre-fix code.
**Commit:** `fix(p05-t01): confine deep raw fallback to tool content`

### Task p05-t02: (review) Cover more common token families in redaction

Source: reviews/archived/final-review-2026-10-02T084934Z.md, Medium M2.

**Files:** `lib/redact.ts`, `lib/redact.test.ts`.

**Behavior:** mask these families:

- Google `AIza[0-9A-Za-z_-]{35}`
- GitLab `glpat-[0-9A-Za-z_-]{20,}`
- Stripe `(sk|rk|pk)_(live|test)_[0-9A-Za-z]{16,}` (short forms included)
- Hugging Face `hf_[A-Za-z0-9]{30,}`
- AWS temporary key IDs `ASIA[0-9A-Z]{16}`

Keep the scan linear and re-run the 256 KiB timing test. **Bare 32-hex masking is out of scope (rejected).** It would mask MD5 and other hashes and IDs that users search for; keyed hex values are already covered by the key-value rule.

**Test:** one positive per family; negatives for prose and an MD5-looking hash.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files; `pnpm run build` and `pnpm run build:check`. Each new test must fail against the pre-fix code.
**Commit:** `fix(p05-t02): redact additional common token families`

### Task p05-t03: (review) Bound per-hit memory during scans

Source: reviews/archived/final-review-2026-10-02T084934Z.md, Medium M3 (a broad deep query used 1.42 GB RSS on a 4.9 GiB store).

**Files:** `lib/scan.ts`, `lib/pipeline.ts`, `lib/rank.ts`, `lib/types.ts`, and the related tests.

**Behavior:**

- At scan time, keep at most a bounded excerpt per hit. Build the redacted snippet early with `snippetFor`, or keep a bounded window (e.g. ±2 KiB around the match) instead of the full unit text.
- Keep the per-session stored-hit cap.
- Ranking must use only those bounded fields.

**Test:** a hit from a 1 MiB text unit stores at most the bounded size. Ranking and snippets are unchanged for the existing fixtures.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files; `pnpm run build` and `pnpm run build:check`. Each new test must fail against the pre-fix code., plus a measured RSS spot-check (e.g. `/usr/bin/time -l`) of a broad deep query on the local store, before and after, reported in the task notes.
**Commit:** `fix(p05-t03): bound per-hit memory during scans`

### Task p05-t04: (review) Emit ask-user prompts and answers as separate units

Source: reviews/archived/final-review-2026-10-02T084934Z.md, Low L1 (results with `rg` differ from results without it when a pattern spans the combined `prompt: answer` text).

**Files:** `lib/adapters/claude-code.ts`, `lib/adapters/codex.ts`, `lib/scan.test.ts`.

**Behavior:** emit the question/label and each answer value as separate units, so every emitted string exists contiguously in the raw bytes and the prefilter-superset invariant holds.

**Test:** in the `gives identical hits with and without rg` test, a pattern spanning a label and its answer gives identical results either way.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files; `pnpm run build` and `pnpm run build:check`. Each new test must fail against the pre-fix code.
**Commit:** `fix(p05-t04): emit ask-user prompt and answers as separate units`

### Task p05-t05: (review) List SESSION_SEARCH_PROBE_TIMEOUT_MS in --help

Source: reviews/archived/final-review-2026-10-02T084934Z.md, Low L4.

**Files:** `src/skills/session-search/src/session-search.ts` (`HELP`), plus a CLI `--help` assertion in `src/cli.test.ts` if one exists.

**Behavior:** the `Environment:` block lists `SESSION_SEARCH_PROBE_TIMEOUT_MS  tool-probe timeout in ms (default 3000)`.

**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files; `pnpm run build` and `pnpm run build:check`. Each new test must fail against the pre-fix code.
**Commit:** `fix(p05-t05): document probe timeout env in help`

---

### Task p05-t06: (review) Blank Codex structural fields before raw matching

Source: reviews/archived/final-review-2026-10-02T114035Z.md, Low 1.

**Files:** `lib/scan.ts`, `lib/scan.test.ts`.

**Behavior:** add Codex item structural keys (`status`, `source`, `type`/`item.type`, `call_id`, `id`, `exit_code`, `duration`, and similar envelope fields observed on `item_completed` CommandExecution/McpToolCall lines) to the metadata-blanking list, keeping the 1024-char cap and the linear-time guarantees.

**Test:** an oversize Codex command-output line whose only match is a structural value (e.g. `unified_exec_startup` in `source`) yields no deep hit, while the same text inside `aggregated_output` is still found.
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files; `pnpm run build` and `pnpm run build:check`. Each new test must fail against the pre-fix code.
**Commit:** `fix(p05-t06): blank codex structural fields before raw matching`

### Task p05-t07: (review) Redact npm tokens

Source: reviews/archived/final-review-2026-10-02T114035Z.md, Low 2.

**Files:** `lib/redact.ts`, `lib/redact.test.ts`.

**Behavior:** mask `npm_[A-Za-z0-9]{36}` tokens, with the timing test still passing.

**Test:** a positive npm token and a prose negative (e.g. `npm_config_cache`).
**Verify:** Verify `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint the touched files; `pnpm run build` and `pnpm run build:check`. Each new test must fail against the pre-fix code.
**Commit:** `fix(p05-t07): redact npm tokens`

---

### Task p05-t08: (gate review) Restrict the rg prefilter to never-escaped characters

Source: reviews/archived/final-review-2026-10-02T120208Z.md, Medium M1 (implementation exit gate, cross-family). Real stores contain JSON escapes of HTML-sensitive characters (`\u003c`, `\u003e`, `\u0026`, `\u0027` in 77 local files) and escaped slashes (`\/` in about 1,340 local files). A safe-looking pattern containing `/`, `<`, `>`, `&`, or `'` therefore misses in raw-byte `rg` while Node matches the decoded text, so the prefilter is not a superset.

**Files:** `lib/scan.ts`, `lib/scan.test.ts`, `lib/pipeline.test.ts` (or `src/cli.test.ts`).

**Behavior:** `isPrefilterSafe` allows only ASCII letters, digits, space, `-`, and `_`, plus the constructs `.*`, `.+`, `|`, and groups. Every other character makes the pattern prefilter-unsafe, so the file set is scanned in Node. Document the invariant: no JSON writer used by these stores escapes those characters. Update the scan module comment and design.md's prefilter sentence. Root aligns design.md.

**Test:** the accelerated/fallback parity test gains:

- a decoded `src/foo` stored as `src\/foo`
- `a<b` stored as `a\u003cb`
- `it's` stored as `it\u0027s`
- a cheap-tier competing hit, so the automatic deep retry cannot hide the defect

With and without rg, results must be identical. The tests must fail before the fix.
**Verify:** `pnpm run test:vitest src/skills/session-search` and `pnpm run type-check`; format/lint; `pnpm run build` and `pnpm run build:check`.
**Commit:** `fix(p05-t08): restrict rg prefilter to never-escaped characters`

---

## Reviews

| Scope | Type     | Status          | Date       | Artifact                                                    | Reviewed Head                            | Invocation | Gate Target       |
| ----- | -------- | --------------- | ---------- | ----------------------------------------------------------- | ---------------------------------------- | ---------- | ----------------- |
| p01   | code     | fixes_completed | 2026-10-02 | reviews/archived/p01-review-2026-10-02T061433Z.md           | d2fdc0bed2f806ebbd0463e396cc66e747c3f488 | auto       | -                 |
| p01   | code     | fixes_completed | 2026-10-02 | reviews/archived/p01-review-2026-10-02T062929Z.md           | e4ae386d889d279a69e859fa7bd44aaca422b67d | auto       | -                 |
| p02   | code     | fixes_completed | 2026-10-02 | reviews/archived/p02-review-2026-10-02T071003Z.md           | 0367021c                                 | auto       | -                 |
| p02   | code     | fixes_completed | 2026-10-02 | reviews/archived/p02-review-2026-10-02T072802Z.md           | e09b9afe                                 | auto       | -                 |
| p03   | code     | fixes_completed | 2026-10-02 | reviews/archived/p03-review-2026-10-02T080403Z.md           | 7ff0c270                                 | auto       | -                 |
| p04   | code     | fixes_completed | 2026-10-02 | reviews/archived/p04-review-2026-10-02T083046Z.md           | 9ccaef4f                                 | auto       | -                 |
| p05   | code     | passed          | 2026-10-02 | reviews/archived/final-review-2026-10-02T114035Z.md         | 3fb6dc1fa82e8c49d0bb61f493778cc8e9df764f | auto       | -                 |
| final | code     | fixes_completed | 2026-10-02 | reviews/archived/final-review-2026-10-02T084934Z.md         | 7941601149bdf9adf2a7d9e6d9b55f98152f1fb1 | auto       | -                 |
| final | code     | passed          | 2026-10-02 | reviews/archived/final-review-2026-10-02T114035Z.md         | 3fb6dc1fa82e8c49d0bb61f493778cc8e9df764f | auto       | -                 |
| plan  | artifact | fixes_completed | 2026-10-02 | structured (in-memory) x3                                   | -                                        | auto       | -                 |
| plan  | artifact | fixes_completed | 2026-10-02 | reviews/archived/artifact-plan-review-2026-10-02T053829Z.md | -                                        | gate       | codex-6-sol-xhigh |
| plan  | artifact | passed          | 2026-10-02 | reviews/archived/artifact-plan-review-2026-10-02T055258Z.md | -                                        | gate       | codex-6-sol-xhigh |
| final | code | fixes_completed | 2026-10-02 | reviews/archived/final-review-2026-10-02T120208Z.md | bc7aea7bed64a51938e51a4f241a5bff8584806f | gate | codex-6-sol-xhigh |

For code-review events, `Reviewed Head` is the full 40-character SHA at the
head of the reviewed range. `Invocation` records `manual`, `auto`, or `gate`;
`Gate Target` is populated only for gate events. Legacy five-column rows remain
valid. Writers must preserve every existing row and every unknown trailing
cell; never truncate a widened row back to five columns.

Plan artifact review disposition (Step 3.6/3.7): the auto artifact-review loop ran 3 structured attempts with `oat-reviewer-claude-claude-opus-5-5-high`. Request IDs: session-search-plan-review-1/2/3. Route: native, policy-resolved under the `high` dispatch policy. Findings: attempt 1 had 3 High, 7 Medium, and 4 Low, all fixed. Attempt 2 had 1 High, 5 Medium, and 3 Low, all fixed. Attempt 3 had 1 High (deep-rung raw fallback scope) and 2 Medium (`validate:skill-versions` base ref; prefilter wildcard safety), all fixed in-artifact after the retry bound (2) was exhausted, so they have not been re-reviewed by this loop. They are re-reviewed by the configured cross-family `oat-project-quick-start` exit gate.

Exit-gate attempt 1 (`oat-project-quick-start` gate, run `cd2b64af`, target `codex-6-sol-xhigh`, different-family) was **blocked** with 3 High and 1 Medium findings. All four were received as valid and resolved in-artifact: quoted/escaped JSON credential redaction; prefilter rejects character classes; Claude tool text extracted untruncated; bounded restricted large-scan. Gate attempt 2 (target `codex-6-sol-xhigh`, different-family) **passed** with 0 Critical, 0 High, 0 Medium, and 0 Low. Plan artifact review disposition: **passed**.

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

---

## Implementation Complete

**Summary:**

- Phase 1: 16 tasks. Core library: types/shim, options/time, matcher/snippets, redaction, tool probe, plus 11 p01 review fixes (t06–t16).
- Phase 2: 21 tasks. Adapters (Claude Code, Codex, Cursor), content scanner, ranker, pipeline, CLI entry, plus 12 p02 review fixes (t08–t19) and 2 root follow-ups (t20–t21).
- Phase 3: 10 tasks. SKILL.md and references, build/distribution/plugin metadata/pinned lists, CLI integration tests. Includes 2 root follow-ups (t04 Codex MCP results, t05 ladder guidance) and 5 p03 review fixes (t06–t10).
- Phase 4: 7 tasks. Docs, stale-path fix, changelog plus premerge. Includes 4 p04 review fixes (t04–t07).
- Phase 5: 8 tasks. Final-review fixes (deep raw-fallback scoping, token families, bounded hit memory, ask-user unit split, help text).

**Total: 62 tasks**

## References

- Discovery: `discovery.md`
- Design: `design.md`
- Execution learnings: `oat-execution-learnings.md`
- Session schemas: `documentation/docs/engineering/architecture/session-schemas/`
- Shared transcript library: `src/shared/transcript/runtimes.ts`
- Adding a skill: `documentation/docs/engineering/contributing/development/adding-a-skill.md`
