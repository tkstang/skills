---
oat_generated: true
oat_generated_at: 2026-08-31
oat_source_head_sha: ae313c5bb6e54d521b4b00d0f44993b8fdf72ecc
oat_source_main_merge_base_sha: 467efe57bcb5e40b2cfb09c77507aa50e4c1cc44
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Technology Stack

**Analysis Date:** 2026-08-31

## Languages

**Primary:**

- TypeScript (compiler target: ES2024) - Canonical runtime source is in `src/`; TypeScript test files are in `tests/`. `tsconfig.json` uses `module` and `moduleResolution` `NodeNext`, strict checking, and no direct TypeScript emit.

**Secondary:**

- JavaScript ESM - Repository tooling is authored in `.mjs` files under `scripts/` and `tools/git-hooks/`; committed plugin runtime outputs under `plugins/consensus/scripts/` and standalone-skill runtime outputs under `skills/` are ESM. `package.json` declares `"type": "module"`.
- Markdown and MDX - Skill instructions live in `skills/*/SKILL.md` and `plugins/consensus/skills/*/SKILL.md`; the documentation application reads MDX from `documentation/docs/` via `documentation/source.config.ts`.
- JSON - Provider plugin manifests are in `plugins/consensus/.claude-plugin/plugin.json`, `plugins/consensus/.codex-plugin/plugin.json`, and `plugins/consensus/.cursor-plugin/plugin.json`; provider-result schemas live under `plugins/consensus/skills/*/schemas/`.

## Runtime

**Environment:**

- Node.js >=22 - Required by `package.json` (`engines.node`) and by the GitHub Actions workflows in `.github/workflows/validate.yml`, `.github/workflows/release.yml`, and `.github/workflows/deploy-docs.yml`.
- Shipped skill/plugin runtime: dependency-free Node ESM using Node standard-library APIs. This delivery contract is stated in `README.md`; canonical provider and transcript implementations import `node:*` modules in `src/consensus/provider-cli/` and `src/transcript/`.

**Package Manager:**

- pnpm >=10.13.1 - Root `package.json` declares `packageManager: "pnpm@10.13.1"` and its scripts invoke `pnpm`.
- Lockfile: present at `pnpm-lock.yaml`; the independent docs app also has `documentation/pnpm-lock.yaml` and its own `documentation/package.json`.

## Frameworks

**Core:**

- No server, web, or ORM framework detected in the shipped runtime. The Consensus plugin composes installed provider CLIs through Node subprocesses (`src/consensus/provider-cli/subprocess.ts`), and the standalone skills process local transcript and filesystem data (`src/transcript/`).
- Provider-plugin metadata targets Claude Code, Codex, and Cursor in `plugins/consensus/.claude-plugin/plugin.json`, `plugins/consensus/.codex-plugin/plugin.json`, and `plugins/consensus/.cursor-plugin/plugin.json`.
- Documentation application: Next.js `^16.1.6`, React `^19.1.0`, Fumadocs Core/UI `^16.6.13`, and Fumadocs MDX `^14.2.9`, all declared in `documentation/package.json`. `documentation/next.config.js` configures the docs integration.

**Testing:**

- Vitest `^4.1.9` - Root test runner, declared in `package.json` and configured for Node test files in `vitest.config.mjs`.

**Build/Dev:**

- TypeScript `^6.0.3` - Type checking is `tsc --noEmit` through `package.json` and `tsconfig.json`.
- esbuild `^0.28.1` - `scripts/build-generated.mjs` bundles canonical TypeScript runtime source into committed `.mjs` outputs; invoked by `pnpm run build`.
- oxlint `^1.69.0` and oxfmt `^0.48.0` - Root lint and format tooling from `package.json`, configured by `.oxlintrc.json` and `.oxfmtrc.json`.
- Tailwind CSS `^4.2.1` and `@tailwindcss/postcss` `^4.2.1` - Documentation-app styling/build dependencies declared in `documentation/package.json` and configured by `documentation/postcss.config.mjs`.

## Key Dependencies

**Critical:**

