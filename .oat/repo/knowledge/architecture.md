---
oat_generated: true
oat_generated_at: 2026-06-12
oat_source_head_sha: d008a7e571d90cc6c436c82e176129f62ab54ec4
oat_source_main_merge_base_sha: ed22b463dcdaa466476b0957fea64deb3f663391
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Architecture

**Analysis Date:** 2026-06-12

## Pattern Overview

**Overall:** Multi-skill repository with shared provider adapters and plugin packaging.

**Key Characteristics:**

- CLI-driven Node.js skills (no third-party runtime dependencies)
- Three distinct skills: consensus refinement, session observation, and transcript export
- Canonical transcript-core TypeScript source generated to consuming skills to maintain single source of truth
- Skills packaged as plugins (consensus) or standalone executables (session-observer, export-session-transcript)
- JSONL-based coordination protocol between wrapper and host for parallel orchestration
- Per-runtime transcript adapters (Claude Code, Codex, Cursor) shared across skills

## Layers

**CLI Entry Point Layer:**

- Purpose: Parse user-supplied flags, invoke orchestration logic, handle exit codes
- Location: `skills/session-observer/scripts/session-observer.mjs`, `skills/export-session-transcript/scripts/export-session-transcript.mjs`, `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- Contains: Argument parsing (node:util parseArgs), file I/O, process lifecycle
- Depends on: lib modules (observe, digest, runtimes), Node standard library
- Used by: User invocations via `node <script>` from agent shells

**Orchestration Logic Layer:**

- Purpose: Implement high-level workflows (catch-up, watch, parallel dispatch, deliberation)
- Location: `skills/session-observer/scripts/lib/observe.mjs`, `skills/session-observer/scripts/lib/watch.mjs`, `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Contains: State machines, coordination logic, decision algorithms
- Depends on: Adapter layer (runtimes, digest), state management, subprocess dispatch
- Used by: CLI entry points, watch control handlers

**Adapter Layer:**

- Purpose: Normalize per-provider transcript stores (store locations, record parsing, filtering)
- Location: `src/transcript/core/runtimes.ts` (canonical), `skills/*/scripts/lib/runtimes.mjs` (generated copies)
- Contains: Path discovery, metadata extraction, JSONL record normalization
- Depends on: Node fs/path/os, provider-specific knowledge
- Used by: locate.mjs, observe.mjs, export-session-transcript.mjs, sanitize.mjs

**Renderer and Formatter Layer:**

- Purpose: Transform normalized records into user-visible output (Markdown digest, sanitized transcript)
- Location: `skills/session-observer/scripts/lib/digest.mjs`, `src/transcript/export-session/sanitize.ts` (canonical), `skills/export-session-transcript/scripts/lib/sanitize.mjs` (generated)
- Contains: Markdown generation, content filtering, tool/result truncation
- Depends on: Normalized entries, output formatting logic
- Used by: observe.mjs, export CLI

**State Management Layer:**

- Purpose: Persist and retrieve read offsets, watch metadata, codec caches
- Location: `skills/session-observer/scripts/lib/state.mjs`, `skills/session-observer/scripts/lib/watch-state.mjs`
- Contains: Disk I/O (JSON serialization), conflict-free read-offset tracking
- Depends on: fs/promises, os.homedir()
- Used by: observe.mjs, watch.mjs, session-observer CLI

**Discovery and Ranking Layer:**

- Purpose: Locate candidate transcripts and select the most relevant for a given runtime/cwd pair
- Location: `skills/session-observer/scripts/lib/locate.mjs`, `skills/session-observer/scripts/lib/rank.mjs`, `skills/session-observer/scripts/lib/session-classifier.mjs`
- Contains: Filesystem traversal, candidate scoring, transcript classification
- Depends on: Adapter layer (runtimes), mtime/size inspection, git worktree introspection
- Used by: observe.mjs, CLI runtime resolution

## Data Flow

**Session Observer: Catch-Up Path:**

1. CLI parses `session-observer.mjs catch-up --runtime codex --cwd /project`
2. `resolveAutoRuntime()` enumerates candidates via `discover()` (each runtime in parallel)
3. `rank()` scores candidates by engagement, mtime, cwd exactness
4. `observeCatchUp()` reads state via `state.mjs`, loads transcript via `readRecords()` (from runtimes.mjs)
5. `normalizeEntries()` filters tool calls/results, command messages per runtime-specific rules
6. `buildDigest()` compares prev offset to current record count, prepares delta entries
7. `renderMarkdown()` or `renderJson()` outputs digest
8. `mark-read` flag updates state file with new offset (if provided)

