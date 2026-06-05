---
oat_status: complete
oat_ready_for: null
oat_last_updated: 2026-06-05
oat_generated: false
oat_template: false
---

# Design: export-session-transcript

## Overview

`export-session-transcript` is a new standalone Agent Skill that exports the
**current** coding-agent conversation to a sanitized Markdown transcript, named
after the current git branch, written by default to `~/Downloads`. It supports
Claude Code, Codex, and Cursor, plus modes for a specific session (`--session`) and
all sessions in a cwd (`--all`), and an optional output path/directory override.

The cross-provider, drift-prone knowledge — where each runtime stores transcripts,
how to parse each record format, and how to filter out everything that isn't a
visible user/assistant message — already exists and is tested in
`session-observer/scripts/lib/runtimes.mjs`. Rather than duplicate it, we extract
`runtimes.mjs` to a **skill-independent canonical module** (`shared/transcript-core/`)
and use a `package.json` sync script to materialize a committed, byte-identical copy
into each consuming skill's `scripts/lib/`. A drift-guard test wired into `npm test`
fails if any vendored copy diverges from the canonical source. This keeps each
installed skill fully self-contained (no cross-skill import) while preserving a
single source of truth. `session-observer` is migrated to consume the synced copy in
the same pass; only `runtimes.mjs` is shared — all observe-specific modules stay put.

Identifying *which* transcript is the live conversation is solved with a **session
marker**: the running agent announces a unique random-hex marker to the user, which is
recorded in the transcript; the export script greps cwd candidates for that marker to
select the current session unambiguously, falling back to newest-for-cwd if the marker
hasn't been flushed yet.

## Architecture

### System Context

```
shared/transcript-core/runtimes.mjs   ← CANONICAL (single source of truth)
        │  scripts/sync-transcript-core.mjs  (copy + banner; --check guards drift)
        ├────────────► skills/session-observer/scripts/lib/runtimes.mjs   (synced)
        └────────────► skills/export-session-transcript/scripts/lib/runtimes.mjs (synced)

skills/export-session-transcript/
  SKILL.md                         user-facing trigger + workflow (announces marker)
  scripts/export-session-transcript.mjs   CLI entry (locate → sanitize → render → write)
  scripts/lib/runtimes.mjs         synced copy (parse/locate primitives + STRUCTURAL filtering)
  scripts/lib/sanitize.mjs         export-owned CONTENT sanitizer (hidden-payload detectors)
  references/transcript-formats.md provider store locations + record shapes
```

**Key Components:**

- **`shared/transcript-core/runtimes.mjs` (canonical):** per-provider primitives —
  `discoverPaths`, `encodeCwd`/`encodeCwdVariants`, `readRecords`, `extractMeta`,
  `normalizeEntries`. **Structural** filtering only: it drops tool calls/results and
  Claude command-message records. It does **not** classify injected instruction/context
  that arrives as ordinary user/assistant **text** (Codex/Cursor text blocks are
  returned as normal messages) — that is the content sanitizer's job, below.
- **`scripts/lib/sanitize.mjs` (export-owned content sanitizer):** the privacy
  boundary. Detects and drops hidden-payload messages that survive structural
  filtering — environment-context wrappers, AGENTS.md/SKILL.md/skill-body payloads,
  system/developer instruction records, subagent notifications, and `turn_aborted`
  markers — across all three runtimes.
- **`scripts/sync-transcript-core.mjs`:** copies canonical → each consumer's
  `scripts/lib/runtimes.mjs` with a generated banner; `--check` mode diffs without
  writing (drift guard).
- **`export-session-transcript.mjs`:** CLI — resolve runtime → locate session(s) for
  cwd → render sanitized Markdown → write to resolved output path.
- **SKILL.md:** triggers, provider notes, and the marker-announce workflow.
- **`session-observer` (migrated consumer):** unchanged behavior; its
  `scripts/lib/runtimes.mjs` becomes a synced copy.

### Data Flow (default: export current session)

```
1. Agent generates a random-hex marker, announces it to the user
   (e.g. "EXPORT_SESSION_MARKER=a3f9c1e0d2b4"), then invokes the CLI with
   --runtime <self> --match <marker>.
2. CLI resolves runtime: --runtime > env hint (SESSION_OBSERVER_SELF-style) > auto.
3. CLI enumerates candidate transcripts for cwd using runtimes primitives:
     - claude-code / cursor: encoded-dir lookup + glob fallback
     - codex: dated-dir glob (lookback) + extractMeta cwd match
4. CLI selects the transcript:
     --session <id>      → that session
     --all               → every cwd session (loop)
     --match <marker>    → the candidate whose raw text contains the marker
     (no match found)    → newest-for-cwd + warning   (flush fallback)
5. CLI parses records → normalizeEntries (STRUCTURAL filter: drops tool
   calls/results + Claude command-messages) → candidate user/assistant messages.
6. CLI applies sanitize.mjs (CONTENT filter: drops env-context, AGENTS.md/SKILL.md
   payloads, system/developer instructions, subagent notifications, turn_aborted) →
   visible msgs only, then strips the marker line and empty entries.
7. CLI resolves output path and writes Markdown (header + ## User / ## Assistant).
```

