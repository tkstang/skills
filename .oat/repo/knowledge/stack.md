---
oat_generated: true
oat_generated_at: 2026-07-11
oat_source_head_sha: 0e25a36d3958a1e09c7bedaddd6d3498dc0905d7
oat_source_main_merge_base_sha: 17043d653233fb906e018f5872359d99eb556208
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Technology Stack

**Analysis Date:** 2026-07-11

## Languages

**Primary:**

- TypeScript 6.0.3 (root) / 5.8.3 (documentation) - Core source code in `src/`, tests in `tests/`, scripts in `scripts/`
- JavaScript (Node.js ESM) - Generated runtime outputs (`.mjs` files under `skills/*/scripts/`, `plugins/consensus/scripts/`)

**Secondary:**

- Bash - Git hooks and worktree utilities (`tools/git-hooks/`, `scripts/worktree/`)

## Runtime

**Environment:**

- Node.js >= 22 (enforced via `package.json` engines field)

**Package Manager:**

- pnpm >= 10.13.1 (pinned in `package.json` packageManager field)
- Lockfile: `pnpm-lock.yaml` (committed)

## Frameworks

**Core:**

- TypeScript - Type checking and source language (`tsconfig.json` targeting ES2024)

**Testing:**

- Vitest 4.1.9 - Test framework and runner (`vitest.config.mjs`, test files under `tests/`)

**Build/Dev:**

- esbuild 0.28.1 - Build tool for generated outputs (configured in `scripts/build-generated.mjs`)
- oxlint 1.69.0 - Linting (`.oxlintrc.json`)
- oxfmt 0.48.0 (root) / 0.36.0 (docs) - Formatting (`.oxfmtrc.json`)

**Documentation:**

- Next.js 16.1.6 - Documentation site framework (`documentation/next.config.js`, `documentation/package.json`)
- React 19.1.0 - UI framework for docs
- Fumadocs 16.6.13 (fumadocs-core, fumadocs-mdx, fumadocs-ui) - Documentation site theme and MDX support
- Tailwind CSS 4.2.1 - CSS framework for docs styling

## Key Dependencies

**Critical:**

- @open-agent-toolkit/docs-config 0.1.27 - Documentation configuration (docs)
- @open-agent-toolkit/docs-theme 0.1.27 - Documentation theme (docs)
- @open-agent-toolkit/docs-transforms 0.1.27 - Documentation transforms (docs)
- @commitlint/cli 21.0.0 - Commit message linting
- @commitlint/config-conventional 21.0.0 - Conventional commit configuration
- lint-staged 17.0.7 - Git hook integration for linting

**Infrastructure:**

- @types/node 22.19.21 (root) / 22.10.0 (docs) - Node.js type definitions
- @types/react 19.1.0 (docs) - React type definitions
- @types/react-dom 19.1.0 (docs) - React DOM type definitions

## Configuration

**Environment:**

- Configured via environment variables (`process.env` usage in `src/consensus/provider-cli/runtime-policy.ts`, `src/consensus/config/consensus-config.ts`)
- Key env vars (see integrations.md): `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `OPENAI_API_KEY`, `CURSOR_API_KEY`
- File-based config: `.consensus/` directory (XDG_CONFIG_HOME or HOME based, `src/consensus/config/consensus-config.ts`)

**Build:**

- TypeScript config: `tsconfig.json` (ES2024 target, strict mode)
- Test config: `vitest.config.mjs` (30s timeout for integration tests)
- Build config: `scripts/build-generated.mjs` (generates `.mjs` outputs from TypeScript source)
- Linting: `.oxlintrc.json` (excludes generated files, OAT-synced files, provider CLI outputs)
- Formatting: `.oxfmtrc.json` (oxfmt configuration)
- Commit linting: `commitlint.config.js` (Conventional Commits enforced)
- Git hooks: `.lintstagedrc.mjs` (per-file linting on staged changes)

## Platform Requirements

**Development:**

- Node.js 22+ (runtime)
- pnpm 10.13.1+ (package manager)
- Provider CLIs available for consensus peers: `claude` (Claude Code), `codex` (Codex), `cursor-agent` (Cursor)
- TypeScript compiler (ts-node or tsc via pnpm)

**Production (Shipped Skills):**

- Node.js 22+ (runtime only)
- No external dependencies (shipped skills use Node standard library only)
- Provider CLIs: `claude`, `codex`, or `cursor-agent` (depending on which provider is invoked)

---

_Stack analysis: 2026-07-11_