**Session Observer: Watch Path:**

1. CLI parses `session-observer.mjs watch --runtime codex --until-stopped`
2. `watchLoop()` spawns foreground pollers for the selected runtime
3. Poll cycle: `readRecords()` → `normalizeEntries()` → compare offset → emit delta digest
4. Debounce logic (--debounce-sec) coalesces rapid transcript changes before emit
5. `watch-ctl` subcommands (pause/resume/flush/stop) write control directives that watchLoop polls
6. State advances only after digest is consumed (or after --max-pending-sec timeout)

**Export Session Transcript: Sanitization Pipeline:**

1. CLI parses `export-session-transcript.mjs [out] --runtime auto --match <marker>`
2. `discover()` + `encodeCwdVariants()` locate all candidate sessions for cwd
3. Grep cwd candidates for session marker to identify current invocation
4. `readRecords()` loads full transcript JSONL
5. `normalizeEntries()` drops tool calls/results (structural filter)
6. `sanitizeEntries()` removes environment payloads, SKILL.md content, system instructions (content filter)
7. Strip marker line and empty entries
8. `renderMarkdown()` produces annotated Markdown (per-message metadata)
9. Write to --out <path> (or ~/Downloads/<branch-name>.md)

**Consensus Refine: Sequential Deliberation:**

1. CLI parses `consensus-refine.mjs draft.md --goal "Goal" --peers claude,codex --max-rounds 3`
2. Validation: input size <1MB, provider IDs valid, Paseo version in range
3. Parse markdown sections via section-parser, hash input for resume detection
4. For each section:
   - Serialize round N with prompt, section text, peer verdicts from round N-1
   - Invoke `paseo peer chat` with structured prompt (2 peers in parallel)
   - Parse JSONL output from each peer: verdicts, proposed artifacts, concerns
   - Validate verdict schema (required fields, byte limits, concern caps)
   - If divergent verdicts: loop to round N+1 (unless max-rounds reached → impasse)
   - If convergent: accept section, move to next
5. Emit JSONL coordination: status, warnings, parallel-dispatch instructions, artifact paths
6. Write deliberation artifact with section convergence status, all verdict rounds, final text

**Consensus Refine: Parallel Dispatch (Host-Mediated):**

1. `--prepare-parallel` mode: generate manifest with section packets, exit with manifest path in JSONL
2. Host (Claude Code/Codex) receives JSONL, dispatches subagents via native mechanism
3. Each subagent runs `consensus-section-runner.md` task contract: runs `consensus-refine.mjs --run-section` for its packet
4. Host waits for batch completion, fan-in via `--fan-in <manifest>` to collect outputs
5. Wrapper assembles final artifact from section results in original order

**State Management:**

- Session observer offsets stored at `~/.local/state/session-observer/state.json` (per-session tracking by runtime + sessionId)
- Watch state at `~/.local/state/session-observer/watch-state.json` (active watcher metadata)
- Codex cwd cache at `~/.local/state/session-observer/codex-cwd-cache.json` (avoids re-parsing every candidate session)
- Consensus run state in `.consensus/<hash>/` within the project (deliberation records, intermediate artifacts, resume checkpoints)

## Key Abstractions

**Candidate Selection:**

- Purpose: Select the most relevant transcript from multiple runtime sessions for the same cwd
- Examples: `skills/session-observer/scripts/lib/locate.mjs`, `rank.mjs`
- Pattern: Parallel discovery (all runtimes), ranked scoring (engagement, mtime, exactness), state-aware fallback (prior same-cwd session)

**Normalized Transcript Entry:**

- Purpose: Unified record shape across runtime providers (Claude Code/Codex/Cursor)
- Examples: Output of `normalizeEntries()` in runtimes.mjs
- Pattern: Extract relevant fields (role, text, tool calls), drop provider-specific metadata, truncate to limits

**Verdict Schema (Consensus):**