## Component Design

### shared/transcript-core (canonical) + sync

**Purpose:** Single source of truth for per-provider transcript knowledge; build-time
materialization into each consuming skill.

**Responsibilities:**

- Hold `runtimes.mjs` verbatim (moved from session-observer; leaf module, Node stdlib
  only).
- `sync-transcript-core.mjs`: write `<banner>\n<canonical contents>` to each consumer
  path listed in a CONSUMERS array; `--check` recomputes expected content and diffs
  committed copies, exiting non-zero on mismatch.

**Interfaces:**

```
node scripts/sync-transcript-core.mjs            # write synced copies
node scripts/sync-transcript-core.mjs --check    # verify in-sync (CI/test)

// banner prepended to each synced copy:
// GENERATED — do not edit. Source: shared/transcript-core/runtimes.mjs
// Run: npm run sync:transcript-core
```

**Design Decisions:**

- Banner lives only in the synced copies; canonical is banner-free. The check
  regenerates expected (banner + canonical) and compares — so byte-equality is exact.
- Only `runtimes.mjs` is shared (minimal core). `locate`/`digest`/`rank`/`state`
  remain session-observer-only.

### export-session-transcript.mjs (CLI)

**Purpose:** Locate the target session(s) and write sanitized Markdown.

**Responsibilities:**

- Parse args; resolve runtime (self); locate candidate transcripts for cwd.
- Select session per mode (current via `--match`, `--session`, or `--all`).
- Render header + visible messages; strip the marker; write to resolved path.

**Interfaces (CLI):**

```
node export-session-transcript.mjs [output-path] [flags]

  --runtime <claude-code|codex|cursor|auto>   default: auto (env-hint fallback)
  --match <marker>      grep cwd candidates for this marker (current session)
  --session <id>        export a specific session id (bypasses match)
  --all                 export every session for the cwd (one file each)
  --cwd <path>          project dir to match against (default: process.cwd())
  --out <path>          output file or directory (also accepted positionally)
  --help

Exit codes (mirror session-observer): 0 ok · 1 hard error ·
  2 no candidates · 3 needs user input (ambiguous; no --match/--session)
```

**Output path resolution:**

```
default                       ~/Downloads/<branch>.md           (/ → -)
--out DIR (or positional dir) <DIR>/<branch>.md
--out FILE (file path)        <FILE> verbatim
--all (+ optional DIR)        <DIR>/<branch>-<sessionId>.md per session
not a git repo / detached     <cwd-basename>-<UTCstamp>.md      (fallback name)
```

**Rendered Markdown shape:**

```markdown
# Conversation History: <branch>

Exported: <UTC ISO8601>
Source: <transcript path>
Runtime: <claude-code|codex|cursor>
Note: Only visible user/assistant messages. Tool calls, tool outputs,
developer/system instructions, environment/AGENTS.md/skill payloads, and
subagent notifications are excluded.

## User

<text>

## Assistant

<text>
```

**Design Decisions:**

- **Two-layer sanitization.** `normalizeEntries` is the *structural* layer (drops tool
  calls/results + Claude command-messages) but is **not** the privacy boundary: on
  Codex/Cursor, injected context recorded as ordinary user/assistant text passes
  through. Export therefore owns a second *content* layer (`sanitize.mjs`, below) that
  runs on the normalized entries before rendering. The renderer then drops the
  session-marker line and any empty entries.
- Runtime resolution precedence: `--runtime` > env hint > best-effort auto-detect.
- Marker fallback (newest-for-cwd) guarantees the export never hard-fails on flush
  lag, with a visible warning so the agent can re-run with `--session` if needed.

### sanitize.mjs (export-owned content sanitizer)

**Purpose:** The privacy boundary. Given normalized user/assistant entries, drop any
whose content is an injected/hidden payload rather than a genuine human/agent message.
This closes the gap where `normalizeEntries` returns Codex/Cursor text blocks (and any
text-form system/developer records) verbatim.

**Responsibilities:**

- Classify and drop entries matching hidden-payload patterns, for **all three
  runtimes**, primarily by leading content markers (robust to provider differences):
  - environment-context wrappers — e.g. `<environment_context>…</…>`
  - AGENTS.md / SKILL.md / pasted skill-body payloads — e.g. `# AGENTS.md instructions`,
    skill frontmatter/`<command-message>`-style blocks that survive as text
  - system / developer instruction records (role `system`/`developer`, or text so
    tagged) — never emit regardless of runtime
  - subagent notifications — e.g. `<subagent_notification>…`
  - turn-aborted markers — e.g. `<turn_aborted>`
