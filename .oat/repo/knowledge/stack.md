---
oat_generated: true
oat_generated_at: 2026-06-20
oat_source_head_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_source_main_merge_base_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

<!--
Vendored from: https://github.com/glittercowboy/get-shit-done
License: MIT
Original: agents/gsd-codebase-mapper.md (embedded template)
Modified: 2026-01-27 - Adapted for OAT (added frontmatter)
-->

# Technology Stack

**Analysis Date:** 2026-06-20

## Languages

**Primary:**

- **TypeScript** (6.0.3+) - All canonical source code (`src/`), scripts, and tests
  - Configuration: `tsconfig.json` targets ES2024 with NodeNext module resolution
  - Strict mode enabled (`"strict": true`), no emitted output (`"noEmit": true`)
  - Used for: consensus workflows, transcript adapters, session observer, export utilities

**Secondary:**

- **JavaScript (Node.js native)** - Generated runtime outputs (`.mjs` files committed to `plugins/` and `skills/`)
  - No transpilation required at runtime; shipped as dependency-free `.mjs`
  - Examples: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`, `skills/session-observer/scripts/session-observer.mjs`

## Runtime

**Environment:**

- **Node.js** 22+ (pinned in `package.json` as `"engines": {"node": ">=22"}`)
  - Target: ES2024
  - Module system: ESM (ES Modules), declared in `package.json` as `"type": "module"`
  - No transpilation in shipped skills (see "Repository Conventions" in `CLAUDE.md`)

**Package Manager:**

- **pnpm** 10.13.1+ (pinned in `package.json` as `"packageManager": "pnpm@10.13.1"`)
  - Lockfile: `pnpm-lock.yaml` (committed)
  - Install: `pnpm install`; CI uses `pnpm install --frozen-lockfile`
  - Commands: `pnpm run build`, `pnpm run test`, `pnpm run lint`, `pnpm run format`

## Frameworks

**Core:**

- **Vitest** 4.1.9 - Test runner
  - Configuration: `vitest.config.mjs`
  - Environment: `node`
  - Test files: `tests/**/*.test.ts` and `tests/**/*.test.mts`
  - Test timeout: 10,000 ms default
  - Purpose: Unit and integration tests for skills, plugins, and generated output validation

**Build/Dev Tools:**

- **esbuild** 0.28.1 - Bundle generation for TypeScript → ES2024 JavaScript
  - Used in: `scripts/build-generated.mjs` to transpile canonical TypeScript to `.mjs` runtime outputs
  - Consumed by: `consensus-loop.mjs`, `consensus-refine.mjs`, `consensus-evaluate.mjs`, session-observer CLI and library modules, export-session-transcript CLI

- **TypeScript** 6.0.3 - Type checking and canonical source language
  - Script: `pnpm run type-check` runs `tsc --noEmit`
  - No emitted output; type checking only (actual runtime files are built by esbuild)

- **oxlint** 1.69.0 - JavaScript/TypeScript linter (Rust-based, fast)
  - Configuration: `.oxlintrc.json`
  - Correctness and suspicious rules set to error
  - Pre-commit hook via `lint-staged` on staged files only (see `tools/git-hooks/pre-commit`)
  - Run: `pnpm run lint`; `pnpm run lint:fix` for auto-fixes

- **oxfmt** 0.48.0 - JavaScript/TypeScript formatter (Rust-based)
  - Configuration: `.oxfmtrc.json`
  - Format exclusions: generated `.mjs`, `.agents/`, `.claude/`, etc. (see `.oxfmtrc.json`)
  - Run: `pnpm run format`; check only: `pnpm run format:check`
  - Adoption: incremental (only staged files in CI/pre-commit, not repo-wide yet)

**Linting & Git Workflow:**

- **@commitlint/cli** 21.0.0 + **@commitlint/config-conventional** 21.0.0 - Commit message linting
  - Configuration: `commitlint.config.js` (enforces Conventional Commits)
  - Hook: `tools/git-hooks/commit-msg` (setup via `pnpm prepare`)

- **lint-staged** 17.0.7 - Run linters on staged files
  - Configuration: `.lintstagedrc.mjs`
  - Hook: `tools/git-hooks/pre-commit` (runs linters on staged files only)

## Key Dependencies

**Critical (Shipped with skills):**

- **Node.js standard library only** - All shipped skills (`src/consensus/`, `src/transcript/`) use only Node standard library APIs:
  - `node:fs`, `node:fs/promises` - File I/O
  - `node:path` - Path manipulation
  - `node:child_process` - Subprocess invocation (provider CLI calls)
  - `node:crypto` - Hashing, random UUID generation
  - `node:util` - Utilities (parseArgs, promisify)
  - `node:readline/promises` - Line-by-line reading from streams
  - `node:os` - OS utilities (homedir, tmpdir)
  - `node:events` - Event listeners (once)
  - Rationale: Skills must run with no install step; zero external dependencies at runtime

**Developer/Build (Dev Dependencies):**

- All other dependencies in `devDependencies` are developer tooling only (TypeScript, esbuild, linters, test runner)
- These do not ship with skills; `pnpm install` uses `--frozen-lockfile` in CI to ensure determinism

## Configuration

**Environment:**

- No `.env` files detected in repository; configuration managed via:
  - Process environment variables (`process.env`)
  - Runtime detection based on provider CLI environment (e.g., `CLAUDE_CODE_SESSION_ID`, `CODEX_SESSION_ID`, `CURSOR_TRACE_ID`)
  - State directory: `STATE_DIR` env var (defaults to `~/.local/state/session-observer/`)

- Key environment variables:
  - `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID` - Claude Code detection
  - `CODEX_SESSION_ID`, `CODEX_SANDBOX`, `OPENAI_CODEX_SESSION_ID` - Codex detection
  - `CURSOR_TRACE_ID`, `CURSOR_AGENT`, `CURSOR_SESSION_ID`, `CURSOR` - Cursor detection
  - `STATE_DIR` - State storage for session-observer (defaults to `~/.local/state/session-observer/`)
  - `EXPORT_SESSION_SELF`, `SESSION_OBSERVER_SELF` - Session marker injection
  - `CONSENSUS_RUN_ID`, `CONSENSUS_PARENT_HOST`, `CONSENSUS_DEPTH` - Consensus context

- No runtime configuration files (config.json, config.yaml, etc.) in repo; all configuration is code-driven or environment-based

**Build:**

- Build config files:
  - `tsconfig.json` - TypeScript compiler options (ES2024, NodeNext, strict mode)
  - `vitest.config.mjs` - Test runner configuration
  - `scripts/build-generated.mjs` - Build script for generating `.mjs` from TypeScript
  - `.oxlintrc.json` - Linter configuration
  - `.oxfmtrc.json` - Formatter configuration (via oxfmt tool)
  - `esbuild` configured in-script (no separate config file)

## Platform Requirements

**Development:**

- Node.js 22 or newer
- pnpm 10.13.1 or newer
- Tested on: macOS (darwin), Linux (assumed), Windows (unknown)
- Shell: bash or zsh (see `scripts/worktree/`)

- Optional: Git worktree support for local development
  - `pnpm run worktree:init` - Initialize a new worktree with local files, .oat config, and MCP setup
  - `pnpm run worktree:validate` - Full pre-merge check (clean tree, test, validate, smoke test)

**Consensus Plugin Runtime (only when using consensus skills):**

- Local provider CLIs installed and in PATH: `claude`, `codex`, or `cursor-agent`
- Each provider CLI must be configured with auth credentials (Claude API key, Codex token, Cursor credentials)
- Network access required for provider API calls

**Session Observer & Export Session Transcript Skills (always available):**

- Access to local transcript stores:
  - Claude Code: `~/.clauderc/sessions/` (platform-specific variations)
  - Codex: `~/.codex/sessions/` or `~CODEX_HOME/sessions/` (environment-configurable)
  - Cursor: `~/.cursor/agents/` or `~CURSOR_CONFIG_DIR/agents/`
- Local filesystem write access for:
  - Session observer state: `$STATE_DIR/` (default `~/.local/state/session-observer/`)
  - Export output: `~/Downloads/` (default) or custom path via `--out`

**Production (Skills as shipped):**

- No deployment target defined; skills are embedded in provider agents (Claude Code, Codex, Cursor)
- Runtime: Executes within agent process context, no separate deployment infrastructure
- Distribution: Via provider plugin marketplaces (v0.1 uses local git checkout; published marketplace paths not yet verified)

---

_Stack analysis: 2026-06-20_
