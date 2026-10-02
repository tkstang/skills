---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-10-02
oat_generated: false
oat_template: false
oat_template_name: design
---

# Design: session-search

> Lightweight quick-mode design, drafted non-interactively (gate QS-06,
> draft-and-review) under an autonomous run. It covers only what a quality
> plan needs.

## Overview

`session-search` is a new canonical skill in tkstang/skills. It helps any coding agent (Claude Code, Codex, Cursor) find a past AI session from a fuzzy description. The skill has two halves:

1. **Agent guidance in `SKILL.md`.** The agent runs a short intake (topic, any exact phrases the user remembers, time window, suspected repo). It expands the description into several literal or regex patterns and invokes the CLI. It then presents a ranked candidate list. When the results are empty, it walks a widening ladder: deep scan, then "was it ChatGPT?", then "search another machine?".
2. **A bundled, dependency-free Node CLI (`scripts/session-search.mjs`).** It searches the **local** machine's session stores in cost order:
   - **Tier 1 (`history`):** history files.
   - **Tier 2 (`meta`):** metadata indexes.
   - **Tier 3 (`content`):** a bounded full-content scan of user and assistant text.
   - **Tier 4 (`deep`):** includes tool output.

   It returns deterministic ranked JSON grouped by **parent session**.

Key decisions:

- The CLI is **stateless**. Speed comes from tiering, hint-scoped windows, and noise exclusion.
- `rg` and `sqlite3` are **optional accelerators** detected at runtime. `rg` serves only as a fast file **prefilter**. Every match is verified and classified by role in Node, so results are identical with or without `rg`.
- The CLI reuses the shared transcript library (`src/shared/transcript/runtimes.ts`) for record parsing, metadata, and user/assistant normalization. It adds its own store-wide enumerator, because the shared library only exposes store roots and per-file parsing, and the observer's walkers are cwd-scoped and not exported.

## Architecture

### System Context

The skill sits beside the existing `session-*` skills. It ships standalone (`skills/session-search`) and in the `session` plugin (`plugins/session/skills/search`), generated from `src/skills/session-search/` by the standard build. It reads only on-disk session stores under `$HOME`, and it writes nothing besides stdout and stderr.

**Key Components:**

- **CLI entry (`session-search.ts`):** parses arguments, resolves options, runs the pipeline, and emits JSON or a text table. It also exposes an `estimate` subcommand.
- **Options & time window (`lib/options.ts`):** parses `--since`/`--until` (relative `24h`, `7d`, `2w`; keywords `today` and `yesterday`; ISO dates) and normalizes `--cwd` hints.
- **Matcher (`lib/matcher.ts`):** compiles agent-supplied patterns. These are case-insensitive regexes; `--literal` escapes them. It reports which patterns hit and produces bounded snippets.
- **Tool probe (`lib/tools.ts`):** detects `rg` and `sqlite3` via a spawn probe. It honors `SESSION_SEARCH_RG` / `SESSION_SEARCH_SQLITE3` overrides and common absolute locations (`/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`), because remote non-interactive shells often lack Homebrew on PATH.
- **Source adapters (`lib/adapters/{claude-code,codex,cursor}.ts`):** one adapter per runtime with a common interface. Each adapter handles enumeration, history hits, metadata hits, and per-file content verification.
- **Content scanner (`lib/scan.ts`):** an optional `rg -l` prefilter plus a Node streaming line reader. It applies the line-byte cap, parses JSON, normalizes records to role-tagged text through the shared library, and matches.
- **Pipeline (`lib/pipeline.ts`):** orchestrates the tiers, the cwd-first scope with auto-widening, the time window, the large-scan guard, and the deep rung.
- **Ranker (`lib/rank.ts`):** merges hits into sessions, rolls subagent hits up to parents, scores, and sorts deterministically.
- **Redaction (`lib/redact.ts`):** masks credential-shaped substrings in snippets and titles before output.

### Component Diagram

