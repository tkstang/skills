---
oat_generated: true
oat_generated_at: 2026-06-20
oat_source_head_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_source_main_merge_base_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# External Integrations

**Analysis Date:** 2026-06-20

## APIs & External Services

**AI Provider CLIs (consensus plugin):**

The only external execution boundary in shipped code is provider CLI subprocesses. The consensus engine invokes locally-installed agent CLIs rather than calling vendor HTTP APIs directly. Adapters live in `src/consensus/provider-cli/adapters.ts` and invocation builders in `src/consensus/provider-cli/invocation.ts`.

- **Claude** — executable `claude` (`buildClaudeInvocation`)
- **Codex** — executable `codex` (`buildCodexInvocation`)
- **Cursor** — executable `cursor-agent` (`buildCursorInvocation`)

Each adapter declares: `id`, `display_name`, `executable`, a `probe` definition (`src/consensus/provider-cli/probe.ts`) for availability detection, `capabilities`, a structured-output strategy, and a `classifyRunFailure` mapper (`PROVIDER_MISSING`, `PROVIDER_EXIT`, `PROVIDER_TIMEOUT`, `PROVIDER_OUTPUT_CAP_EXCEEDED`). Subprocess execution and timeouts/output caps are enforced in `src/consensus/provider-cli/subprocess.ts`, gated by `src/consensus/provider-cli/host-guard.ts` and `runtime-policy.ts`.

## Data Storage

**Databases:**

- None. There is no database — this repo ships agent skills, not a service.

**File Storage:**

- Local filesystem only. The transcript skills read provider session stores and write outputs (session-observer state, exported Markdown). The consensus engine writes audit/deliberation artifacts (`.consensus/` in the working tree).

**Caching:**

- None as a service. Session-observer persists per-runtime read offsets to a state directory (`STATE_DIR`) so `catch-up` shows only new records.

## Authentication & Identity

**Auth Provider:**

- None owned by this repo. Authentication is delegated entirely to the provider CLIs — each invoked CLI (`claude`, `codex`, `cursor-agent`) must already be authenticated in the user's environment. No API keys or tokens are read or stored by this codebase.

## Monitoring & Observability

**Error Tracking:**

- None. Errors surface through structured failure classification (provider error codes) and process exit codes.

**Logs:**

- stdout/stderr and written artifacts (consensus deliberation logs, transcript digests). No external log sink.

## CI/CD & Deployment

**Hosting:**

- Not a hosted service. Distribution is via the local git repository marketplace (`.claude-plugin/marketplace.json`) and provider skill install paths.

**CI Pipeline:**

- GitHub Actions:
  - `.github/workflows/validate.yml` — install (frozen lockfile), build, type-check, build-drift check, tests, validate, smoke, plus incremental oxlint / oxfmt on changed files.
  - `.github/workflows/release.yml` — release automation.

## Environment Configuration

**Runtime detection env vars (not secrets):**

- Claude Code: `CLAUDECODE`, `CLAUDE_CODE`
- Codex: `CODEX_HOME`, `CODEX_SANDBOX`
- Cursor: `CURSOR`, `CURSOR_TRACE_ID`
- Skill self-markers / state: `SESSION_OBSERVER_SELF`, `EXPORT_SESSION_SELF`, `STATE_DIR`

**Secrets location:**

- None in this repo. Provider credentials live in each provider CLI's own configuration, outside this codebase.

## Webhooks & Callbacks

**Incoming:**

- None.

**Outgoing:**

- None. All outbound communication is mediated by provider CLI subprocesses, not HTTP calls from this code.

---

_Integration audit: 2026-06-20_
