---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-05-14
oat_generated: false
oat_template: false
---

# Design: session-observer

> Lightweight design produced from the approved spec at `.superpowers/specs/2026-05-14-session-observer-design.md`. That spec is the deeper source of truth (including failure modes, watcher reference design, and digest schema details). This document distills the implementation-ready architecture and component boundaries.

## Overview

`session-observer` is a portable Agent Skill that lets either Claude Code or Codex inspect the other runtime's transcript for the current project, render a tool-free conversation digest, comment on it, and track per-runtime read offsets so follow-ups (`check again`) surface only new content. The skill lives at `.agents/skills/session-observer/` and is installed at the user level (not vault-local, not project-bound), so it works wherever both runtimes are used.

The architecture is a thin SKILL.md routing layer plus a small Node CLI (`scripts/session-observer.mjs`) backed by five focused library modules under `scripts/lib/`. Each module has one job: parse a runtime's records (`runtimes.mjs`), discover candidate transcripts for a cwd (`locate.mjs`), rank them deterministically (`rank.mjs`), build and render a filtered digest (`digest.mjs`), and persist per-session read offsets atomically (`state.mjs`). Three working modes ship in v1 — `review`, `catch-up`, `locate` — plus a `state` management subcommand. A fourth mode (`watch`) is fully designed in `references/watch-design.md` but intentionally not implemented in v1.

The implementation borrows record-parsing patterns from Stoa's transcript adapters (`apps/server/src/client/adapters/{claude-code,codex}.ts`) and the atomic state-write protocol from Stoa's `session-capture.sh.tpl`, but the skill has zero Stoa runtime dependency: it works on a machine that has never installed Stoa. All writes are confined to `~/.local/state/session-observer/`; transcripts and peer sessions are read-only.

## Architecture

### System Context

`session-observer` sits beside the user's coding agents (Claude Code and Codex), not inside either of them. Both runtimes already write JSONL transcripts to well-known locations on disk (`~/.claude/projects/<encoded-cwd>/*.jsonl` and `~/.codex/sessions/**/*.jsonl`). The skill reads those transcripts, computes a normalized digest, and prints it to the invoking agent. Bidirectionality is structural — there is no special "I am Claude Code" or "I am Codex" mode; the runtime selector (`--runtime <claude-code|codex|auto>`) chooses which store to read.

**Key Components:**

- **SKILL.md** — Agent-facing markdown that maps natural-language triggers (`check Codex`, `check again`, `what do you think of what was just said?`) to CLI subcommands. Asks the user to disambiguate mode, runtime, or candidate selection when arguments are missing.
- **`scripts/session-observer.mjs`** — CLI entrypoint. Argv parsing, subcommand dispatch, output formatting (markdown vs JSON), exit-code semantics.
- **`scripts/lib/runtimes.mjs`** — Per-runtime record normalization. The only file with structural knowledge of Claude Code vs Codex JSONL.
- **`scripts/lib/locate.mjs`** — Candidate transcript discovery for a target cwd; sister-git-worktree enumeration for Tier-C widening.
- **`scripts/lib/rank.mjs`** — Tier-based deterministic ranking (exact-cwd > descendant-cwd > no match).
- **`scripts/lib/digest.mjs`** — Entry extraction, filtering (tool-call / tool-result inclusion rules), markdown rendering.
- **`scripts/lib/state.mjs`** — XDG state I/O with file-lock + atomic temp+rename. Tracks `(runtime, sessionId) → { lastRecordIndex, ... }` high-water marks.
- **`scripts/probe-local.mjs`** — Opt-in helper for manual verification against real local transcripts.
- **`references/watch-design.md`** — Frozen design for the v2 continuous watcher.
- **`references/transcript-formats.md`** — Reference: Claude Code vs Codex JSONL record shapes.

### Component Diagram

