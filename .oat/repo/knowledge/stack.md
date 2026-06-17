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

- pnpm for developer dependencies (`packageManager` is pinned in `package.json`)
- Lockfile: `pnpm-lock.yaml`

## Frameworks

**Core:**

- Shipped runtime output uses Node.js built-in modules only
  - `node:child_process` — Process spawning and subprocess management
  - `node:fs/promises` — Async filesystem operations
  - `node:crypto` — SHA-256 hashing for artifact convergence detection
  - `node:util` — CLI argument parsing (`parseArgs`)
  - `node:path` — Path manipulation
  - `node:os` — System operations (homedir detection)
- TypeScript, Vitest, and esbuild are developer tooling only; shipped skills run committed `.mjs` files with no install step

**Testing:**

- Node.js native `node:test` module for remaining `.test.mjs` suites
- Vitest for migrated TypeScript `.test.ts` suites

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

- `pnpm run test` / `npm test` — Run the full Node plus Vitest suite
- `pnpm run validate` / `npm run validate` — Repository structure, manifest, and docs validation (see `scripts/validate.mjs`)
- `pnpm run smoke` / `npm run smoke` — End-to-end consensus wrapper flow test (see `scripts/smoke-test.mjs`)
- `pnpm run build` / `pnpm run build:check` — Generate or verify committed `.mjs` runtime outputs from canonical TypeScript source
- `pnpm run sync:transcript-core` / `npm run sync:transcript-core` — Compatibility wrapper for regenerating transcript-core consumer outputs through `scripts/build-generated.mjs`

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