```
             ┌──────────────────── SKILL.md (agent guidance) ───────────────────┐
             │ intake → pattern expansion → invoke CLI → present → widen ladder │
             └───────────────────────────────┬──────────────────────────────────┘
                                             │ node scripts/session-search.mjs …
┌──────────────┐  ┌─────────┐  ┌─────────────▼────────────┐  ┌──────────────┐
│ options/time │→ │ matcher │→ │         pipeline         │→ │ rank+redact  │→ JSON
└──────────────┘  └─────────┘  │ T1 history → T2 meta →   │  └──────────────┘
                               │ T3 content → (T4 deep)   │
                               └───┬─────────┬─────────┬──┘
                         ┌─────────▼──┐ ┌────▼─────┐ ┌─▼─────────┐
                         │ claude-code│ │  codex   │ │  cursor   │  adapters
                         └─────┬──────┘ └────┬─────┘ └─────┬─────┘
                               │ scan.ts (rg -l prefilter? → stream verify)
                               │ shared/transcript/runtimes.ts (parse/normalize)
                               ▼
              ~/.claude/{history.jsonl,projects/**}  ~/.codex/{history.jsonl,
              session_index.jsonl,state_5.sqlite,sessions/**,archived_sessions/*}
              ~/.cursor/projects/*/agent-transcripts/**
```

### Data Flow

```
1. parse args → SearchOptions {patterns, since/until, cwdHints, runtimes, tiers,
   includeTools, allowLargeScan, limit, maxLineBytes, json}
2. probe tools (rg, sqlite3)
3. enumerate sessions per adapter (stat only; Codex session_meta headers read
   lazily, only for files that survive the time window, or skipped when
   sqlite threads supply cwd/rollout_path): SessionFile
   {runtime, path, sessionId, parentSessionId?, isSubagent, archived, mtimeMs, size}
   → apply time window on mtime (cheap); keep the full list for widening
4. scope pass 1 = sessions whose recorded/encoded cwd matches a --cwd hint
   (when given); else all
5. T1 history: stream history files; match prompt text; hits → sessionId (+cwd)
6. T2 meta: codex threads via sqlite3 -readonly (title, first_user_message,
   cwd, rollout_path, created/updated_at, archived), session_index.jsonl
   thread names, claude ai-title/custom-title via bounded metadata reads
7. T3 content: candidate files = scope ∩ window, unless the estimate exceeds
   the large-scan threshold (measured after window + scope narrowing) →
   then candidates = files already hit in T1/T2 only, and the result sets
   needsConfirmation {estimatedBytes, fileCount}
   → rg -l prefilter (if available) → Node stream verify (user/assistant only)
8. if pass 1 had a cwd scope and produced 0 sessions → re-run 5–7 unscoped,
   set widened=true
9. if still 0 sessions, the content tier is selected, and the deep rung is
   enabled → T4: same as T3 with tool output included. `--include-tools`
   instead labels the content scan itself `deep`. tiersRun lists only scans
   that actually ran (a guard-skipped or zero-file rung is omitted)
10. rank, roll up subagents, redact, cap snippets, limit → emit
```

## Component Design

### Source adapters

**Purpose:** isolate per-runtime store layout and record semantics behind one interface.

**Interface:**

```ts
interface SourceAdapter {
  runtime: Runtime; // 'claude-code' | 'codex' | 'cursor'
  roots(home: string): StoreRoots; // existence-checked paths
  enumerate(ctx: EnumerateContext): Promise<SessionFile[]>; // EnumerateContext = Omit<AdapterContext, 'files'>
  historyHits(ctx: AdapterContext, m: Matcher): Promise<Hit[]>; // tier 1
  metadataHits(ctx: AdapterContext, m: Matcher): Promise<Hit[]>; // tier 2
  sessionInfo(file: SessionFile): Promise<SessionInfo>; // cwd, title, firstPrompt, startedAt (bounded read)
  classifyRecord(record: JsonObject, includeTools: boolean): TextUnit[]; // role-tagged text for tier 3/4
  openHint(file: SessionFile, info: SessionInfo): { command: string | null; hint: string };
  fileClassifier?(file: SessionFile, includeTools: boolean): RecordClassifier; // per-file state (tool-name / call-id maps) for ask-user pairing
}
// AdapterContext carries an optional `deadline` (epoch ms) honored by enumeration header reads, title tail reads, and scoping loops.
// SessionFile carries `agentAuthored` for Codex threads whose source has a `subagent` key (thread_spawn, review, memory_consolidation, guardian); their user-role text is never user-typed.
```

**Per-runtime behavior:**

