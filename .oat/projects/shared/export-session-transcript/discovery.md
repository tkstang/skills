---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-04
oat_generated: false
---

# Discovery: export-session-transcript

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details.

## Initial Request

Create a skill, `export-session-transcript`, that exports the current coding-agent
session's conversation history to a **sanitized Markdown transcript**, named after
the current git feature branch, written by default to `~/Downloads`. The transcript
must include only visible user and assistant messages and must exclude tool calls,
tool outputs, system/developer instructions, environment-context payloads,
AGENTS.md/skill payloads, and subagent notifications.

The skill must work across **at least Codex, Claude Code, and Cursor**, with
provider-specific variations as needed, and must include identification of where
each provider stores its logs / conversation history. The original Codex-authored
prompt (a jq pipeline over `~/.codex/sessions/.../rollout-*.jsonl`) is the starting
point; the existing `session-observer` skill already encodes the cross-provider
transcript-location and parsing knowledge and is the basis for reuse.

## Clarifying Questions

### Question 1: Which session does the skill export?

**Q:** Current session, a specific session, or all sessions?
**A:** Default is **the session from which the skill is executed** (the current
conversation). Look for sessions in the cwd and **match to the conversation of that
session by content**. Optionally support exporting a specific session and exporting
**all** sessions for a cwd.
**Decision:** Default = current session, identified by content-matching the live
conversation (newest-for-cwd as fallback). Also ship `--session <id>` (specific) and
`--all` (every session for the cwd).

### Question 2: How independent should the skill be from session-observer?

**Q:** Vendor a copy, depend hard on session-observer, or share an engine?
**A:** "If we truly need to repeat this logic, should we not just make the
functionality independent scripts and have a package.json script that copies the
files to each skill that needs its scripts directory." Plus: "I don't think we
should share more than what we need, but I do think we should extract it now."
**Decision:** Extract a **minimal** shared core to a skill-independent canonical
location now; a `package.json` sync script materializes a committed copy into each
consuming skill's `scripts/lib/`; a test-suite drift guard asserts the copies stay
in sync. Migrate `session-observer` to consume the synced copy in the same pass.

### Question 3: Output location and filename

**Q:** Default path and overrides?
**A:** Support an optional output path/name argument.
**Decision:** Default `~/Downloads/<branch>.md` (`/` → `-`). Optional output arg
(`--out` / positional) accepts a **file path** (used verbatim) or a **directory**
(auto-named `<branch>.md` inside). For `--all`, a directory receives one file per
session. Not in a git repo / detached HEAD → fall back to a `<cwd-name>-<UTC>.md`
name so the export never hard-fails.

## Solution Space

### Architecture for cross-provider parse/locate logic

#### Approach 1: Lean self-contained skill _(initial lean)_

Ship a small standalone script that borrows session-observer's format knowledge as
reference but vendors its own minimal parser. Portable, but duplicates format
knowledge across two skills (two update sites on runtime drift).

#### Approach 2: Reuse session-observer engine as a mode / hard dependency

Add an export mode to session-observer or import its engine. DRYest, but couples the
export skill to session-observer at install time; can't stand alone.

#### Approach 3: Canonical shared core + build-time sync into each skill _(Chosen)_

A single, skill-independent canonical module owns the per-provider format/locate/parse
logic. A `package.json` sync script copies a committed, byte-identical copy into each
consuming skill's `scripts/` with a generated-file banner. A drift-guard test
(`--check`) fails CI if a vendored copy diverges. Each installed skill is fully
self-contained (no cross-skill import, no install-order coupling) **and** there is a
single source of truth (no drift).

### Chosen Direction

**Approach:** Canonical shared core + build-time sync (Approach 3), with a
**minimal** core and **extract-now** migration of session-observer.
**Rationale:** Delivers DRY (one place to fix a format change) and portable
standalone skills (each ships its own committed copy). The drift guard makes
"copy the files" safe rather than a latent drift trap. User explicitly chose
extract-now and minimal sharing.
**User validated:** Yes — across the discovery conversation.

## Options Considered

### Option A: What goes in the shared core

**Description:** `session-observer/scripts/lib/runtimes.mjs` is a **leaf module**
(only Node stdlib imports) that exposes the per-provider primitives both skills need:
`discoverPaths`, `encodeCwd`/`encodeCwdVariants`, `readRecords`, `extractMeta`, and
`normalizeEntries` (which already filters tool calls/results and command-payloads by
default — i.e. the sanitization). `locate.mjs` and `digest.mjs` import it via
`./runtimes.mjs`; `rank.mjs` and `state.mjs` are independent and observe-specific.

**Chosen:** Shared core = **`runtimes.mjs` only**. Observe-specific orchestration
(`locate`, `digest`, `rank`, `state`) stays in session-observer. Export builds its
own thin locate-current + renderer on the synced primitives.

**Summary:** Sharing `runtimes.mjs` captures all the drift-prone, format-specific
knowledge while honoring "don't share more than we need." Migration is near-zero
risk: session-observer's `locate`/`digest` keep importing `./runtimes.mjs` unchanged;
that file simply becomes a synced copy of the canonical source.

## Key Decisions

1. **Targeting:** Default exports the current session, identified by content-matching
   the live conversation; newest-for-(runtime, cwd) is the fallback. `--session <id>`
   targets a specific session; `--all` exports every session for the cwd.
