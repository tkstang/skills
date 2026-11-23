# Core provider read-only runs can execute repo-controlled code

Date: 2026-11-20. Code base: `feat/consensus-extended-providers` at `14ff8c43`.
The Claude, Codex and Cursor invocations are unchanged from origin/main
`12350127`.

This evidence comes from source, installed-CLI internals, `--help` output and
vendor docs. No model was called.

The workflow ran one research lane per provider, each followed by an
adversarial verifier. All three verifiers **confirmed** the exposure.

The trigger was a live finding during the extended-provider work: Antigravity
runs project `.agents/hooks.json` shell hooks with no permission request (see
the extended-provider plan, updates #7-#9). The same class of exposure exists
in the shipped core tier.

> **Status: unfixed. Changing core invocation flags needs operator approval.**
> The changes below alter core behaviour, and some lose repo instructions.

> **Update 2026-11-23: unfixed by decision.** The read-only-only fix (PR #170,
> branch `fix/consensus-read-only-repo-config`) was closed without merging:
> losing repository instructions on read-only Claude peers outweighed a
> protection that mainly matters for untrusted repositories.

## Claude Code 2.1.328: confirmed

Consensus runs `claude --print --output-format json` in every profile. It
passes no `--setting-sources`, `--settings`, `--bare` or `--restricted`
(`src/plugins/consensus/provider-cli/invocation.ts:73-125`).

What a run loads:

- **Project hooks.** Read-only with no grants (`--permission-mode plan`) also
  lacks `--strict-mcp-config` and `--tools`
  (`runtime-policy.ts:276-277`, `restricted: false`). Anthropic's docs say a
  `-p` run skips the workspace trust dialog. Without `--bare`, it "runs the
  hooks in a project's `.claude/settings.json` and connects the servers in its
  `.mcp.json`, even in a folder you've never trusted" (code.claude.com
  headless docs; permissions docs, "What runs before you trust a folder").
- **Repo-controlled code that runs in every profile, before the model acts and
  without a permission request:**
  - `.claude/settings*.json` hooks, including `settings.local.json` from the
    **main checkout** when the run is in a worktree;
  - the `env` block (inference: it could redirect `ANTHROPIC_BASE_URL`);
  - helper commands (`apiKeyHelper`, `awsAuthRefresh`, `gcpAuthRefresh`,
    `otelHeadersHelper`, and others).
- **Read-only with no grants, additionally:**
  - `.mcp.json` stdio servers, auto-approved in non-interactive runs;
  - invocable project skills, whose `!` shell injection, `allowed-tools`
    self-grant and frontmatter hooks apply.
- **Plan mode is not strictly read-only.** Per the docs, it allows
  "classifier-approved commands when auto mode is available", and user allow
  rules still apply.
- **User-level `~/.claude` hooks** run in every child. They are
  operator-controlled. A PreToolUse or PermissionRequest hook can approve calls
  the profile would deny, and context injectors push private context into a
  peer that is reading untrusted content.

**Mitigation** (the flag exists in 2.1.328 `--help`): add
`--setting-sources user` to every profile, including `--resume`, and
`--strict-mcp-config` to read-only plan mode. Per the docs and binary strings,
this drops all of the following:

- project and local settings: hooks, `env`, helpers, permissions;
- `.mcp.json` auto-approval;
- project CLAUDE.md, AGENTS.md and `.claude/rules`;
- project skills, agents, commands and workflows;
- project `enabledPlugins`.

Auth is unaffected: OAuth, the keychain, env tokens and the claudep proxy all
live in the user scope or the environment.

Optional: `--settings '{"disableAllHooks":true}'` also drops user hooks; the
verifier confirmed this. The undocumented `CLAUDE_CODE_IGNORE_PERSISTED_TRUST`
exists but should not be relied on.

**Behaviour change:**

- Peers no longer auto-load the repo's CLAUDE.md, AGENTS.md or rules.
- Project permissions (including deny rules), `model` and `env` stop applying.
- Delegate worktrees lose the operator's own `settings.local.json` approvals.

## Codex CLI 0.170.0: confirmed

Consensus builds `codex exec [resume] --json --output-last-message …
--sandbox|-c sandbox_mode -c approval_policy` with no isolation flags
(`invocation.ts:156-208`).

What a run loads:

