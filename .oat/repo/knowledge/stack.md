---
oat_generated: true
oat_generated_at: 2026-07-17
oat_source_head_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_source_main_merge_base_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Technology Stack

**Analysis Date:** 2026-07-17

## Languages

**Primary:**

- TypeScript 6.0.3 - All source code in `src/`, tests, and scripts

**Secondary:**

- JavaScript (ESM) - Runtime output files (generated `.mjs` scripts under `plugins/` and `skills/`)
- Markdown - Documentation and prose files

## Runtime

**Environment:**

- Node.js 22+ (required by `package.json` `engines` field)
- ESM (ECMAScript Modules) - Project uses `"type": "module"` in `package.json`

**Package Manager:**

- pnpm 10.13.1+ (pinned via `packageManager` in `package.json`)
- Lockfile: pnpm-lock.yaml (committed, enforced via `pnpm install --frozen-lockfile` in CI)

## Frameworks

**Core:**

- Node.js standard library only - Runtime code ships with zero external dependencies (`src/consensus/`, `src/transcript/`)

**Testing:**

- Vitest 4.1.9 - Test runner (configured in `vitest.config.mjs`; tests at `tests/**/*.test.ts`)
- @types/node 22.19.21 - TypeScript type definitions

**Build/Dev:**

- TypeScript 6.0.3 - Language and type checking (compiled to ES2024)
- esbuild 0.28.1 - Code bundling for generated runtime output (scripts/build-generated.mjs)
- oxlint 1.69.0 - JavaScript/JSON linting
- oxfmt 0.48.0 - Code formatting (JavaScript, JSON, Markdown)
- commitlint 21.0.2 - Commit message validation (Conventional Commits)
- lint-staged 17.0.7 - Pre-commit linting of staged files

**Documentation:**

- Next.js 16.1.6 - React framework for docs site (`documentation/`)
- React 19.1.0 - UI library
- Fumadocs 16.6.13 - Documentation framework (MDX support, search, navigation)
- Tailwind CSS 4.2.1 - Styling

## Key Dependencies

**Development (no runtime dependencies):**

- @commitlint/cli, @commitlint/config-conventional - Enforces Conventional Commits via pre-commit hook
- esbuild - Bundles canonical TypeScript source to generated runtime `.mjs` output
- oxlint, oxfmt - Enforces code quality and formatting
- Vitest - Test execution for comprehensive test suite

**Shipped Skills/Plugins (dependency-free):**

- Consensus plugin (`plugins/consensus/scripts/consensus.mjs`) - Zero external dependencies; uses Node.js standard library only
- Session Observer skill (`skills/session-observer/`) - Dependency-free
- Export Session Transcript skill (`skills/export-session-transcript/`) - Dependency-free

**Documentation dependencies:**

- @open-agent-toolkit/docs-* (config, theme, transforms) - OAT docs tooling
- fumadocs-* - MDX and UI rendering

## Configuration

**Environment:**

- XDG Base Directory Specification - Config lives under `$XDG_CONFIG_HOME/consensus/` or `$HOME/.config/consensus/` (see `src/consensus/config/consensus-config.ts`)
- No `.env` files required (environment variables passed via `process.env`)

**Build:**

- `tsconfig.json` - TypeScript configuration (ES2024 target, strict mode, ESM resolution)
- `vitest.config.mjs` - Test runner configuration (Node environment, 30s timeout for integration tests)
- `commitlint.config.js` - Enforces Conventional Commits

**Linting/Formatting:**

- `.oxlintrc.json` - oxlint configuration
- `.oxfmtrc.json` - oxfmt configuration
- `.lintstagedrc.mjs` - lint-staged configuration (runs on pre-commit for staged files only)

## Platform Requirements

**Development:**

- Node.js 22+
- pnpm 10.13.1+
- Git (for hooks and version control)
- Local provider CLIs for requested peers (claude, codex, cursor) when running consensus workflows

**Production/Deployment:**

- Docs site: GitHub Pages (deployed via `.github/workflows/deploy-docs.yml`)
- Skill execution: Any Node.js 22+ environment (no external services required)
- Plugin marketplace: Claude Code, Codex, Cursor agent platforms (local installation from filesystem or marketplace)

## Build & Generation

Generated runtime outputs are committed and tracked:

- Consensus plugin runtime: `plugins/consensus/scripts/consensus.mjs` (generated from `src/consensus/provider-cli/cli.ts`)
- Session observer runtime: `skills/session-observer/scripts/session-observer.mjs` (generated from `src/transcript/session-observer/session-observer.ts`)
- Other generated scripts under `skills/*/scripts/` (generated from `src/transcript/export-session/` and related)

Build process:

1. TypeScript source in `src/` is type-checked and compiled
2. esbuild generates `.mjs` runtime outputs (marked with `// GENERATED` banner)
3. Generated outputs are committed; CI verifies they match source via `pnpm run build:check`
4. Never hand-edit generated `.mjs` files — edit canonical TypeScript source and rebuild

---

_Stack analysis: 2026-07-17_
