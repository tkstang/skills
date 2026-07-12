---
oat_generated: true
oat_generated_at: 2026-07-11
oat_source_head_sha: 0e25a36d3958a1e09c7bedaddd6d3498dc0905d7
oat_source_main_merge_base_sha: 17043d653233fb906e018f5872359d99eb556208
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# External Integrations

**Analysis Date:** 2026-07-11

## APIs & External Services

**AI Provider CLIs:**

- **Claude (Anthropic)** - Multi-model AI provider
  - Executable: `claude` (invoked as subprocess)
  - Invocation builder: `buildClaudeInvocation()` in `src/consensus/provider-cli/invocation.ts`
  - Adapter: `src/consensus/provider-cli/adapters.ts` (DEFAULT_PROVIDER_ADAPTERS, id: 'claude')
  - Auth: `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` environment variable
  - Capabilities: model selection, effort levels ('effort'), runtime policies (non-interactive, read-only, env_allowlist)
  - Schema strategies: provider_validated, prompt_only
  - Output mode: stdout_json

- **Codex (OpenAI)** - Multi-model AI provider
  - Executable: `codex` (invoked as subprocess)
  - Invocation builder: `buildCodexInvocation()` in `src/consensus/provider-cli/invocation.ts`
  - Adapter: `src/consensus/provider-cli/adapters.ts` (DEFAULT_PROVIDER_ADAPTERS, id: 'codex')
  - Auth: `OPENAI_API_KEY` environment variable
  - Capabilities: model selection, effort levels ('reasoning_effort'), runtime policies (non-interactive, sandboxes: read-only/workspace-write, approval_policies: never/on-request, env_allowlist)
  - Schema strategies: constrained_native, prompt_only
  - Output mode: last_message_file

- **Cursor** - Agent-based IDE
  - Executable: `cursor-agent` (invoked as subprocess)
  - Invocation builder: `buildCursorInvocation()` in `src/consensus/provider-cli/invocation.ts`
  - Adapter: `src/consensus/provider-cli/adapters.ts` (DEFAULT_PROVIDER_ADAPTERS, id: 'cursor')
  - Auth: `CURSOR_API_KEY` environment variable
  - Capabilities: model selection disabled, no effort selection, runtime policies (non-interactive, env_allowlist)
  - Schema strategies: prompt_only, submit_tool_candidate
  - Output mode: stdout_json

## Data Storage

**Databases:**

- Not detected - No external database integrations found

**File Storage:**

- Local filesystem only - Config files stored in `.consensus/` directory under user's home (XDG_CONFIG_HOME or HOME based)
- Reference: `src/consensus/config/consensus-config.ts`

**Caching:**

- None - No external caching service detected

## Authentication & Identity

**Auth Providers:**

- Custom (Provider-specific API keys)
  - Implementation: Environment variable-based authentication per provider
  - Providers: Anthropic (Claude), OpenAI (Codex), Cursor
  - Environment variables: `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `OPENAI_API_KEY`, `CURSOR_API_KEY`
  - Validation: Runtime policy handles env var allowlisting (`src/consensus/provider-cli/runtime-policy.ts`)

## Monitoring & Observability

**Error Tracking:**

- None - No external error tracking service (Sentry, Rollbar, etc.) detected

**Logs:**

- Standard output/stderr capture from provider CLI invocations
- Error classification and retry logic in `src/consensus/provider-cli/adapters.ts` (failure pattern matching for transient vs. terminal errors)
- Subprocess stdout/stderr capture in `src/consensus/provider-cli/subprocess.ts`

## CI/CD & Deployment

**Hosting:**

- GitHub (repository hosting)
- Documentation site: Next.js-based static/server-side rendering (deployable to Vercel or any Node.js host)
- Skills/plugins: Distributed via provider marketplaces (Claude Code marketplace, Codex plugin system) or git repository install

**CI Pipeline:**

- GitHub Actions (`.github/workflows/`)
- Local pre-commit hook: lint-staged with oxlint/oxfmt
- Local pre-push hook: full validation suite (`pnpm run validate`, `pnpm run smoke`)

## Environment Configuration

**Required env vars:**

- Provider-specific (at least one needed):
  - `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` - for Claude provider
  - `OPENAI_API_KEY` - for Codex provider
  - `CURSOR_API_KEY` - for Cursor provider
- System environment (inherited from parent):
  - `PATH`, `HOME`, `TMPDIR`, `TEMP`, `TMP`, `USER`, `LOGNAME`, `SHELL`, `LANG`
  - `XDG_CONFIG_HOME` - optional, used for config file location (falls back to HOME)

**Secrets location:**

- Environment variables (provider-managed, not in repository)
- No `.env` files detected in repository
- Config stored in user's `.consensus/` directory

## Webhooks & Callbacks

**Incoming:**

- None detected

**Outgoing:**

- Provider CLI invocations via subprocess (consensus plugin orchestrates provider CLI calls)
- Standard subprocess communication: stdin/stdout/stderr pipes
- Reference: `src/consensus/provider-cli/subprocess.ts`, `src/consensus/provider-cli/structured-output.ts`

## Provider Capability Matrix

Reference source: `src/consensus/provider-cli/adapters.ts`, `src/consensus/provider-cli/types.ts`

| Capability | Claude | Codex | Cursor |
|-----------|--------|-------|--------|
| Model selection | Yes | Yes | No |
| Effort selection | Yes (effort) | Yes (reasoning_effort) | No |
| Runtime policies | Yes | Yes | Yes |
| Sandboxing | No | Yes (read-only, workspace-write) | No |
| Approval policies | No | Yes (never, on-request) | No |
| Env allowlist | Yes | Yes | Yes |
| Schema validation | provider_validated, prompt_only | constrained_native, prompt_only | prompt_only, submit_tool_candidate |
| Same-host subprocess | Yes | Yes | Yes |
| Host native dispatch | No | No | No |
| Submit tool support | No | No | No |

## Error Handling & Retry

**Transient errors** (retryable):
- Rate limit errors (429, rate limit messages)
- Temporary unavailability (try again, temporary)
- Connection errors (econnreset, etimedout)
- Overload errors (Claude: 529 Repeated, Codex: rate limiter, Cursor: connection_timeout)
- Reference: `src/consensus/provider-cli/adapters.ts` (CLAUDE_TRANSIENT_EXIT_PATTERNS, CODEX_TRANSIENT_EXIT_PATTERNS, CURSOR_TRANSIENT_EXIT_PATTERNS)

**Terminal errors** (not retryable):
- Authentication required (not logged in, keychain locked)
- Unsupported platform/configuration
- Unsupported options/flags
- Process exits with non-transient codes

---

_Integration audit: 2026-07-11_