```
                    ┌──────────────────────────────┐
                    │           SKILL.md           │
                    │  (trigger → CLI dispatch,    │
                    │   ask user when ambiguous)   │
                    └──────────────┬───────────────┘
                                   │ Bash
                                   ▼
            ┌──────────────────────────────────────────────┐
            │     scripts/session-observer.mjs             │
            │   argv parse → subcommand dispatch →         │
            │   markdown/JSON output → exit code           │
            └──┬──────────┬──────────┬──────────┬──────────┘
               │          │          │          │
               ▼          ▼          ▼          ▼
        ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐
        │ locate   │ │ rank     │ │ digest │ │ state  │
        │  .mjs    │ │  .mjs    │ │  .mjs  │ │  .mjs  │
        └────┬─────┘ └──────────┘ └───┬────┘ └───┬────┘
             │                        │          │
             ▼                        ▼          ▼
        ┌──────────┐              ┌──────────────────────┐
        │ runtimes │              │  ~/.local/state/     │
        │  .mjs    │              │  session-observer/   │
        │ (Claude  │              │   state.json         │
        │  + Codex │              │   codex-cwd-cache    │
        │  adapters│              └──────────────────────┘
        └────┬─────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │  ~/.claude/projects/**/*.jsonl       │ (read-only)
    │  ~/.codex/sessions/**/*.jsonl        │ (read-only)
    └──────────────────────────────────────┘
```

### Data Flow

End-to-end `catch-up` invocation:

```
1. SKILL.md   : "check again" → spawnSync('node', ['scripts/session-observer.mjs', 'catch-up'])
2. CLI        : parse argv → resolve runtime ('auto' → other-runtime via env hint / tier fallback)
3. locate.mjs : discover candidates under ~/.claude/projects or ~/.codex/sessions
                → for each: stat mtime + extractMeta(sessionId, recordedCwd)
4. rank.mjs   : tier each (A=exact-cwd, B=descendant, no match=widen ask)
                → keep top tier, sort mtime DESC, detect ties
5. CLI        : if noMatch → emit {sisters, globalRecent}, exit 2 (SKILL.md asks user)
                if ties     → emit {ties}, exit 3            (SKILL.md asks user)
                else        → continue with winner
6. state.mjs  : getSession(winner.runtime, winner.sessionId) → prior offset (or null)
7. digest.mjs : buildDigest(transcriptPath, { fromIndex, includeToolCalls, ... })
                → renderMarkdown(digest)
8. state.mjs  : mutate(state => markRead(...)) — atomic temp+rename under lock
9. CLI        : print markdown digest, exit 0
```

`review` is identical except step 6 sets `fromIndex = 0` and step 8 is skipped unless `--mark-read` is passed. `locate` short-circuits after step 4 and emits the ranked candidate list as JSON. `state` subcommands skip steps 3–7 entirely.

## Component Design

### `scripts/session-observer.mjs` (CLI)

**Purpose:** Single entrypoint; orchestrates subcommands; owns argv parsing and exit codes.

**Responsibilities:**

- Parse argv into `{ subcommand, runtime, cwd, includeTools, includeToolResults, maxTurns, maxBytes, json, ... }`.
- Dispatch to subcommand handlers: `review`, `catch-up`, `locate`, `state`.
- Resolve `--runtime auto` per the rules in the spec (env var hint → tier-population fallback → exit 3 with `ambiguousRuntime`).
- Format output (markdown by default, JSON with `--json`).
- Map errors to exit codes: 0 success / 1 hard error / 2 no candidates / 3 needs user input / 4 schema mismatch.

**Interfaces:**

```javascript
async function main(argv) {
  const args = parseArgs(argv);            // node:util parseArgs
  switch (args.subcommand) {
    case 'review':   return runReview(args);
    case 'catch-up': return runCatchUp(args);
    case 'locate':   return runLocate(args);
    case 'state':    return runState(args);
    default:         exitWithUsage(1);
  }
}
```

**Dependencies:**

- `scripts/lib/locate.mjs`, `rank.mjs`, `digest.mjs`, `state.mjs`
- `node:util` for `parseArgs`
- `node:process` for argv + exit codes

**Design Decisions:**