- Be conservative and **drop-on-match** at the start of a message; prefer false-drops
  of hidden payloads over leaking. Keep the detector table data-driven so new markers
  are cheap to add.
- Operate after structural normalization and before marker-stripping/rendering.

**Interfaces:**

```
// sanitize.mjs
export function sanitizeEntries(entries, { runtime }) → entries   // drops hidden payloads
export const HIDDEN_PAYLOAD_MATCHERS = [ /* { id, test(text, role) } ... */ ]
```

**Design Decisions:**

- Detection is content/role based, not runtime-structural, so one matcher table covers
  Claude/Codex/Cursor; runtime is passed only for the few provider-specific cases.
- Lives in `export-session-transcript/scripts/lib/` (NOT in the shared core) — it is an
  export-specific privacy policy, not shared transcript-format knowledge.

### SKILL.md (workflow)

**Purpose:** Triggers + the marker-announce workflow + provider store-location notes.

**Responsibilities:**

- Document triggers ("export this session transcript", "save conversation as
  markdown", `export-session-transcript`).
- Instruct the agent to: generate a random-hex marker, announce it to the user, then
  invoke the CLI with `--runtime <self> --match <marker>`.
- Document per-provider store locations (Claude `~/.claude/projects/`, Codex
  `~/.codex/sessions/`, Cursor `~/.cursor/projects/.../agent-transcripts/`).
- Document `--session`, `--all`, output overrides, and exit-code handling.

### session-observer migration

**Purpose:** Converge session-observer onto the shared core with zero behavior change.

**Responsibilities:**

- Replace `skills/session-observer/scripts/lib/runtimes.mjs` content with the synced
  copy (banner + canonical). `locate.mjs`/`digest.mjs` keep importing `./runtimes.mjs`
  unchanged.
- Relocate the `runtimes` unit test to `tests/transcript-core/runtimes.test.mjs`
  pointing at canonical; keep session-observer's other tests (they exercise the synced
  copy transitively).

## Error Handling

- **No candidates (exit 2):** print where it looked per provider; suggest `--cwd`.
- **Ambiguous selection (exit 3):** multiple/none matched and no `--match`/`--session`
  — list candidate sessions; instruct re-run with `--session` or a `--match` marker.
- **Marker not found:** warn and fall back to newest-for-cwd (not fatal).
- **Not a git repo / detached HEAD:** use fallback filename; note it in output/stderr.
- **Output dir missing:** create parent dirs; on failure, exit 1 with a clear message.
- **Empty/unreadable transcript:** exit 1 with the path and reason.

## Testing Strategy

**Levels & key scenarios (`node --test`, Node 22+):**

- **Shared core (relocated):** existing `runtimes` unit tests run against
  `shared/transcript-core/runtimes.mjs` — parsing/locate primitives per provider.
- **Drift guard:** a test invokes `sync-transcript-core.mjs --check` (or its compare
  fn) and asserts both vendored copies are byte-in-sync with canonical.
- **session-observer regression:** full existing suite stays green (consumes synced
  copy).
- **Export CLI (new, with fixtures per provider):**
  - session selection: `--match` marker hit; marker miss → newest fallback + warning;
    `--session`; `--all` enumerates every cwd session.
  - **content sanitizer (`sanitize.mjs`), per-runtime fixtures (Claude/Codex/Cursor):**
    each hidden-payload class is recorded as an ordinary user/assistant **text** message
    in a fixture and asserted absent from the export — environment-context wrappers,
    AGENTS.md/SKILL.md/skill-body payloads, system/developer instruction records,
    subagent notifications, and `turn_aborted`. Explicitly covers the Codex/Cursor path
    where `normalizeEntries` would otherwise pass the text through. Negative tests assert
    genuine messages that merely *mention* these tokens mid-text are NOT dropped.
  - sanitization (end-to-end): output contains no tool calls/results, system/developer
    text, environment/AGENTS.md/skill payloads, subagent notifications, or the marker
    line.
  - output-path resolution: default `~/Downloads/<branch>.md`; dir → auto-name; file →
    verbatim; not-in-git fallback name; `--all` naming scheme.
  - exit codes 0/1/2/3 per documented conditions.
- **Repo invariants:** `npm run validate` passes (new SKILL.md frontmatter valid,
  name matches folder, semver version); `repo-layout` updated for `shared/` + new
  skill; reuse `tests/session-observer/fixtures` where applicable.

## Out of Scope (this design)

- Cursor SQLite chat store; watch/live export; runtimes beyond the three (extension
  points noted in the shared core).