- **claude-code**
  - Enumerate `~/.claude/projects/*/*.jsonl` (parents) and `*/<sid>/subagents/**/*.jsonl` (subagents, `parentSessionId = <sid>`).
  - History: `~/.claude/history.jsonl` `{display, project, sessionId, timestamp}`.
  - Meta: `ai-title`/`custom-title` records via `readMetadataRecordsBounded`.
  - Cwd: the record `cwd` (and the slug via `encodeCwdVariants` for hint pre-filtering before reads).
  - Resume hint: `claude --resume <sessionId>` (run in the recorded cwd).
- **codex**
  - Enumerate `~/.codex/sessions/**/rollout-*.jsonl` and `~/.codex/archived_sessions/rollout-*.jsonl` (`archived: true`).
  - Parent and child: read the `session_meta` header (bounded). When `payload.id !== payload.session_id`, the file is a child with `parentSessionId = payload.session_id`.
  - History: `~/.codex/history.jsonl` `{session_id, ts, text}`.
  - Meta: `state_5.sqlite` `threads` via `sqlite3 -readonly -json`, after probing the columns with `PRAGMA table_info(threads)`. Missing table or columns skip the tier with a diagnostic. Also `session_index.jsonl` `{id, thread_name, updated_at}`.
  - Resume hint: `codex resume <id>`.
- **cursor**
  - Enumerate `~/.cursor/projects/*/agent-transcripts/<id>/<id>.jsonl` (plus `subagents/`).
  - No history file and no metadata index exist, so the time is the mtime. Cwd hints match by encoded slug only (`encodeCwdVariants('cursor', cwd)`).
  - Open hint: the transcript path ("open in Cursor").

All adapters degrade gracefully. A missing root yields no sessions and adds a `sources[]` entry with `status: "absent"`. Parse failures are counted, not thrown.

### Content scanner

**Purpose:** verify and classify matches without loading whole transcripts or matching tool noise by default.

**Responsibilities:**

- **Optional prefilter:** run `rg -l -i --no-messages -e <p1> -e <p2> … -- <files…>`, chunked by argument length. It narrows the candidate files only and must be a provable superset of the Node scan, so it runs only when every pattern is prefilter-safe. Safe patterns are literal ASCII without quotes, backslashes, or control characters, plus `.*`/`.+`, `|`, and groups. Backslashes, any character class, a bare `.` or `.?`/`.{n}` wildcard, lookaround, and non-ASCII are all rejected. Otherwise, or on an rg error, every candidate is scanned in Node. The exception is a **deadline timeout** of `rg`: the run is marked `incomplete`, with no Node fallback past the deadline. The **deep tier always skips the prefilter**, because deep text is decoded or re-serialized. Patterns are passed through `-e` (never through a shell), with `--fixed-strings` when `--literal` is set.
- **Node verification:**
  - Stream each surviving file with a line reader that splits on LF only.
  - **Skip lines longer than `maxLineBytes`** (default 64 KiB) before `JSON.parse`, and count them in diagnostics.
  - On the deep tier only, an oversize line goes through a narrow raw fallback: it is matched unparsed only when its prefix identifies a known tool-output carrier (Codex `function_call_output`/`custom_tool_call_output`, Codex `item_completed` CommandExecution/McpToolCall/FileChange, Claude `tool_result`). `world_state`, `session_meta`, `turn_context`, and `compacted` are never raw-matched, and the child inherited-record skip is applied via the `ordinal` in the prefix.
  - Parse the record, call `adapter.classifyRecord`, and match each text unit.
  - Stop a file after `maxHitsPerSession` units.
- **Classification is adapter-owned.** Each adapter's `classifyRecord` turns one raw record into role-tagged units, and a shared `classify.ts` maps roles:
  - `kind` `tool_call`/`tool_result` → `tool`.
  - `origin`/`displayRole` `automatic-control`, `runtime-notification`, or `runtime-diagnostic` → `context`.
  - Otherwise the entry role.

  Per runtime:
  - **Claude Code** uses `normalizeEntries('claude-code', [record], …)` per record. It is safe because Claude records are self-contained.
  - **Codex** uses `normalizeEntries` for message records and, through a per-file call-id map, for `request_user_input` questions and answers (conversational, not tool). With `includeTools`, it also emits `tool` units from `event_msg` `item_completed` items: `McpToolCall` (result text blocks, `structuredContent`, arguments), `CollabAgentToolCall`/`Extension` (`result`/`results`/`output`/`content`), `FileChange` (summary). `Reasoning`, `AgentMessage`, and `UserMessage` items are never emitted. With `includeTools`, it also emits `tool` units directly from `function_call_output`/`custom_tool_call_output` output, `function_call` arguments, and `exec_command_end`, because the shared Codex normalizer drops tool output. Child rollouts skip inherited records (`ordinal < subagent_history_start_ordinal`).
  - **Cursor** extracts text directly from the raw record and never calls `normalizeEntries`, because the shared Cursor normalizer only emits at `turn_ended` and returns nothing for a lone record.