- CLI uses `node:util parseArgs` (Node 22 stdlib) — no third-party arg parser, matches the repo's stdlib-only constraint.
- Exit codes are part of the contract (SKILL.md branches on them to drive the ask flow). They are not redefined per-subcommand.

### `scripts/lib/runtimes.mjs`

**Purpose:** Encapsulate everything that differs between Claude Code and Codex JSONL transcripts.

**Responsibilities:**

- Resolve discovery roots per runtime.
- Encode/decode the project cwd (Claude Code dir-name encoding; Codex has no path encoding).
- Read JSONL files tolerantly (partial trailing line, malformed mid-file lines).
- Extract `(sessionId, recordedCwd)` metadata from first records.
- Normalize raw records into `DigestEntry[]` honoring the tool-inclusion flags.

**Interfaces:**

```javascript
export function discoverPaths(runtime);             // ['/Users/.../.claude/projects/'] | ['/Users/.../.codex/sessions/']
export function encodeCwd(runtime, cwd);            // claude-code: '/Users/x/Code/y' → '-Users-x-Code-y'; codex: null
export async function extractMeta(runtime, transcriptPath);  // { sessionId, recordedCwd } | null
export async function readRecords(transcriptPath);           // JsonObject[] with tolerant parse
export function normalizeEntries(runtime, records, opts);    // DigestEntry[]
```

**Dependencies:**

- `node:fs/promises` for file I/O
- `node:path` for path utilities

**Design Decisions:**

- Adapter logic is ported from Stoa's `claude-code.ts` and `codex.ts` adapters — both have shipped against real transcripts and handle the structural quirks (Codex `payload.type === 'message'` vs `function_call`; Claude `tool_use` vs `tool_result` blocks; multiple shapes of session-id placement).
- A small in-memory + on-disk cache (`~/.local/state/session-observer/codex-cwd-cache.json`) keyed by `(path, mtime)` avoids re-parsing Codex transcripts for cwd extraction on every poll/check.
- Tool-call args truncated at 200 chars; tool-result body at 500 chars (matches Stoa).

### `scripts/lib/locate.mjs`

**Purpose:** Discover candidate transcript files for a given `(runtime, cwd)` and enumerate sister git worktrees when widening is needed.

**Responsibilities:**

- Claude Code: encode cwd → direct dir lookup under `~/.claude/projects/<encoded>/*.jsonl`; fall back to `projects/*/*.jsonl` glob if the encoded dir is missing.
- Codex: glob `~/.codex/sessions/**/*.jsonl` filtered to mtime within `LOOKBACK_DAYS = 7`.
- For each candidate, stat mtime/size and call `extractMeta` to populate `(sessionId, recordedCwd)`.
- Enumerate sister git worktrees via `git worktree list --porcelain`.

**Interfaces:**

```javascript
export async function discover(runtime, targetCwd);  // Candidate[]
export async function gitWorktrees(cwd);             // string[] (worktree paths); [] on failure
```

**Dependencies:**

- `runtimes.mjs` for `discoverPaths`, `encodeCwd`, `extractMeta`
- `node:fs/promises` (`readdir`, `stat`)
- `node:child_process` (`execFile`) for `git worktree list`

**Design Decisions:**

- `LOOKBACK_DAYS = 7` for Codex bounds the glob to a reasonable horizon. Configurable via flag if needed later.
- `gitWorktrees` swallows errors (not a git repo, git not on `$PATH`) and returns `[]` so the rank layer can transparently drop the sister-worktree option from the widening ask.

### `scripts/lib/rank.mjs`

**Purpose:** Deterministically pick the best candidate for the target cwd, or report no-match with widening options.

**Responsibilities:**

- Tier each candidate (A=exact-cwd, B=descendant-cwd, C=no match).
- Within the top non-empty tier, sort by mtime DESC and return the winner plus fallbacks.
- Detect ties (multiple candidates within `TIE_WINDOW_SEC = 5s` mtime distance of the winner).
- On no match, populate `sisters` (from `gitWorktrees`) and `globalRecent` (top-5 by mtime across all candidates).
- Set `active: true` flag on the winner if `ageSec < ACTIVE_THRESHOLD_SEC = 60`.