- No runtime npm dependency is declared for shipped skills/plugins. Runtime provider access is through external executables configured in `src/consensus/provider-cli/adapters.ts`, while `README.md` defines the shipped contract as Node standard library only.
- TypeScript `^6.0.3` and esbuild `^0.28.1` - Required developer dependencies for type checking and generated-runtime builds, declared in `package.json` and used by `scripts/build-generated.mjs`.
- Vitest `^4.1.9` - Required developer dependency for the root test suite, declared in `package.json` and launched through `scripts/run-vitest.mjs`.

**Infrastructure:**

- `@commitlint/cli` and `@commitlint/config-conventional` `^21.0.0` - Conventional Commit validation dependencies declared in `package.json`; configuration is in `commitlint.config.js` and the hook entrypoint is `tools/git-hooks/commit-msg`.
- `lint-staged` `^17.0.7` - Staged-file lint/format orchestration declared in `package.json` and configured in `.lintstagedrc.mjs`.
- `@open-agent-toolkit/docs-config`, `@open-agent-toolkit/docs-theme`, and `@open-agent-toolkit/docs-transforms` `^0.1.27` - Docs-app dependencies declared in `documentation/package.json` and imported by `documentation/next.config.js` and `documentation/source.config.ts`.

## Configuration

**Environment:**

- Root package/tool configuration is in `package.json`, `tsconfig.json`, `vitest.config.mjs`, `.oxlintrc.json`, `.oxfmtrc.json`, `.lintstagedrc.mjs`, and `commitlint.config.js`.
- Runtime provider credentials are conditional on the selected locally installed provider CLI. The child-process allowlist forwards `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` for Claude, `OPENAI_API_KEY` for Codex, and `CURSOR_API_KEY` for Cursor in `src/consensus/provider-cli/runtime-policy.ts`; no application-managed credential client is present.
- User and project Consensus defaults are JSON files resolved by `src/consensus/config/consensus-config.ts`: `$XDG_CONFIG_HOME/consensus/config.json` (or `~/.config/consensus/config.json`) and the nearest `.consensus/config.json` respectively.
- Session Observer state is local JSON under `$STATE_DIR` or `~/.local/state/session-observer`, as implemented in `src/transcript/session-observer/lib/state.ts`, `src/transcript/session-observer/lib/watch-state.ts`, and `src/transcript/session-observer/lib/cursor-state.ts`.
- Tracked `.env*` files were not detected by the repository configuration scan. `.claude/settings.local.json` is ignored by the user Git ignore configuration and `.mcp.json` is ignored by the repository's Git exclude, so both are local-only rather than canonical configuration.

**Build:**

- Generated runtime build: `scripts/build-generated.mjs` maps TypeScript source under `src/` into committed runtime output under `plugins/consensus/` and `skills/`; `package.json` exposes `build` and `build:check`.
- Root quality/build commands are defined in `package.json`: `type-check`, `test`, `validate`, `smoke`, and composite `premerge`.
- Docs builds run in the nested application through `documentation/package.json`; `documentation/next.config.js` sets the Turbopack root and accepts `NEXT_PUBLIC_BASE_PATH`.

## Platform Requirements

**Development:**

- Node.js >=22 and pnpm >=10.13.1 are required by `package.json`; root CI installs dependencies using `pnpm install --frozen-lockfile` in `.github/workflows/validate.yml`.
- Consensus use additionally requires the locally installed provider CLI or CLIs selected as peers: `claude`, `codex`, and/or `cursor-agent`, as registered in `src/consensus/provider-cli/adapters.ts` and documented in `README.md`.
- The optional live-provider test spends provider quota and is gated by `CONSENSUS_LIVE_SUBMIT_E2E=1` in `package.json`; the environment/auth setup is defined in `.github/workflows/live-e2e.yml`.

**Production:**

- Consensus ships as a local marketplace/plugin package for Claude Code and Codex, and as a session-scoped Cursor plugin directory. The exact install/load commands are in `README.md`; provider manifests are under `plugins/consensus/`.
- The static documentation site is built from `documentation/` and deployed to GitHub Pages by `.github/workflows/deploy-docs.yml`.

---

_Stack analysis: 2026-08-31_