- **Injected-context demotion:** user-role text for which any of the repo's existing `HIDDEN_PAYLOAD_MATCHERS` returns true is reclassified as `context`. Those matchers come from `session-export-transcript/src/sanitize.ts` through a shim under a cross-skill `allowedSourceRoots` entry. A leading `<user_instructions>` is a local addition. Context is weighted like assistant text and never counted as user-typed.
- **Claude tool text** is extracted directly from raw `tool_result`/`tool_use` blocks at full length when `includeTools` is set, because the shared normalizer truncates tool text (500/200 chars).

### Pipeline

**Purpose:** run the tiers cheapest first with scope and safety rules.

**Responsibilities:**

- Apply the time window to `mtimeMs` (session last activity). The meta tier can also supply `createdAt`. A session matches the window when its activity interval overlaps it.
- **Cwd-first widening:** pass 1 is restricted to sessions whose cwd matches a hint. A match means equal to the hint or a descendant of it, compared after path normalization; Cursor compares encoded slugs. Git worktree expansion is out of scope for v1. If pass 1 finds no sessions, pass 2 runs unscoped and the result reports `widened: true`.
- **Large-scan guard:**
  - Before tier 3, sum the bytes of the candidate files.
  - The sum is measured after the window and scope narrowing. If it exceeds `largeScanBytes` (default 2 GiB, flag `--large-scan-bytes`) and `--allow-large-scan` is unset, restrict tier 3 to sessions already hit in tiers 1–2 and set `needsConfirmation`. The restricted set's bytes are then recomputed. If they still exceed the threshold, the content and deep tiers are skipped and only cheap-tier results are returned with `needsConfirmation`.
  - The agent asks the user and re-runs with `--allow-large-scan`.
- **Deep rung:** when everything above yields 0 sessions, the content tier is selected, and `--no-deep` is unset, run tier 4 (tool output included) under the same guard. With `--include-tools`, the content scan itself is labeled `deep`. `tiersRun` records only scans that ran.
- **Deadline:** an optional `--deadline-ms` (default none). When it is reached, the CLI returns partial results with `incomplete: true`.

### Ranker

**Purpose:** a deterministic, explainable ordering.

**Score per session** (higher is better):

```
score = 40 * distinctPatternsMatched/patternCount
      + 25 * (any user-typed hit)          // history tier or user role
      + 15 * (title/first-prompt hit)
      + 10 * cwdHintMatch
      +  6 * min(hitCount, 5)/5
      +  4 * recency (1.0 = newest in result set → 0.0 = oldest)
```

- Ties are broken by `lastActivity` descending, then by `runtime` and `sessionId`.
- Subagent hits roll up to the parent session, which is created from enumeration or meta when the parent file exists. Rolled-up hits are labeled `via: "subagent"` and count at half weight.
- If the parent is missing, the subagent session is listed on its own with `isSubagent: true`.
- Each session reports `matchedTiers` and `matchedPatterns`.

### Redaction

**Purpose:** avoid echoing secrets from transcripts.

**Responsibilities:**

- Mask credential-shaped substrings in snippets and titles, including JSON-quoted and JSON-escaped `"key":"value"` forms with the full quoted value masked:
  - `sk-…`, `ghp_`/`gho_`/`github_pat_…`, `xox[abp]-…`, `AKIA…`
  - `Bearer <token>`
  - `password=…`/`token=…`-style pairs
  - `password=…`/`token=…`-style pairs with credential words in prefixed or suffixed identifiers (`AWS_SECRET_ACCESS_KEY=`), in plain, JSON-quoted, and **multi-level escaped** forms
  - space-separated CLI flags (`--password X`, `--api-key X`)
  - URL-userinfo passwords (`scheme://user:pass@host`) and token-only userinfo
  - `Authorization: Basic|Bearer|Token …` header values
  - long hex runs, and base64-like runs (`[A-Za-z0-9+/_-]{40,}`) that contain a digit and mixed case
