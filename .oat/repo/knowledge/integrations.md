---
oat_generated: true
oat_generated_at: 2026-08-31
oat_source_head_sha: ae313c5bb6e54d521b4b00d0f44993b8fdf72ecc
oat_source_main_merge_base_sha: 467efe57bcb5e40b2cfb09c77507aa50e4c1cc44
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# External Integrations

**Analysis Date:** 2026-08-31

## APIs & External Services

**AI-provider CLI subprocesses:**

- Claude Code CLI (`claude`) - Consensus invokes it as a peer process using `claude --print --output-format json`; its provider adapter and invocation builder are in `src/consensus/provider-cli/adapters.ts` and `src/consensus/provider-cli/invocation.ts`.
  - SDK/Client: No HTTP SDK. `src/consensus/provider-cli/subprocess.ts` uses Node's `child_process.spawn` with `shell: false`.
  - Auth: Parent-process credentials are selectively forwarded as `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` by `src/consensus/provider-cli/runtime-policy.ts`; the repository does not implement Claude authentication itself.
- Codex CLI (`codex`) - Consensus invokes `codex exec --json` and reads its final message from a temporary file; the adapter and invocation are in `src/consensus/provider-cli/adapters.ts` and `src/consensus/provider-cli/invocation.ts`.
  - SDK/Client: No HTTP SDK. Node subprocess execution and output capture are implemented in `src/consensus/provider-cli/subprocess.ts`.
  - Auth: Parent-process `OPENAI_API_KEY` is selectively forwarded by `src/consensus/provider-cli/runtime-policy.ts`; `.github/workflows/live-e2e.yml` supplies it from a GitHub Actions secret for opt-in live tests.
- Cursor Agent CLI (`cursor-agent`) - Consensus invokes the CLI with JSON output; registration is in `src/consensus/provider-cli/adapters.ts` and invocation is in `src/consensus/provider-cli/invocation.ts`.
  - SDK/Client: No HTTP SDK. Node subprocess execution is implemented in `src/consensus/provider-cli/subprocess.ts`.
  - Auth: Parent-process `CURSOR_API_KEY` is selectively forwarded by `src/consensus/provider-cli/runtime-policy.ts`; `.github/workflows/live-e2e.yml` maps the name from GitHub Actions secrets for the opt-in workflow.

**Plugin hosts:**

- Claude Code - The Consensus marketplace/plugin manifest is `plugins/consensus/.claude-plugin/plugin.json`; local marketplace installation is documented in `README.md`.
- Codex - The Consensus plugin manifest is `plugins/consensus/.codex-plugin/plugin.json`, including the `./skills/` path and interactive/read/write interface metadata; local marketplace installation is documented in `README.md`.
- Cursor - The Cursor plugin manifest is `plugins/consensus/.cursor-plugin/plugin.json`; `README.md` specifies session-scoped loading using `cursor agent --plugin-dir`.

## Data Storage

**Databases:**

- Not detected. The root `package.json` declares no database/ORM client, and canonical runtime source under `src/` imports Node standard-library filesystem modules rather than database clients.

**File Storage:**

- Local filesystem only. Consensus configuration is written as JSON to the user config path (`$XDG_CONFIG_HOME/consensus/config.json` or `~/.config/consensus/config.json`) and project `.consensus/config.json`; path resolution and atomic writes are in `src/consensus/config/consensus-config.ts`.
- Session Observer persists read offsets and watch state in `$STATE_DIR` or `~/.local/state/session-observer`; `state.json`, `watch.json`, locks, and event logs are handled by `src/transcript/session-observer/lib/state.ts`, `src/transcript/session-observer/lib/watch-state.ts`, and `src/transcript/session-observer/lib/watch.ts`.
- Transcript discovery reads local Claude Code, Codex, and Cursor session directories (`~/.claude/projects/`, `~/.codex/sessions/`, and `~/.cursor/projects/`) in `src/transcript/core/runtimes.ts` and `src/transcript/session-observer/probe-local.ts`.
- Session export writes a sanitized Markdown file to the requested output path, defaulting to the user's `Downloads` directory, in `src/transcript/export-session/export-session-transcript.ts`.

**Caching:**

- No network cache or external cache service detected. The only retained runtime state identified in canonical source is local JSON/session-observer state under `src/transcript/session-observer/lib/`.

## Authentication & Identity

**Auth Provider:**