**Interfaces:**

```javascript
export function rank(candidates, targetCwd, { tieWindowSec = 5 });
// → { winner, tier, ties, fallbacks } | { winner: null, noMatch: true, sisters, globalRecent }
```

**Design Decisions:**

- **Tiered (lexicographic) ranking** instead of a weighted score. More predictable, easier to test, no magic constants beyond the tie window and active threshold.
- **No auto-fall-through on no-match.** The CLI emits `noMatch` with options and exits 3; the SKILL.md does the asking. This is a binding decision from the brainstorm.

### `scripts/lib/digest.mjs`

**Purpose:** Build the normalized digest and render it as markdown (default) or JSON.

**Responsibilities:**

- Read records via `runtimes.readRecords`, normalize via `runtimes.normalizeEntries`.
- Slice entries by `range.fromIndex` (review = 0; catch-up = prior offset).
- Apply `--max-turns` / `--max-bytes` (tail-slice) for `review`.
- Render markdown header + grouped `### User` / `### Assistant` blocks.
- Render JSON with `schemaVersion: 1` and the full schema from the spec.
- Prepend a 20K-char warning header when output is large.

**Interfaces:**

```javascript
export async function buildDigest(runtime, transcriptPath, opts);  // Digest
export function renderMarkdown(digest);                            // string
export function renderJson(digest);                                // string
```

**Design Decisions:**

- **Tool calls and tool results excluded by default.** `--include-tools` adds tool-call markers; `--debug` adds both.
- Consecutive same-role entries grouped under a single header — matches Stoa's adapter output shape so the rendering primitive can be ported directly.
- Header includes `filters: tool calls excluded · tool results excluded` line so the reader always knows what was stripped.

### `scripts/lib/state.mjs`

**Purpose:** Atomic, lock-protected persistence of per-session read offsets at `~/.local/state/session-observer/state.json`.

**Responsibilities:**

- `mkdir -p` the state dir on first write.
- Acquire `state.json.lock` exclusively (`open(..., 'wx')` with retry).
- Read current state (treat missing/invalid as empty + back up corrupt files to `state.json.corrupt-<ts>.bak`).
- Apply mutation, write to `state.json.<pid>.tmp`, `fsync`, `rename` over `state.json`.
- Release lock in `finally`.
- Detect schema-version mismatches and write `.bak` before upgrading.

**Interfaces:**

```javascript
export async function load();
export async function mutate(fn);                                    // fn: state => state
export async function getSession(runtime, sessionId);
export async function markRead(runtime, sessionId, fields);
export async function resetByRuntime(runtime);                       // returns count reset
export async function resetBySession(runtime, sessionId);
export async function clear();
```

**Design Decisions:**

- **Single write path through `mutate`.** Eliminates "two writers stomped each other" by construction.
- **Keyed by `${runtime}:${sessionId}`.** `sessionId` is the most stable identifier; survives mid-session cwd moves and transcript-path rotation.
- **Lock + atomic-rename pattern lifted from Stoa's `session-capture.sh.tpl`** which has shipped against concurrent hooks + sweeper writers.
- `watchedByPid` field reserved for v2 watcher; v1 sets it null. `catch-up` will warn-not-refuse if it sees a non-null value (future-proof, no v1 logic required).

## Data Models

### `Candidate` (transient, returned by `locate.discover`)

```typescript
interface Candidate {
  runtime: 'claude-code' | 'codex';
  transcriptPath: string;     // absolute
  sessionId: string;          // from first record with an ID; falls back to basename
  recordedCwd: string | null; // null when undeterminable (Codex edge case)
  mtime: number;              // epoch seconds
  size: number;               // bytes
  ageSec: number;             // now - mtime
}
```

### `DigestEntry` (transient, internal to `digest`/`runtimes`)

```typescript
interface DigestEntry {
  role: 'user' | 'assistant';
  text: string;
  recordIndex: number;
  kind: 'message' | 'tool_call' | 'tool_result';
  toolName?: string;
}
```

