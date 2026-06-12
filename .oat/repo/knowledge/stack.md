---
oat_generated: true
oat_generated_at: 2026-06-12
oat_source_head_sha: d008a7e571d90cc6c436c82e176129f62ab54ec4
oat_source_main_merge_base_sha: ed22b463dcdaa466476b0957fea64deb3f663391
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Technology Stack

**Analysis Date:** 2026-06-12

## Languages

**Primary:**

- JavaScript (ESM) — All runtime scripts and tests
- Markdown — Documentation, skill definitions, artifact storage

## Runtime

**Environment:**

- Node.js 22 or newer (enforced in `package.json` engines field)

**Package Manager:**

- npm
- Lockfile: Not present in repository (dependency-free project — no external npm dependencies)

## Frameworks

**Core:**

- Node.js built-in modules only — Project uses only standard library APIs
  - `node:test` — Test framework (see `tests/` directory)
  - `node:child_process` — Process spawning and subprocess management
  - `node:fs/promises` — Async filesystem operations
  - `node:crypto` — SHA-256 hashing for artifact convergence detection
  - `node:util` — CLI argument parsing (`parseArgs`)
  - `node:path` — Path manipulation
  - `node:os` — System operations (homedir detection)

**Testing:**

- Node.js native `node:test` module — No external test dependencies (see `tests/*.test.mjs`)

**External Tools (shelled out, not npm deps):**

- Paseo CLI (`@getpaseo/cli`) — Optional peer coordination for consensus refinement (installed globally, not vendored)
- Claude CLI (`claude`) — Peer invoked via Paseo
- Codex CLI (`codex`) — Peer invoked via Paseo
- Cursor Agent — Peer invoked via Paseo (detected via environment variables)

## Key Dependencies

**Zero production dependencies:**

- Repository is dependency-free by design (`package.json` has no `dependencies` field)
- All runtime code uses Node.js standard library

**Global development/runtime tools:**

- Paseo CLI (tested against v0.1.0 to v0.9.0, validated at runtime)
- Optional install helper: `node scripts/install-paseo.mjs` prompts for `npm install -g @getpaseo/cli`

## Configuration

**Environment Detection:**

- `CLAUDECODE`, `CLAUDE_CODE`, `CLAUDECODE_SESSION_ID` — Claude Code runtime detection
- `CODEX_*` (any env var prefixed with `CODEX_`) — Codex runtime detection
- `CURSOR_*` (any env var prefixed with `CURSOR_`) — Cursor runtime detection

(See `/Users/tstang/Code/skills/plugins/consensus/skills/refine/scripts/consensus-refine.mjs` for runtime detection logic)

**Configuration Files:**

- `package.json` — Project metadata, scripts, Node.js version requirement
- Plugin manifests (provider-specific):
  - `.claude-plugin/plugin.json` (Claude Code plugin manifest)
  - `.cursor-plugin/plugin.json` (Cursor plugin manifest)
  - `.codex-plugin/plugin.json` (Codex plugin manifest)
- Marketplace manifests:
  - `.claude-plugin/marketplace.json`
  - `.cursor-plugin/marketplace.json`
  - `.agents/plugins/marketplace.json`

**Scripts (development/build):**

- `npm test` — Run test suite via Node.js test runner
- `npm run validate` — Repository structure, manifest, and docs validation (see `scripts/validate.mjs`)
- `npm run smoke` — End-to-end consensus wrapper flow test (see `scripts/smoke-test.mjs`)
- `npm run sync:transcript-core` — Sync canonical transcript-core module to consumer skills

## Platform Requirements

**Development:**

- macOS, Linux, or Windows with Node.js 22+
- Bash/shell for wrapper invocations
- For consensus plugin: Paseo CLI available on `PATH`

**Production:**

- Consensus plugin: Hosted within Claude Code, Codex, or Cursor Agent environments
- Session observer skill: Reads Agent transcript files from local machine (Claude Code, Codex, or Cursor store locations)
- Export session transcript skill: Reads and exports transcripts from local Agent stores

**Local Installation:**

- Git repository → local marketplace registration (not npm published in v0.1):
  - Claude Code: `claude plugin marketplace add "$PWD" --scope user && claude plugin install consensus@skills --scope user`
  - Codex: `codex plugin marketplace add "$PWD" && codex plugin add consensus --marketplace skills`
  - Cursor Agent: `cursor agent --plugin-dir "$PWD/plugins/consensus"` (session-scoped only)

---

_Stack analysis: 2026-06-12_
