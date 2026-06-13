---
oat_generated: true
oat_generated_at: 2026-06-12
oat_source_head_sha: d008a7e571d90cc6c436c82e176129f62ab54ec4
oat_source_main_merge_base_sha: ed22b463dcdaa466476b0957fea64deb3f663391
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# External Integrations

**Analysis Date:** 2026-06-12

## APIs & External Services

**AI Peer Coordination (Paseo):**

- Paseo CLI (`@getpaseo/cli`) — Peer orchestration and JSON-over-stdout dialogue coordination
  - Invocation: Child process spawn via `node:child_process`
  - Purpose: Consensus refinement via two-peer deliberation (consensus plugin)
  - Config: Paseo CLI configured separately with peer CLIs (`claude`, `codex`)
  - (See `/Users/tstang/Code/skills/plugins/consensus/skills/refine/scripts/consensus-refine.mjs`)

**Agent Runtime Environments:**

- Claude Code (Claude) — AI agent runtime; invoked as peer via Paseo
- Codex (Codex) — AI agent runtime; invoked as peer via Paseo
- Cursor Agent (Cursor) — AI agent runtime; invoked as peer via Paseo
- Detected via environment variables: `CLAUDECODE`, `CODEX_*`, `CURSOR_*`

## Data Storage

**Databases:**

- Not applicable — No database integration

**File Storage:**

- Local filesystem only
- Transcript stores (read-only):
  - Claude Code store location (runtime-detected)
  - Codex store location (runtime-detected)
  - Cursor store location (runtime-detected)
- Deliberation artifacts: Written as local markdown files
- Default output directory: `~/Downloads` (for export-session-transcript skill)

**Caching:**

- Not applicable — No caching layer

## Authentication & Identity

**Auth Provider:**

- Not applicable — No remote auth provider
- Runtime environment detection (no credentials required)

**Session Identification:**

- Session marker: Random hex marker announced to user, grepped from transcripts to identify current session (export-session-transcript skill)
- (See `/Users/tstang/Code/skills/skills/export-session-transcript/scripts/export-session-transcript.mjs` for marker logic)

## Monitoring & Observability

**Error Tracking:**

- Not applicable — No remote error tracking service

**Logs:**

- Structured JSON Lines (JSONL) coordination output on stdout
- JSONL format includes: status updates, warnings, artifact paths, section states, verdict records
- Stderr: Terminal diagnostics only (not part of coordination protocol)
- (See `/Users/tstang/Code/skills/plugins/consensus/skills/refine/SKILL.md` for JSONL protocol)

**Debug/Diagnostic Output:**

- Optional `--debug` flag for session-observer skill
- Event logs via `--event-log` flag for watch mode
- Diagnostics path reporting for corrupt section state

## CI/CD & Deployment

**Hosting:**

- Not applicable (distributed as Agent Skills and plugins within Claude Code, Codex, Cursor)

**CI Pipeline:**

- GitHub Actions (`.github/workflows/` directory exists but not analyzed in detail)
- Local validation: `npm test`, `npm run validate`, `npm run smoke`

## Environment Configuration

**Required env vars:**

- None for basic operation
- Optional (runtime auto-detection):
  - `CLAUDECODE`, `CLAUDE_CODE`, `CLAUDECODE_SESSION_ID` — Claude Code detection hint
  - `CODEX_*` (any var prefixed with `CODEX_`) — Codex detection hint
  - `CURSOR_*` (any var prefixed with `CURSOR_`) — Cursor detection hint

**Optional env vars:**

- `CONSENSUS_SMOKE_EXPECT_STATUS` — Smoke test expected status (for testing)

**Secrets location:**

- Not applicable — No secrets required for core operation

## Webhooks & Callbacks

**Incoming:**

- Not applicable

**Outgoing:**

- Not applicable

## Subprocess Invocations

**Paseo CLI Subprocess:**

- Invoked via `spawn()` from `/Users/tstang/Code/skills/plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Receives JSONL-serialized peer instructions on stdin
- Emits JSON verdict records on stdout (one per line)
- Exit code handling for peer unavailability, invalid JSON, and Paseo errors

**Version Validation:**

- Paseo version checked at runtime; validated against tested range v0.1.0 to v0.9.0
- Warning emitted if outside tested range (does not block execution)
- (See `/Users/tstang/Code/skills/plugins/consensus/skills/refine/scripts/consensus-refine.mjs` for version check)

**Node.js Version Check:**

- Enforced at runtime: Node.js 22 or newer required
- Validation in consensus plugin preflight

## Transcript Integration

**Provider-Specific Transcript Formats:**

- Claude Code transcript store format (JSONL per session)
- Codex transcript store format (JSONL per session)
- Cursor Agent transcript store format (JSONL per session)
- Canonical knowledge: `shared/transcript-core/runtimes.mjs` (single source of truth)
- Synced copies: `skills/session-observer/scripts/lib/runtimes.mjs`, `skills/export-session-transcript/scripts/lib/runtimes.mjs`
- (See `skills/session-observer/references/transcript-formats.md` and `skills/export-session-transcript/references/transcript-formats.md`)

---

_Integration audit: 2026-06-12_