- Purpose: Structured deliberation outcome from each peer (accept/revise/impasse)
- Examples: `VERDICT_BRANCHES` and `VERDICT_CAPS` in `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Pattern: JSON with required fields (schema_version, verdict, reasoning) and byte-capped optional fields (concerns, proposed_artifact)

**Read Offset State:**

- Purpose: Track high-water mark per session to enable delta-only ("catch-up") views
- Examples: `state.mjs` session map: `{ runtime, sessionId, recordedCwd, lastRecordIndex, lastTotalRecords, lastReadAt }`
- Pattern: Load on read, advance only on successful digest emit, persist to JSON

**Transcript-Core Module (Generated):**

- Purpose: Single canonical source for per-runtime adapter logic, distributed as committed copies to consumers
- Examples: `src/transcript/core/runtimes.ts` (canonical), `skills/*/scripts/lib/runtimes.mjs` (consumers)
- Pattern: Banner-stamped generated copies via `scripts/build-generated.mjs`; `scripts/sync-transcript-core.mjs` delegates as a compatibility wrapper; drift verified by `tests/generated-output-sync.test.mjs`

## Entry Points

**Session Observer CLI:**

- Location: `skills/session-observer/scripts/session-observer.mjs`
- Triggers: User invocation `node session-observer.mjs <subcommand> [flags]`
- Responsibilities: Parse args, resolve runtime/cwd, dispatch to observe/watch/state/locate logic, render output, manage exit codes

**Export Transcript CLI:**

- Location: `skills/export-session-transcript/scripts/export-session-transcript.mjs`
- Triggers: User invocation `node export-session-transcript.mjs [out] [flags]`
- Responsibilities: Enumerate candidates, identify session via marker or --session flag, pipeline (read → normalize → sanitize → render), write file

**Consensus Refine CLI:**

- Location: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- Triggers: User invocation `node consensus-refine.mjs <input.md> --goal <goal> [flags]`
- Responsibilities: Validate input/Paseo, parse markdown sections, coordinate deliberation loop (sequential or parallel-prepare), emit JSONL protocol, write artifact

**Consensus Loop Engine:**

- Location: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Triggers: Internal use by consensus-refine.mjs via `runConsensusLoop()`
- Responsibilities: Section iteration, paseo peer invocation, verdict validation, convergence detection, impasse handling

## Error Handling

**Strategy:** Typed exit codes (EXIT_CODES) + JSONL error reporting for orchestration.

**Patterns:**

- Session observer: exit 0 (success), 1 (hard error), 2 (no candidates), 3 (ambiguous runtime, needs user input), 4 (schema mismatch)
- Export transcript: exit 0, 1 (hard error), 2 (no candidates), 3 (ambiguous, needs --match/--session/--all)
- Consensus: EXIT_CODES.USAGE (64), DATA (65), IO (73), SECTION_ERROR (74), NOPERM (77), CONFIG (78), INTERRUPTED (130)
- Consensus JSONL: phase "error", includes error message and optional diagnostics path
- Watch mode: continues polling on transient errors, emits health flags in `watch-ctl status`

**Validation:**

- Consensus input size capped at 1MB
- Verdict byte limits enforced per field (reasoning 16KB, proposed_artifact 256KB, concern 4KB, total 512KB, max 20 concerns)
- Provider IDs validated against `PROVIDER_ID_PATTERN: /^[a-z][a-z0-9-]{0,31}$/`
- Paseo version checked against MIN_PASEO_VERSION (0.1.0) and MAX_TESTED_PASEO_VERSION (0.9.0)

## Cross-Cutting Concerns

**Logging:** Minimal; warnings and diagnostic info emitted via JSONL (consensus) or stderr (session-observer/export); `--debug` flag expands verbosity

**Validation:** Input schema checking (Consensus verdicts, export marker format), transcript record structure validation (per runtime), state file integrity checks

**Runtime Detection:** Per-skill auto-detection of active peer runtime; SESSION_OBSERVER_SELF env var allows CLI to exclude itself when discovering others

**Permissions:** Read-only for transcripts; read/write for state (`~/.local/state/`) and run artifacts (`.consensus/`); consensus needs `node` and `paseo` execution

**Provider Compatibility:** Adapter layer isolates provider differences (store locations, record shapes); skills remain provider-agnostic; marketplace entries map repo to Claude Code, Codex, and (Cursor via --plugin-dir)

---

_Architecture analysis: 2026-06-12_