2. **Sanitization:** Reuse `normalizeEntries`' default filtering (visible
   user/assistant natural-language messages only; tool calls/results and
   command/skill payloads excluded). Output adds a header (branch, export timestamp,
   source path, sanitization note) and `## User` / `## Assistant` entries.
3. **Architecture:** Single canonical shared core (`runtimes.mjs`) in a
   skill-independent location, synced into each consuming skill by a `package.json`
   script, guarded by a drift-check test. Extract now; migrate session-observer in
   the same pass.
4. **Minimal sharing:** Only `runtimes.mjs` is shared. Observe-only modules stay in
   session-observer; export gets its own thin locate + renderer.
5. **Runtime detection:** The skill exports the runtime it is itself running under
   (self), the inverse of session-observer (peer). Runtime is resolved by explicit
   `--runtime`, environment hints, or auto-detection, defaulting to self.
6. **Output:** Default `~/Downloads/<branch>.md`; optional output arg accepts a file
   path (verbatim) or directory (auto-named); not-in-git fallback name.
7. **Providers:** Claude Code, Codex, Cursor (matches session-observer's coverage).
   Provider store locations documented in the skill.

## Constraints

- Node >= 22, runtime code dependency-free (Node stdlib only) per repo conventions.
- Skills must remain self-contained at install time (committed vendored copy, no
  cross-skill runtime import).
- Must pass `npm test`, `npm run validate`; SKILL.md frontmatter must satisfy
  validate invariants (name/license/compatibility, semver `metadata.version`,
  name matches folder).
- Must never emit hidden developer/system instructions, tokens/auth, environment or
  AGENTS.md/skill payloads, or subagent notifications.
- Keep user-level installs in sync at closeout (`~/.agents/skills/<name>/`, provider
  user skill dirs, `oat sync --scope user`) per repo conventions.

## Success Criteria

- A new `skills/export-session-transcript/` skill exports the **current** session to
  a sanitized Markdown transcript at `~/Downloads/<branch>.md` for Claude Code,
  Codex, and Cursor.
- `--session <id>`, `--all`, `--runtime`, and an output path/dir override work as
  specified.
- Exactly `runtimes.mjs` is extracted to a canonical shared location; a
  `package.json` sync script materializes committed copies into both
  `session-observer` and `export-session-transcript`; a drift-guard test fails on
  divergence.
- `session-observer` is migrated to consume the synced copy with its existing tests
  still green; no behavior change.
- Output excludes tool calls/results, system/developer instructions, environment
  context, AGENTS.md/skill payloads, and subagent notifications (verified).
- `npm test` and `npm run validate` pass; docs/README updated for the new skill and
  the shared-core convention.

## Out of Scope

- Cursor SQLite chat-history store (`~/.cursor/chats/*/store.db`) — agent transcript
  JSONL only (matches session-observer).
- Live/continuous export (watch mode).
- Runtimes beyond Claude Code, Codex, Cursor (e.g. Gemini) — extension point noted
  but not built.

## Deferred Ideas

- Additional runtimes (Gemini CLI, etc.) — the shared core's "adding a runtime"
  extension points make this straightforward later.
- Richer rendering options (e.g. including a compact tool-activity appendix behind a
  flag) — default stays strictly sanitized.

## Open Questions (for design)

- **Content-match mechanics:** How does the running agent identify *its own*
  conversation — does the SKILL.md instruct the agent to pass a distinctive recent
  excerpt (`--match <text>`) that the script greps candidate transcripts for, with
  newest-for-cwd as fallback? (Leaning yes.)
- **Runtime self-detection:** Precise precedence for resolving "self" runtime
  (explicit flag > env hint > auto-detect) and which env signals are reliable per
  provider.
- **Canonical location + sync naming:** Exact path for the canonical core
  (e.g. `shared/transcript-core/`), the sync script name, the vendored target path
  inside each skill, and where the drift-guard test lives.
- **Test relocation:** Whether `runtimes` unit tests move to a canonical
  `tests/transcript-core/` or remain under `tests/session-observer/` pointing at the
  synced copy.
- **`--all` naming scheme:** Filename pattern when exporting multiple sessions
  (e.g. `<branch>-<sessionId>.md` into a directory).

## Assumptions

- `runtimes.mjs`'s default filtering is sufficient sanitization for the export's
  requirements (no tool/command/system/env payloads leak through).
- Each consuming skill is allowed to carry a committed generated copy of the shared
  core (no repo rule against committed generated runtime files).

## Risks

- **Drift between canonical and vendored copies:** _Likelihood: Medium, Impact:
  Medium._ Mitigation: drift-guard `--check` test wired into `npm test`.
- **session-observer regression during migration:** _Likelihood: Low, Impact:
  High._ Mitigation: keep `runtimes.mjs` byte-identical; rely on existing
  session-observer test suite staying green.
- **Wrong-session export under concurrency:** _Likelihood: Low, Impact: Medium._
  Mitigation: content-match the live conversation; confirm/ask on ambiguity.

## Next Steps

Proceed to the design-depth decision: this discovery surfaced real architecture and
component-boundary decisions (shared-core extraction, sync mechanism, drift guard,
new CLI), so a **lightweight design** is recommended before plan generation.