- **Exemptions** (to keep snippets readable): `/`, `-`, or `_`-separated word-segment runs with a lowercase-only first segment (paths and Claude project slugs), and genuine camelCase identifiers (bounded uppercase-only and digit pieces). A seeded statistical test keeps random tokens masked.
- Redaction regexes anchor at the start of runs so the scan stays linear (256 KiB timing tests).
- Emitted snippets always go through `snippetFor(text, matcher, preHit)`. It redacts the full unit first, then re-matches outside `[REDACTED]` markers and windows there. If the hit itself was redacted, it centers on the marker nearest the original hit. `Hit.firstIndex` is pre-redaction and is never reused on redacted text.
- Snippets keep ±80 characters around the first hit in a unit, collapse whitespace, cap at 240 characters, and allow at most 3 per session. The CLI never emits whole records.

## Data Models

### SearchResult (CLI JSON output, `schema: "session-search/v1"`)

```ts
interface SearchResult {
  schema: 'session-search/v1';
  query: {
    patterns: string[];
    literal: boolean;
    since: string | null;
    until: string | null;
    cwdHints: string[];
    runtimes: Runtime[];
  };
  host: { hostname: string; platform: string }; // local identity for multi-machine merges
  tools: { rg: string | null; sqlite3: string | null }; // resolved paths or null
  tiersRun: Array<'history' | 'meta' | 'content' | 'deep'>;
  widened: boolean; // cwd-scoped pass found nothing → unscoped
  needsConfirmation: null | {
    reason: 'large-scan';
    estimatedBytes: number;
    fileCount: number;
    rerunFlag: '--allow-large-scan';
  };
  incomplete: boolean;
  sources: Array<{
    runtime: Runtime;
    root: string;
    status: 'ok' | 'absent' | 'degraded';
    sessions: number;
    note?: string;
  }>;
  results: SessionHit[];
  diagnostics: {
    filesScanned: number;
    bytesScanned: number;
    linesSkippedOversize: number;
    parseErrors: number;
    elapsedMs: number;
  };
}

interface SessionHit {
  rank: number;
  score: number;
  runtime: Runtime;
  sessionId: string;
  archived: boolean;
  isSubagent: boolean;
  cwd: string | null;
  title: string | null;
  firstPrompt: string | null; // redacted, ≤160 chars
  startedAt: string | null;
  lastActivity: string; // ISO
  matchedPatterns: string[];
  matchedTiers: Array<'history' | 'meta' | 'content' | 'deep'>;
  snippets: Array<{
    role: 'user' | 'assistant' | 'context' | 'tool' | 'title';
    tier: string;
    text: string;
    via?: 'subagent';
  }>;
  transcriptPath: string | null;
  open: { command: string | null; hint: string };
}
```

## API Design

### CLI

```
node scripts/session-search.mjs [search] -p <pattern> [-p <pattern> …]
    [--literal] [--since <24h|7d|2w|today|yesterday|YYYY-MM-DD>] [--until <…>]
    [--cwd <path>]… [--runtime claude-code,codex,cursor]
    [--tiers history,meta,content] [--no-deep] [--include-tools]
    [--allow-large-scan] [--large-scan-bytes <n>] [--max-line-bytes <n>]
    [--limit <n=15>] [--deadline-ms <n>] [--json] [--help]

node scripts/session-search.mjs estimate [--since …] [--runtime …] [--json]
    → per-runtime file counts/bytes (for the large-scan question and remote planning)
```

- **Output:** `--json` emits `SearchResult`. Without it, the CLI prints a compact table (rank, runtime, when, cwd, title/first prompt, best snippet, open hint).
- **Exit codes:** `3` whenever `needsConfirmation` is set, regardless of result count. Otherwise `0` results found / `2` no sessions matched. `1` usage or hard error. An `incomplete` (deadline) run exits 0 or 2 by results. This follows the repo convention: 2 = none.
- **Environment:**
  - `HOME` (all roots derive from it)
  - `SESSION_SEARCH_RG` and `SESSION_SEARCH_SQLITE3` (tool overrides)
  - `SESSION_SEARCH_NO_RG=1` and `SESSION_SEARCH_NO_SQLITE3=1` (force fallbacks; used by tests)