### `Digest` (CLI output, `schemaVersion: 1`)

```typescript
interface Digest {
  schemaVersion: 1;
  runtime: 'claude-code' | 'codex';
  sessionId: string;
  transcriptPath: string;
  recordedCwd: string;
  matchedTier: 'A' | 'B';
  widenedFrom: string | null;
  active: boolean;
  mode: 'review' | 'catch-up' | 'locate';
  range: {
    fromIndex: number;
    toIndex: number;
    totalRecords: number;
    newRecords?: number;        // catch-up only
  };
  entries: DigestEntry[];
  filters: { includeToolCalls: boolean; includeToolResults: boolean };
  warnings: string[];
  fallbacks: Array<{ runtime: string; sessionId: string; transcriptPath: string; ageSec: number }>;
}
```

### `State` (persisted at `~/.local/state/session-observer/state.json`)

```typescript
interface State {
  schemaVersion: 1;
  sessions: Record<string, SessionState>;  // key: `${runtime}:${sessionId}`
}

interface SessionState {
  runtime: 'claude-code' | 'codex';
  sessionId: string;
  lastRecordIndex: number;
  lastTotalRecords: number;
  lastReadAt: string;                      // ISO 8601
  transcriptPath: string;
  recordedCwd: string;
  watchedByPid: number | null;             // reserved for v2 watcher; v1 = null
}
```

**Validation Rules:**

- `lastRecordIndex >= 0`
- `lastTotalRecords >= lastRecordIndex`
- `runtime` ∈ `{ 'claude-code', 'codex' }`
- If `lastTotalRecords` in the live transcript shrinks below the stored value, reset `lastRecordIndex` to 0 and emit a warning (transcript was rewritten).

**Storage:**

- **Location:** `~/.local/state/session-observer/state.json` (XDG state).
- **Persistence:** Atomic temp+rename under exclusive-create lock. Single writer per process.

## Error Handling

Error categories map directly to exit codes; see the spec's failure-mode table (Section 8) for the full matrix. Summary:

- **User-recoverable (exit 2):** no candidates for runtime; no candidates in cwd (Tier C). Emit `{ noCandidates | noMatch, sisters, globalRecent }` so the SKILL.md asks how to widen.
- **User-disambiguation (exit 3):** ties within the winning tier; ambiguous runtime when `--runtime auto` finds candidates in both stores. Emit options so the SKILL.md asks which.
- **Hard errors (exit 1):** transcript unreadable (`EACCES`, `ENOENT`); state lock exhausted; unexpected exception.
- **Recoverable warnings (exit 0):** malformed JSONL line mid-file (skip + warn); partial trailing line (drop + warn); transcript shrank (reset offset + warn); corrupt state file (back up + treat as empty); schema mismatch (auto-migrate + backup).

**Retry Logic:** None at the CLI level. Single-shot reads. Lock retries are bounded (100× 50ms inside `state.mutate`).

**Logging:** The CLI writes only to stdout/stderr. No log files, no `console.debug`. Warnings travel inside the `Digest.warnings` array (machine-readable) and are surfaced in the markdown header.

## Testing Strategy

Tests live at top-level `tests/session-observer/**/*.test.mjs`. `npm test` (already wired to `node --test`) discovers them automatically — no script changes, no new dependencies.

### Unit Tests