- **Trusted-project config.** Trust is resolved from cwd, then the project
  root, then the **main git root**, so a linked worktree inherits the main
  checkout's trust. This machine's `~/.codex/config.toml` trusts 208 paths,
  including `~/Code/skills`.
- **In a trusted project, repo `.codex/config.toml` applies.** The denylist
  covers only base URLs, the provider, `notify`, profiles and otel. That
  leaves these able to come from the repo:
  - `mcp_servers`;
  - hooks (loaded from the **main checkout's** `.codex` in a worktree);
  - `shell_environment_policy`;
  - `features`;
  - execpolicy rules.
- **User execpolicy allow rules bypass the sandbox** (`exec_policy.rs:491-505`).
  This machine's `~/.codex/rules/default.rules` allows `launchctl print` and
  `curl`. A prompt injection in reviewed content could therefore run both
  outside the read-only sandbox. This is repo-triggerable, not
  repo-controlled.

**Mitigation for read-only runs:** `--ignore-user-config --ignore-rules
--disable hooks`. All three are accepted by `codex exec` and `exec resume`.

- `--ignore-user-config` empties the user layer, which leaves project trust
  unset. Exec then drops the project layer.
- `--ignore-rules` is **load-bearing**: `--ignore-user-config` alone keeps the
  rules folders.
- `--disable hooks` turns the hooks feature off.
- Never combine `--ignore-user-config` with `--trust`; exec rejects the pair.

Notes:

- The verifier refuted the lane's "breaks the proxy" concern for this machine.
  `cli-proxy` passes the provider definition inline.
- Under `--ignore-user-config` the user's default model and effort are lost,
  so consensus should pass an explicit `--model`.
- Alternative: a consensus-owned `CODEX_HOME` holding auth plus a minimal
  config. It needs a hostEnv change.

**Behaviour change:** no user MCP servers, notify, hooks or defaults, and no
allow-rule sandbox bypass in read-only runs.

## Cursor CLI 2026.11.13: confirmed

Read-only argv: `--print --output-format json --trust --mode ask --sandbox
enabled` (`invocation.ts:236-246`). Other profiles use `--force`.

What a run loads:

- **Hook files, ungated.** The hook loader reads `<git root>/.cursor/hooks.json`,
  `.claude/settings.json` and `.claude/settings.local.json`, with no check for
  print mode, trust or mode. Hooks are wired before the headless runner starts
  (installed bundle `4327.index.js`, `2986.index.js`).
- **`--trust` persists.** It writes
  `~/.cursor/projects/<slug>/.workspace-trusted`. The verifier corrected the
  lane here: an already-trusted ancestor also passes the gate, so `--trust` is
  not the only enabler.
- **No flag disables hooks.** The hidden `--disable-project-configs` covers
  only `cli.json`. `--exclude-workspace-context` covers only rules, skills and
  notes.

**Mitigation options:**

- (a) **Fail closed before spawn:** refuse a read-only Cursor run when the
  git root has a non-empty `hooks` object in any of the three files. Malformed
  JSON also refuses. This **excludes Cursor from repos that use Claude Code
  hooks**, which is common.
- (b) Run against a sanitized snapshot that lacks those files, at the cost of
  setup work and a different cwd.

Also:

- Keep `--approve-mcps` and `--force` out of read-only.
- Optionally use the hidden `--data-dir <per-run tmp>`, so trust markers and MCP
  approvals do not persist. It is undocumented, so pin it with a version probe.
- User and team hooks still run (operator-controlled).

## Decisions needed (operator)

1. **Claude:** add `--setting-sources user` everywhere, plus
   `--strict-mcp-config` in plan mode? Decide whether the consensus brief
   should carry repo conventions that peers no longer auto-load.
2. **Codex:** add `--ignore-user-config --ignore-rules --disable hooks` to
   read-only runs, with an explicit model? Decide whether to apply the same to
   delegate write runs, where user MCP and defaults may be wanted.
3. **Cursor:** fail closed on project hook files (a), run on a sanitized
   snapshot (b), or accept and document?
4. **User-level hooks** (all three): accept them as operator-controlled, or
   disable them in consensus children (Claude `disableAllHooks`, Codex
   `--disable hooks`)?
5. Ship as a separate security-fix PR to core, ahead of the extended-provider
   work. Cross-model review is required.

Raw lane outputs are in the local workflow transcript `wf_cc39eb99-f44`
(machine-local, not tracked).