### Skill invocation surface

The canonical identity is `session-search`, following the repo's `session-*` naming. The plugin target name is `search`, so it surfaces as `session:search` in the session plugin. The skill description is phrased to trigger on "search sessions", "find the session where…", and similar wording. The user-guide page documents that `/search-sessions`-style requests route to it. This was resolved autonomously and recorded as a design decision.

## Error Handling

- A missing store root becomes `sources[].status = "absent"`, never an error.
- An unreadable file is counted in `parseErrors` and skipped.
- A malformed JSON line is skipped and counted. An oversize line is skipped and counted, never parsed.
- `sqlite3` absent, the database locked or missing, or an unexpected schema: the Codex meta tier is `degraded` with a note, and search continues through the history and content tiers. The CLI opens `-readonly` so it never contends with Codex writes.
- An `rg` spawn failure or nonzero exit other than 1 (1 means no matches) falls back to the Node scan for the batch, with a diagnostic note.
- An invalid regex is a usage error (exit 1) naming the pattern. `--literal` is suggested.
- Remote search via ssh is outside the CLI. The SKILL.md guidance owns it (see Remote search below).

## Agent guidance (SKILL.md) outline

1. **Intake.** Extract or ask in a single message for: what the session was about; **any exact phrases, names, or odd terms remembered** (highest precision); the time window; and the suspected repo or directory. Skip the questions the request already answers.
2. **Pattern expansion.** Turn the description into 3–6 patterns: spelling and spacing variants (`perceive ?now`), distinctive nouns, file or command names. Avoid generic words.
3. **Run** the CLI with `--json`, plus `--since` and `--cwd` when hinted.
4. **Present** the top results as a short list: runtime, when, cwd, title or first prompt, best snippet, open/resume hint. Offer to dig into one.
5. **Ladder on empty or weak results:**
   1. Re-run with broader patterns or no time window.
   2. If `needsConfirmation` is set, ask before `--allow-large-scan`, quoting the estimated size.
   3. The deep rung (tool output) runs automatically before an empty result. Report that it did.
   4. Ask whether it might have been **ChatGPT** (desktop data is encrypted locally; use ChatGPT's own search).
   5. Ask whether it might have been on **another machine**. If so, run the remote recipe on the SSH host the user names.
6. **Remote search** (opt-in only; no built-in hosts):
   - Verify `ssh -o BatchMode=yes <host> true`.
   - Locate the installed skill on the remote with a bounded check of the standard skill roots (`~/.agents/skills/session-search`, `~/.claude/skills/session-search`, plugin cache paths).
   - Run `ssh <host> 'PATH=/opt/homebrew/bin:/usr/local/bin:$PATH node <remote-skill>/scripts/session-search.mjs … --json'`.
   - If the skill is not installed remotely, fall back to the documented read-only tier 1–2 one-liners (`rg` on the history files, `sqlite3 -readonly` on Codex threads) in `references/remote-fallback.md`, and suggest installing the skill there.
7. **Privacy.** Show only snippets, never whole transcripts, unless the user asks to open a specific session.

## Testing Strategy

### Unit Tests (Vitest, colocated)

- `options.test.ts`: time parsing (relative, keywords, ISO, invalid) and `--until` < `--since` rejection.
- `matcher.test.ts`: regex vs `--literal`, case-insensitivity, per-pattern hit attribution, snippet windowing and cap.
- `redact.test.ts`: each credential shape is masked, and ordinary text is untouched.
- `rank.test.ts`: the score ordering (user-typed beats assistant-only; title boost; recency tie-break), subagent roll-up at half weight, orphan subagent listing, and determinism.
- `adapters/*.test.ts`:
  - enumeration on synthetic stores (parents, subagents, Codex children via `session_meta`, archived)
  - history parsing
  - Codex sqlite schema probe and degrade (fake `sqlite3` via the `SESSION_SEARCH_SQLITE3` stub script or `SESSION_SEARCH_NO_SQLITE3`)
  - Cursor slug matching
- `scan.test.ts`:
  - LF-only splitting with U+2028 in strings
  - oversize-line skip
  - tool output excluded by default and included with `includeTools`
  - injected-context demotion
  - identical results with and without `rg` (`SESSION_SEARCH_NO_RG=1`)

### Integration Tests (CLI via generated bundle)

`cli.test.ts` runs `spawnSync('node', [CLI_PATH, …])`. Every test uses a temporary `HOME` and `STATE_DIR`, and blanks the harness-detection environment variables. The cases:

- A cross-runtime corpus (Claude, Codex incl. archived, Cursor) with a target phrase in one session → it ranks first; JSON matches `session-search/v1`.
- `--since 24h` excludes older sessions (mtime set via `utimes`).
- A `--cwd` hint with a miss → `widened: true` and the hit is found elsewhere.
- A phrase only in tool output → not found on tiers 1–3, found by the deep rung; `--no-deep` → exit 2.
- A large-scan guard with a tiny `--large-scan-bytes` → exit 3, `needsConfirmation` set; `--allow-large-scan` → full results.
- No stores at all → exit 2, every source `absent`.
- `--help` and usage errors → exit 0 and 1.

Negative tests must fail if the feature is removed: the deep rung, widening, the guard, and redaction. Tests are runtime-agnostic where the code is.

## Repository Integration

- `src/skills/session-search/` contains:
  - `SKILL.md` (frontmatter per the repo contract: `metadata.version: '0.1.0'`; Node 22+ compatibility; `allowed-tools`)
  - `build.json` (entry plus lib files, plus the `lib/runtimes.ts` shim re-exporting the shared library)
  - `src/**`
  - `references/remote-fallback.md`
  - `references/store-layouts.md` (a compact pointer to the session-schema docs plus history and index facts)
- `src/distributions.ts`: an owner entry with `allowedSourceRoots: ['src/shared/transcript', 'src/skills/session-export-transcript']`. Test helpers live in `src/helpers/`, which is exempt from the runtime closure and never bundled. Targets are standalone `skills/session-search` and plugin `session` / `search`.
- Pinned test lists: `tests/release/versioning.test.ts`, `tests/repo/layout.test.ts`, `tests/repo/plugin-manifests.test.ts`, `marketplace-manifests.test.ts`, and the generated-output roots as needed.
- Plugin metadata:
  - Session plugin description updated consistently across the three plugin manifests and the three marketplaces.
  - Codex manifest `interface` prose mentions search.
  - Plugin version bumped via `scripts/bump-version.ts` (minor, `0.3.6` → `0.4.0`).
- Docs:
  - `documentation/docs/user-guide/skills/session-search.md` plus `meta.json` and the index rows.
  - The session plugin page table.
  - `installation.md` mapping.
  - `documentation/index.md`, regenerated with `oat docs generate-index` and never hand-edited.
  - `CHANGELOG.md` `[Unreleased] → Added`.
  - An architecture note linking `session-schemas/` with history and index facts (`history.jsonl`, `state_5.sqlite`, `session_index.jsonl`, `archived_sessions/`) in `session-schemas/index.md` or the provider pages.
- Opportunistic fix: the stale Codex `session-<id>.jsonl` path in:
  - `src/skills/session-export-transcript/SKILL.md`
  - `src/skills/session-export-transcript/references/transcript-formats.md`
  - `src/skills/session-observer/references/transcript-formats.md`

  Bump those owners' `metadata.version` (patch) and check `tests/repo/docs-presence.test.ts`.
- Verification: `pnpm run build`, `build:check`, `type-check`, `lint`, `format:check`, `validate`, `test:vitest`, and finally `premerge`.

## Open Questions

- None blocking. Exact score weights and default thresholds (`largeScanBytes` 2 GiB, `maxLineBytes` 64 KiB, `limit` 15) are tunable constants with tests asserting ordering, not exact numbers.

## Risks and Mitigation

- **Codex internal-store schema drift.** Probe columns, degrade per tier, and test the degrade path.
- **False "user-typed" hits from injected context.** Use injected-context demotion and test it.
- **The plugin and marketplace pinned-list sprawl breaking CI.** Update every pinned list in the same phase as the distribution entry, and run `build:check` plus the repo tests before moving on.
- **`rg` argument-length limits on large file lists.** Chunk the arguments; the Node fallback produces identical results.