- Delegated to installed provider CLIs; no application-owned authentication or identity provider is detected. `src/consensus/provider-cli/probe.ts` checks executable readiness and detects authentication-required output, while `src/consensus/provider-cli/runtime-policy.ts` limits the child environment to base variables plus the selected provider's credential names.
  - Implementation: Provider capability/credential handling is centralized in `src/consensus/provider-cli/adapters.ts` and `src/consensus/provider-cli/runtime-policy.ts`; secrets are not serialized into diagnostic output by `redactedRuntimePolicyDiagnostics` in the latter file.

## Monitoring & Observability

**Error Tracking:**

- No external error-tracking service detected. Canonical runtime code in `src/` contains no HTTP client or error-tracking SDK import; provider failures are converted into structured diagnostics in `src/consensus/provider-cli/subprocess.ts` and classified in `src/consensus/provider-cli/adapters.ts`.

**Logs:**

- Provider subprocess stdout/stderr and execution metadata are captured locally by `src/consensus/provider-cli/subprocess.ts`.
- Consensus artifacts include a human-readable deliberation log, as described in `README.md`; Session Observer appends local JSONL watch events in `src/transcript/session-observer/lib/watch.ts`.

## CI/CD & Deployment

**Hosting:**

- GitHub Pages - `.github/workflows/deploy-docs.yml` installs and builds `documentation/`, uploads `documentation/out`, then deploys it through GitHub Pages actions. `NEXT_PUBLIC_BASE_PATH=/skills` is set for the project-site build.
- Local provider marketplaces/plugin hosts - Consensus is distributed through the provider-specific manifests under `plugins/consensus/`, with local marketplace loading commands in `README.md`.

**CI Pipeline:**

- GitHub Actions - `.github/workflows/validate.yml` runs root dependency install, generated-output verification, build, type check, Vitest tests, validation, smoke tests, PR skill-version checks, internal-flag validation, commitlint, and changed-file lint/format checks.
- GitHub Actions release validation - `.github/workflows/release.yml` runs the same root quality gates on `v*` tags and verifies version consistency.
- GitHub Actions docs CI - `.github/workflows/docs-ci.yml` installs the nested docs app, builds its static export, and format-checks docs.
- GitHub Actions optional live provider test - `.github/workflows/live-e2e.yml` is manual-dispatch only and injects selected provider credentials from Actions secrets before running `pnpm run test:live-e2e`.

## Environment Configuration

**Required env vars:**

- No environment variable is universally required for local repository tooling: root scripts are declared in `package.json` and CI sets Node/pnpm through `.github/workflows/validate.yml`.
- For a provider peer, the effective credential is managed by its installed CLI; supported forwarded names are `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` (Claude), `OPENAI_API_KEY` (Codex), and `CURSOR_API_KEY` (Cursor) in `src/consensus/provider-cli/runtime-policy.ts`.
- `XDG_CONFIG_HOME` optionally changes the user Consensus config root in `src/consensus/config/consensus-config.ts`; `STATE_DIR` optionally changes Session Observer state storage in `src/transcript/session-observer/lib/state.ts`.
- `NEXT_PUBLIC_BASE_PATH` sets the deployed docs base path in `documentation/next.config.js` and is set to `/skills` by `.github/workflows/deploy-docs.yml`.
- `CONSENSUS_LIVE_SUBMIT_E2E=1` and `CONSENSUS_LIVE_SUBMIT_PROVIDER` enable/select the opt-in live provider test through `package.json` and `.github/workflows/live-e2e.yml`.

**Secrets location:**

- Local use: provider credentials stay in the parent process/installed provider CLI environment and are only allowlisted into the child process in `src/consensus/provider-cli/runtime-policy.ts`.
- CI live tests: `.github/workflows/live-e2e.yml` maps GitHub Actions secrets into `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `CURSOR_API_KEY` environment variables.
- Tracked `.env*` files are not detected by the repository configuration scan. `.claude/settings.local.json` and `.mcp.json` are ignored local-only files according to Git-ignore evidence, not canonical secret stores.

## Webhooks & Callbacks

**Incoming:**

- No application webhook endpoint detected. The canonical runtime under `src/` has no server listener or HTTP client; CI workflow triggers in `.github/workflows/*.yml` are GitHub Actions events, not runtime webhook handlers.

**Outgoing:**

- No application webhook callback detected. The only external runtime boundary detected is the provider-CLI subprocess interface in `src/consensus/provider-cli/`; GitHub Pages deployment is executed by `.github/workflows/deploy-docs.yml`.

---

_Integration audit: 2026-08-31_
