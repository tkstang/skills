---
oat_generated: true
oat_generated_at: 2026-07-17
oat_source_head_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_source_main_merge_base_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# External Integrations

**Analysis Date:** 2026-07-17

## APIs & External Services

**AI Model Providers:**

- Claude (Anthropic) - Primary consensus participant provider
  - Client: Local `claude` CLI invoked via subprocess
  - Integration: `src/consensus/provider-cli/probe.ts` (provider discovery/health check)
  
- Codex - Alternative consensus participant provider
  - Client: Local `codex` CLI invoked via subprocess
  - Integration: `src/consensus/provider-cli/probe.ts`
  
- Cursor Agent - Alternative consensus participant provider
  - Client: Local `cursor` CLI invoked via subprocess
  - Integration: `src/consensus/provider-cli/probe.ts`

**Provider Runtime Invocation:**

- No remote API calls; providers are invoked as local subprocesses via `execFile()` from `src/consensus/provider-cli/subprocess.ts`
- Structured JSON request/response envelope pattern in `src/consensus/provider-cli/envelope.ts`
- No webhooks or callbacks; all communication is synchronous subprocess-based

**External Monitoring/Analytics:**

- Not detected

**Third-party Authentication:**

- Not applicable (consensus manages peer/panelist composition internally via configuration)

## Data Storage

**Databases:**

- Not detected - No databases integrated

**File Storage:**

- Local filesystem only - Consensus configuration stored under XDG Base Directory (`$XDG_CONFIG_HOME/consensus/` or `$HOME/.config/consensus/`)
- Session transcripts and artifacts stored in local `.oat/repo/` and project directories
- Implementation: `src/consensus/config/consensus-config.ts` (config persistence)
- Implementation: `src/transcript/session-observer/session-observer.ts` (session artifact capture)

**Caching:**

- None - No caching layer or service

## Authentication & Identity

**Auth Mechanism:**

- Custom - Provider authentication delegated to local CLI tools (claude, codex, cursor)
- Consensus itself handles no authentication; it trusts the local provider CLIs are authenticated

**Configuration Management:**

- XDG Base Directory Specification - User config at `~/.config/consensus/` (or `$XDG_CONFIG_HOME`)
- Project-level config via `consensus.json` or `consensus.yml` in project root
- See `src/consensus/config/consensus-config.ts` for config loading strategy

**Secrets:**

- Provider authentication is external to this codebase (delegated to local CLI auth)
- No secrets stored or passed through consensus code

## Monitoring & Observability

**Error Tracking:**

- Not detected - No error tracking service integrated

**Logs:**

- Stdout/stderr only - All output is text or JSON to standard streams
- No centralized logging service
- Provider CLI output (stderr from subprocess) is captured and logged

**Diagnostics:**

- Provider health checks via `provider preflight` and `provider ls` subcommands (in `src/consensus/provider-cli/probe.ts`)
- No telemetry or observability backend

## CI/CD & Deployment

**Hosting:**

- GitHub Pages for documentation site (`documentation/` deployed via `.github/workflows/deploy-docs.yml`)
- Skill execution: Local (user's machine) or plugin marketplace platforms (Claude Code, Codex, Cursor)

**CI Pipeline:**

- GitHub Actions (`.github/workflows/validate.yml`, `deploy-docs.yml`, `release.yml`)
- No external CI/CD services beyond GitHub
- Workflow jobs: validate (test/lint/build), skill-versions (enforcement), internal-flags (enforcement), commitlint, lint/format

**Artifact Storage:**

- GitHub (source repository)
- GitHub Pages (docs site static export)
- No artifact repository service

## Environment Configuration

**Required env vars:**

- `XDG_CONFIG_HOME` - Optional; defaults to `$HOME/.config` if unset (XDG standard)
- `HOME` - Used as fallback for config directory resolution
- `GIT_HOOKS` - Development only; set to "0" in CI to skip git-hook setup

**Optional env vars (passed through to provider invocation):**

- `NODE_OPTIONS` - Node runtime flags (if using Node subprocesses)
- Any env var passed explicitly via `runOptions.env` in consensus API calls

**Secrets location:**

- Provider CLI auth handled externally (CLI tools manage their own auth tokens/credentials)
- No secrets committed to this repository

## Webhooks & Callbacks

**Incoming:**

- Not detected - No webhook endpoints

**Outgoing:**

- Not detected - No outgoing webhooks

**Async Communication:**

- None - All consensus operations are synchronous subprocess-based

## Plugin Marketplace Integration

**Distribution Channels:**

- Claude Code plugin marketplace (local installation via `claude plugin`)
- Codex plugin marketplace (local installation via `codex plugin`)
- Cursor Agent (direct filesystem reference via `--plugin-dir`)
- GitHub repository (skills.sh discovery for standalone skills)

**Plugin Manifests:**

- Consensus: `plugins/consensus/manifest.json`
- Session Observer skill: `skills/session-observer/SKILL.md`
- Export Session Transcript skill: `skills/export-session-transcript/SKILL.md`

## Network Requirements

**For Shipped Skills/Plugins:**

- No outbound network calls from consensus or session observer code
- Provider communication is via local subprocess; any network access is the responsibility of the local provider CLI
- Docs site build requires network access to fetch npm dependencies (dev-time only)

**For Documentation:**

- Docs deployment to GitHub Pages requires GitHub Actions access
- Docs site build pulls dependencies from npm registry (dev-time)

---

_Integration audit: 2026-07-17_