- **Scope:** Each `scripts/lib/*.mjs` module gets a paired `tests/session-observer/<module>.test.mjs`.
- **Coverage Target:** All branches exercised by the design (no numerical coverage gate; targeted assertions instead).
- **Key Test Cases:**
  - `runtimes.test.mjs`: parse typical + malformed + partial-tail fixtures; default filter drops tool_call + tool_result; `--include-tools` produces `[Tool] args` truncated to 200; `--debug` produces results truncated to 500; `extractMeta` returns expected `(sessionId, recordedCwd)` per runtime.
  - `rank.test.mjs`: Tier A > B > noMatch; ties within window; mtime DESC within tier; `active: true` when `ageSec < 60`; `noMatch` populates `sisters` (mocked) and `globalRecent`.
  - `state.test.mjs`: temp `STATE_DIR` per test; `mutate` creates `state.json`; atomic temp+rename leaves no lingering `.tmp` on success; two parallel `mutate` calls serialize correctly; `markRead` updates offsets; `resetByRuntime` / `resetBySession` / `clear` behave; migration writes `.bak`.
  - `locate.test.mjs`: claude-code encoded-dir direct lookup; full-projects fallback when encoded dir is missing; codex `LOOKBACK_DAYS` filter; cwd cache hit on unchanged file; `gitWorktrees` parses `--porcelain` output; `[]` when git exec fails.
  - `digest.test.mjs`: `buildDigest` with fromIndex 0 / N; `renderMarkdown` grouping; header includes filter line + active flag + range; 20K warning prepended over threshold; `--max-turns` slices from tail.
  - `cli.test.mjs`: argv dispatch; exit codes 0/2/3; `--json` validates as JSON; runtime auto-resolution prefers populated runtime; exits 3 with `ambiguousRuntime` otherwise.

### Integration Tests

- **Scope:** `integration.test.mjs` builds a temp `HOME/.claude/projects/<encoded-cwd>/typical.jsonl`, sets `STATE_DIR=<tmp>` `HOME=<tmp>`, and spawns the real CLI via `spawnSync('node', ['scripts/session-observer.mjs', ...])`.
- **Test Environment:** Per-test temp dirs; no global state. Tests are parallel-safe.
- **Key Test Cases:**
  - End-to-end `review` against synthetic fixtures: header populated, both role sections rendered, no tool noise.
  - `catch-up` twice in a row: first emits delta; second reports "no new records."
  - `state reset` rewinds offset; subsequent `catch-up` re-emits full content.

### End-to-End Tests

- **Scope:** Manual verification via `scripts/probe-local.mjs --runtime <r> --cwd "$PWD"` against the user's real local transcript stores.
- **Test Scenarios:**
  - Run on a project where both Claude and Codex have recent sessions; verify the right runtime's session is picked.
  - Run on a fresh project with no sessions; verify the noMatch/widening ask is triggered.
  - Run after a `cd subdir` within an existing session; verify Tier-B descendant match works.

## Open Questions

None at design time. Any deviations during implementation will be captured in `implementation.md` and reconciled via plan deltas.

## Implementation Phases

> Detailed phases and tasks live in `plan.md`. High-level shape:

### Phase 1: Skill scaffolding + state

**Goal:** Skeleton SKILL.md + working `state.mjs` with passing tests.

### Phase 2: Runtime parsing

**Goal:** `runtimes.mjs` parses both Claude Code and Codex fixtures; tests pass.

### Phase 3: Discovery + ranking

**Goal:** `locate.mjs` + `rank.mjs` deliver deterministic candidate selection; tests pass.

### Phase 4: Digest + CLI

**Goal:** `digest.mjs` + `session-observer.mjs` + `probe-local.mjs`; CLI + integration tests pass.

### Phase 5: Documentation

**Goal:** Full SKILL.md body + `references/watch-design.md` + `references/transcript-formats.md`.

### Phase 6: Validation

**Goal:** `npm test` + `npm run validate` pass; manual probe verified.

**Verification:** `npm test && npm run validate` plus the manual `scripts/probe-local.mjs` check.

## References

- Source-of-truth spec: `.superpowers/specs/2026-05-14-session-observer-design.md`
- Discovery: `.oat/projects/shared/session-observer/discovery.md`
- Implementation reference (read-only): `/Users/thomas.stang/Code/stoa/apps/server/src/client/adapters/{claude-code,codex}.ts`
- Implementation reference (read-only): `/Users/thomas.stang/Code/stoa/apps/server/src/client/templates/claude-code-stoa-session-capture.sh.tpl`
- Skill authoring convention: `/Users/thomas.stang/Code/stoa/.agents/skills/create-agnostic-skill/SKILL.md`
