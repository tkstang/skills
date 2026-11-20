---
oat_generated: false
oat_external_plan: true
oat_external_plan_source: manual
oat_external_plan_sources:
  - src/plugins/consensus
  - src/skills/consensus-delegate
  - https://github.com/openclaw/acpx/tree/v0.22.0
  - https://github.com/agentclientprotocol/agent-client-protocol/tree/3257723
oat_external_plan_commit: 12350127
oat_backlog_items: []
oat_issue_url: null
created: '2026-11-20T22:30:00Z'
---

# Consensus extended providers through one ACP adapter

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`.
> Execute it directly, or import it with `oat-project-import-plan <this-file>`.
> Status: **reviewed (Codex, 2026-11-20); Phase 1 committed locally (`971439b5..f2ce5d22`, review findings fixed, re-check pending); live ACP test ongoing (Antigravity complete)**. Steps tagged
> **[independent]** can start now. Steps tagged **[hinges: Qn]** wait on the live
> test question with that number (see "Live-test questions").

## Outcome

The consensus plugin gains an **extended provider tier**: Devin, Pi, Factory
Droid, DeepSeek Harness (`dsh`), Gemini CLI and Antigravity (`agy`). All six come
through **one ACP adapter**. The core providers `claude`, `codex` and `cursor`
keep their native CLI adapters unchanged. An extended provider:

- is used only when named explicitly. It is never auto-selected by delegate
  fallback, panel auto-fill or deliberation defaults;
- is blocked at preflight with install instructions when its prerequisites are
  missing (the ACP transport, if external, and the provider CLI);
- starts **read-only**, admitted one provider at a time after a live admission
  test. Write mode follows later, one provider at a time, after live worktree
  confinement evidence and a cross-model review;
- lands in `delegate` first. `phone-a-friend`, panel, the deliberation skills and
  `review` follow.

The adapter takes a swappable ACP transport (an `acpx` subprocess, or an in-house
stdio ACP client), so callers never see which backend ran.

## Decisions in force

From Stoa decision `cd645fea` (2026-11-16; refines `043e6178`) and the operator's
brief:

- Core stays native. Extended providers come in as one tier through one ACP
  adapter.
- Priority order is Devin, Pi, Droid, DeepSeek, then Gemini and Antigravity. The
  order is now **flexible**: Antigravity is its own provider, and Gemini 4 models
  raise the value of Gemini and Antigravity (operator, 2026-11-20).
- Default route is acpx, pinned. An in-house ACP client is acceptable if it is
  straightforward. The adapter must allow either without caller changes.
- Read-only first. Writes come per provider after live confinement evidence.
- `delegate` first.

## What recon changed

Recon ran at `12350127` (origin/main): seven repo and web lanes, two adversarial
claim verifiers and a completeness critic. Load-bearing claims were rechecked
by hand. Corrections to the earlier recon:

| Earlier claim                                                    | Verdict                    | Current fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Provider list hard-coded at `types.ts:1`, `executable.ts:11-15`, `runtime-policy.ts:66-70` | Partially right | All three are exact. The set is also closed at `adapters.ts:20` (`ProviderAdapter.id: FirstScopeProviderId`), `consensus-config.ts:516-523` (reviewer validation), `runtime-policy.ts:229-243` (`isProvenReadOnlyProfile`, false for any other provider, which blocks `max_attempts > 1`) and `types.ts:12` (`HOST_RUNTIMES`). A registry already exists: `providerRegistry()` / `DEFAULT_PROVIDER_ADAPTERS`, `adapters.ts:146-355`. |
| One output shape, `{result}`: text `structured-output.ts:815-835`, JSON `:884-896` | Corrected | There are two shapes, chosen by `output_mode`: Codex `last_message_file`, and stdout JSON with a string `result` (`structured-output.ts:766-855`). Any present non-`success` subtype is rejected for every stdout provider. Claude additionally *requires* `subtype: success` (`:841`). JSON verdicts try submit capture first (`:566-590`), then `extractStructuredJsonValue` (`:901-916`), which prefers `structured_output`, then parses a string `result`, and otherwise returns the value unchanged. `:868-891` is the submit-file reader. **One ACP reader covers all ACP agents**; per-provider readers are not needed. |
| UUID session ids `continuation.ts:20-21`; resume gate `structured-output.ts:177-185` | Confirmed | Gate spans `:177-191`. The UUID rule applies only to native-resume requests (`continuation.ts:89-96`), so new turns with non-UUID ids already work. The adapter lookup (`structured-output.ts:106`) already comes before `continuationUsageError(request)` (`:126`), so a per-adapter validator is passed into that existing call. |
| Codex confinement `adapters.ts:259-275`; Claude plan mode `runtime-policy.ts:298-300` | Corrected (drift) | Codex evidence is at `adapters.ts:263-268` and `:269-278`. Claude plan mode returns at `runtime-policy.ts:297-298`. Evidence is free-text comments, not a typed capability. |
| stdin written once then closed, `subprocess.ts:210-211` | Confirmed | acpx does not need two-way messaging. An in-house client does. Seam: `RunProviderTurnDependencies.runSubprocess` (`structured-output.ts:54-64, 394`). |
| Unused `acp_like` enum, `types.ts:91-94` | Confirmed (detail) | It is an optional union field `ProviderCapabilities.future_extension_kind`, never set or read. Remove it (no-compat-shim policy). |
| `plugins/consensus/AGENTS.md:11` says the provider's own CLI is the only outside dependency | Corrected | It says **"the owned provider CLI"** (consensus's own generated CLI) "is the only sanctioned external boundary". Root `AGENTS.md:58` names provider CLI subprocesses as the boundary. `src/AGENTS.md:25` and `plugins/consensus/README.md:87-89, 362` also apply. **DR-023** (`DR-260619-consensus-peer-invocation`) superseded the Paseo shell-out (DR-002) because the external peer-run dependency "added install drift". acpx needs a new decision record, not only new wording. |
| Review is Claude/Codex only: `selection.ts:259-262`, `run.ts:143-148` | Corrected | The gate is `isReviewProvider`, `selection.ts:264-268` (used at `:99-105`). `:259-262` is `parsePinnedReviewer`. Also hard-coded: `run.ts:77, 232-240, 612-619, 1741-1778`, the `codex_last_message` evidence field (`run.ts:445`, `review.ts:404-406`) and default reviewers (`consensus-config.ts:287-290`). |
| Groundwork list (extractors, session-id validation, denial diagnostics, delegate wording, registry) | Incomplete | Also needed: open the closed id typing; per-provider credential env allowlist; probe prerequisites (two binaries) with version **range or pin** (today minimum only, `probe.ts:142-161`) and install hints; a run-path prerequisite check (`run` never probes); tier-aware auto-selection; adapter-owned submit-capture eligibility (`structured-output.ts:366-377`); and a reported-failure classifier for stop reasons. |
| Sizing: groundwork ~0.5-1 day; in-house client ~2-3 weeks to first provider | Revised | See "Sizing". Groundwork is ~2-3 days. The in-house path is no longer much slower than acpx, because acpx output is raw ACP frames that we must parse anyway. |

### New risks recon surfaced

1. **ACP read-only is advisory.** The ACP spec says the agent "runs with
   whatever permissions its process is given" and that permission requests are
   advisory (spec `security.mdx:10-12,74`). acpx says `--no-fs` / `--no-terminal`
   are "not an OS sandbox" (`permissions.md:199-216`). pi-acp runs every read,
   write and exec locally and never asks. Read-only must therefore rest on
   **provider-native controls plus host-side detection**, not on permission
   refusal.
2. **Delegate read-only runs have no detection today.** They run at the repo
   root with no snapshots (`consensus-delegate/SKILL.md:107`; user doc
   `delegate.md:75-79`).
3. **Preflight would report `ready` falsely.** `probeProviderReadiness`
   resolves one executable (`probe.ts:99-113`) and runs `version_args`. It
   matches auth patterns only against that output (`:125`), evaluates the
   capability probes, then returns `ready` (`:193`). An ACP adapter whose
   executable is `acpx` would read `ready` with no agent CLI installed. There
   is no dedicated auth check. Three more defects:
   - The probe looks up the resolved path but runs the original command token
     (`:114-118`), so the binary that was checked and the one that runs can
     differ.
   - `parseNumericVersion` drops prerelease tags (`:375-379`): `0.2.2-rc.5`
     reads as `0.2.2`, so it cannot enforce exact pins.
   - Preflight labels any named `unsupported` entry "not registered"
     (`commands.ts:223-228`).
4. **Panel would recruit extended providers silently.** `selectPanelAgents` /
   `builtInAgents` take any `ready` inventory entry (`consensus-config.ts:410-449`).
5. **Panel and deliberation send no runtime policy.** The CLI then defaults to
   `permission_mode: 'non-interactive'` (`runtime-policy.ts:48-52`), which is
   Cursor's `--force` precedent (`invocation.ts:228-240`). Extended adapters
   must not declare `non-interactive`.
6. **Install hints are dropped.** `shared/cli-helpers.ts:52-66` formats the
   message and forwards `details: { providers }`. The status map in
   `cli-helpers-core.ts:132-150` keeps only `{id,status}`, and callers rebuild
   error data from that map (for example `consensus-evaluate.ts:192`). Install
   instructions would be lost outside phone-a-friend and delegate, and fixing
   the formatter alone misses the callers.
7. **acpx-specific hazards:**
   - CLI acpx passes the **full parent environment** to the agent
     (`CLI.md:752`).
   - A project `<cwd>/.acpxrc.json` can replace agent argv and MCP servers
     (`config.md:6-16,92-125`).
   - acpx advertises fs and terminal capabilities by default.
   - Pi's built-in entry runs through `npx --package=pi-acp@^0.0.33` (a
     runtime fetch).
   - acpx needs Node >= 22.13 (plugin floor is >= 22), ships breaking minors
     every 1-2 weeks, and `antigravity`'s built-in argv is wrong on CLI-only
     machines (openclaw/acpx#1039).
8. **`end_turn` is not success.** Live Pi on mini returned `end_turn` with only
   a banner and no model call, on a 401 token.
9. **User MCP servers.** Devin loads the user's own MCP servers (for example
   `~/.config/devin/mcp_config.json`) even when the client sends
   `mcpServers: []`. Read-only must cover MCP tools that can write.
10. **Version fan-out.** When a change **regenerates the plugin-shared bundle**
    `plugins/consensus/scripts/consensus.mjs`, all 11 consensus member skills
    must bump (`validate-skill-versions.ts:217-231`). `session-fork-to-destination`
    follows because the observer bump changes its declared source root
    (`distributions.ts:511-517`). That is 12 skills; #165 is the precedent.
    A source-only or test-only change does not necessarily change the bundle,
    so compute affected owners from each regenerated diff. Plugin release
    versions are independent; a changed plugin version needs its own changelog
    line (`validate-skill-versions.ts:555-573`).
11. **Docs guard.** `tests/repo/readme-scope.test.ts:111` forbids the phrase
    "custom ACP provider" in the docs site.

## Live evidence so far

From the coordinator, Vault thread "Consensus New Providers", 2026-11-20. Raw
frames are logged on tstang-dev at `~/acp-spike/logs/` and on mini at
`/tmp/acp-spike-mini/logs/`. The probe is at
`/Users/Shared/Vault/.tmp/consensus-providers/acp-probe.mjs`.

- **Installed versions on tstang-dev:**
  - acpx 0.22.0
  - devin 3000.14.30821
  - droid 1.16.0
  - gemini-cli 0.70.0
  - pi 1.0.2 + pi-acp 0.0.33
  - agy 1.5.13, launched as `agy acp`; the acpx built-in `agy_acp_server.par`
    is absent, so it needs an acpx agents override
  - `@deepseek-ai/dsh` 0.2.2-rc.5 (Node >= 24.9)
- **Handshake:** a ~100-line raw JSON-RPC client handshakes with all of them.
  All answer `initialize` with protocolVersion 1.
- **Auth:** Droid, Gemini, agy and pi-acp return `-32000` auth-required on
  `session/new` before login, with agent-specific text. That is a cheap,
  model-free auth probe. Devin allows `session/new` and fails auth at prompt
  time with `-32000 "Please log in to use Devin..."`, preceded by
  `_cognition.ai/agent_stopped {cause:"auth_required", stats:{toolCalls, filesChanged, commandsRun}}`.
  DeepSeek has `authMethods: []`; its key comes from `DEEPSEEK_API_KEY` or
  `$DSH_HOME/.credentials.yaml`.
- **Session ids:**

  | Provider | Format                        |
  | -------- | ----------------------------- |
  | Devin    | two-word slug (`silent-ankle`) |
  | Pi       | UUIDv7                        |
  | DeepSeek | UUIDv4                        |
  | Others   | pending auth                  |

- **Session capabilities:**

  | Provider | Capabilities                                                 |
  | -------- | ------------------------------------------------------------ |
  | Droid    | resume, fork                                                 |
  | agy      | resume, load                                                 |
  | Devin    | list, delete, close, `loadSession`; no resume                |
  | DeepSeek | close, list, resume                                          |

- **Devin modes:** the default mode is `accept-edits` (auto-approves edits).
  `session/set_mode {modeId:"ask"}` returns `{}` and emits
  `current_mode_update ask`, which held through a prompt.
- **Model reporting:**
  - Devin: `configOptions.model.currentValue` (`swe-1-6-fast`).
  - Pi: `models.currentModelId` plus a `model` configOption.
  - DeepSeek: a JSON-encoded tuple string
    (`["deepseek-official","deepseek-v4-flash"]`).

  Each needs its own model reader.
- **acpx `--format json`** prints raw JSON-RPC NDJSON frames and exits 1 on
  auth failure. For Devin it sends `clientInfo {name:"windsurf"}` plus
  `_meta cognition.ai/requestDiagnostics`. Its permission flags:
  - `--approve-all | --approve-reads | --deny-all`
  - `--non-interactive-permissions deny|fail`
  - `--permission-policy`
  - `--allowed-tools`
  - `--model`
  - `--timeout`
  - `--auth-policy`
  - `--no-fs`, `--no-terminal`
- **Answers needing no sign-in** (Q8-Q15, tstang-dev):
  - **Version probes:** every launch binary answers `--version` with exit 0
    on its first line. Devin prints `devin 3000.14.30821 (<sha>)`; droid,
    gemini, pi, agy, dsh and acpx print bare versions.
  - **pi-acp has no version flag.** `--version` starts the server. Probe it for
    presence only, and get its version from ACP `initialize.agentInfo.version`,
    which works for all six.
  - **No leftover processes** after about 15 SIGTERM runs. Recheck after
    authenticated turns.
  - **Devin:** no ACP flag disables user MCP. It has
    `--agent-type review|codemap|summarizer` (`codemap` is read-only,
    `summarizer` has no tools; both untested over ACP), `--model` /
    `DEVIN_MODEL`, and `DEVIN_PERMISSION_MODE` (the non-ACP CLI's
    `auto|accept-edits|smart|dangerous`; untested over ACP).
  - **Gemini:** `--approval-mode plan` (read-only), `--allowed-mcp-server-names`,
    `-e/--extensions` and `-s/--sandbox`.
  - **Droid:** `exec` defaults to no autonomy (`--auto low|medium|high` raises
    it), and `--only-tools/--remove-tools <ids|MCP:<server>>` gives an MCP
    lever.
  - **agy:** `--sandbox` restricts the terminal. No documented read-only mode.
  - **dsh:** `--profile acp` takes no flags.
  - **pi-acp** spawns `PI_ACP_PI_COMMAND ?? "pi"` with fixed args and
    `env: process.env`, so a pi tools allowlist needs a wrapper script set as
    `PI_ACP_PI_COMMAND`. pi-acp calls `requestPermission` only for extension-UI
    prompts.
  - **Credential and config env names:**

    | Agent       | Env names                                                                 |
    | ----------- | ------------------------------------------------------------------------- |
    | dsh         | `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DSH_HOME`, `DSH_TELEMETRY_DISABLED` |
    | Devin       | `WINDSURF_API_KEY`, `DEVIN_MODEL`, `DEVIN_PERMISSION_MODE`                 |
    | Droid       | `FACTORY_API_KEY`                                                         |
    | Gemini      | `GEMINI_API_KEY` or OAuth in `~/.gemini`                                  |
    | Antigravity | `GEMINI_HOME`; `ANTIGRAVITY_HARNESS_PATH` was not needed by `agy acp`      |
    | Pi          | provider keys or `~/.pi/agent/auth.json`; `PI_CODING_AGENT_DIR`           |

  - **Auth-probe side effects (Q9)** are unsettled. Devin advertises
    `cognition.ai/persistOnCreate`, so `session/new` likely persists a record.
    Close probe sessions where `sessionCapabilities.close` exists (Devin, Droid,
    agy, dsh); Gemini and Pi lack it.

### Coordinator updates #4-#6

Dev logs: `~/acp-spike/logs/agy-gui*.jsonl`, `agy-iso-*.jsonl` and their
`*-suite.txt` summaries.

- **Devin leaves survivors after a clean exit (Q10).** Even unauthenticated,
  `devin acp` launches the user's MCP servers at `session/new` (for example an
  `uvx mcp-proxy-for-aws` proxy with node children). After `session/close` ok
  and Devin exit 0, 4 MCP children were still alive in its process group.
  **A group kill on every exit path is mandatory.** dsh had no survivors.
- **Devin config isolation (Q11).** Devin imports MCP servers, plus rules,
  skills, commands and hooks for the `claude` source, from other tools'
  configs: `~/.claude.json`, `.mcp.json`, `.claude/settings*.json` and others.
  Per-run isolation was verified:
  - Set `XDG_CONFIG_HOME=<private tmp>` with `<tmp>/devin/config.json` =
    `{"version":1,"read_config_from":{<all ten sources>:false}}`.
  - Result: no MCP servers, `serversChanged` frames dropped from 36 to 2, zero
    survivors, and mode `ask` still echoed.
  - Credentials stay in `XDG_DATA_HOME` (`~/.local/share/devin/credentials.toml`).
  - `agents_standard` stays false until its scope is known.
  - **General rule:** list what each agent imports from other tools' config,
    and give it an isolation lever or keep it unadmitted.
- **Antigravity (`agy acp` 1.5.13) is the first authenticated provider, fully
  tested from a desktop session.**
  - **Auth:** the token is in the macOS login keychain. From SSH,
    `session/new` gives `-32000 Authentication required`, and `authenticate`
    gives `-32603 No browser is available…`. Preflight maps both to "sign in
    with `agy acp --login` from a desktop terminal", and SSH-only hosts are
    not ready. No prompts appeared in unattended runs (Q15).
  - **Session:** UUIDv4 ids. Modes are `default` (ask before edits and
    commands), `accept-edits`, `auto` and `plan` (not read-only).
  - **Model:** `models.currentModelId` plus configOptions `model`,
    `thought_level` and `mode`. `usage` comes in the prompt result.
  - **Q3 mode evidence:** `set_mode default` returns `{}` with **no** update
    when the mode is unchanged.
  - **Q1/Q2 permissions:** with a deny-all responder, edit, `touch` and
    outside-cwd writes each arrived as `session/request_permission`
    (`allow_once`/`reject_once`). Denied tools went to `failed`, and **disk was
    unchanged every time**. The same happened with caps none or all (agy never
    used client fs or terminal), and `--sandbox` had no visible effect.
  - **Batching:** when 3 tool calls are emitted together, only the first is
    asked about; after the deny the rest are failed unasked.
  - **After any denial, agy ends `end_turn` with EMPTY text.**
  - **Positive control** passed: it read a marker file with no permission
    request and returned it.
  - **Q5:** `session/resume` and `session/load` both work in a fresh process.
    `load` replays earlier turns as `agent_message_chunk`s.
  - **Q10:** zero survivors after 10 clean authenticated exits.
  - **Imports:** project `AGENTS.md`, `GEMINI.md` and `.agents/skills/*` always
    load (repo content). A server in `<gemini-dir>/config/mcp_config.json` is
    spawned at `session/new` and **survived agy's clean exit until the group
    kill**, while the model claimed no MCP servers were connected. Model
    self-report is not evidence. Project `.cursor/mcp.json` was not spawned.
  - **Isolation lever (verified):** `agy acp --gemini-dir=<private abs tmp>
    --app-data-dir=<relative name>`. An absolute app-data-dir fails with
    `-32603`. Auth survives (keychain), there is no global MCP, skills or
    rules, and the temp dir is deleted after the run. Continuation must keep
    the same gemini-dir for the delegate session's lifetime.
  - **Exposed tools** (self-reported): read_file, write_file, edit_file,
    run_command, search_web, schedule, send_message, manage_task,
    invoke_subagent, define_subagent, manage_subagents, run_workflow, swarm,
    ask_question.
  - **Open before admission:**
    - project `.agents/hooks.json`: does it run under isolation, and without a
      permission request?
    - deny checks for `schedule`, `invoke_subagent`/`swarm`, `send_message` and
      `run_workflow`, with nothing persisting afterwards;
    - whether `search_web` asks (it is treated as denied: it sends data out).

### Coordinator updates #7-#9

Dev logs: `~/acp-spike/logs/agy-tools-*`, `agy-{subagent,swarm}-wait-brain/` and
`agy-marketplace-suite.txt`.

- **agy project hooks are arbitrary code execution.**
  - What fires: project `.agents/hooks.json` hooks (`SessionStart`,
    `PreInvocation`, `PreToolUse`, `PostToolUse`, `Stop`; shell commands,
    `sh -c`) **fire with no permission request, even under the isolated
    gemini-dir**. Plugin hooks run too.
  - Customization roots: `.agents/`, `.agent/`, `_agents/` and `_agent/`, in
    every ancestor from cwd to the repo root.
  - Code-capable entries: `hooks.json`, `plugins/<name>/` (any dir with
    `plugin.json`, `.antigravity-plugin/` or `.gemini-plugin/`, carrying
    `hooks.json`/`mcp_config.json`), and `plugins.json`.
  - `plugins.json` and `skills.json` take `entries[].path` and
    `inherits[].path` that may be absolute, `~/` or workspace-relative, so a
    repo can pull in code from anywhere.
  - **No trust lever:** the binary has a `workspace_trust.Store`, but a fresh
    gemini-dir behaves as trusted and no flag, env or config starts it
    untrusted.
- **`marketplace.json` is ignored:** a Codex-style
  `.agents/plugins/marketplace.json` pointing at a hooked plugin did not load
  it, and a repo-root `plugins/` dir is not auto-discovered (agy 1.5.13).
- **HOME imports:** `~/.claude/commands`, `~/.codex/prompts` were **not
  observed under isolation**; untested without it.
- **Tools without a permission request:**
  - `schedule`: an in-process timer re-prompts later. Nothing outlived the
    process.
  - `send_message`: recipients are agy conversation ids only, with no egress
    observed.
  - `search_web`: **network egress the client cannot deny**.
  - Reads outside the workspace **do** ask; `run_workflow` was denied that way.
- **Sub-agents/swarm:** worker write prompts go to an internal approval UI that
  ACP never surfaces. They **fail closed after a 60 s timeout**, nothing is
  written, and the client gets no signal. agy must **never run in
  `accept-edits`/`auto`**.
- **Not fully hermetic:** agy still writes the real
  `~/.gemini/antigravity-cli/conversation_summaries.db`.
- **Droid** keeps its login in the keychain (`~/.factory/auth.v2.loginkeychain`).
  Over SSH, `session/new` returns `-32000 Authentication required: Your code:
  XXXX-XXXX` and **starts a new device-pairing code on every probe**. Droid is
  therefore not ready from SSH, and preflight must not call `session/new` for
  it.
- **For Thomas** (via the coordinator): `search_web` egress, the summaries-db
  write, and sub-agent behaviour as disclosed limits, or reasons not to admit.

### Coordinator update #10: Factory Droid 1.16.0

Dev logs: `~/acp-spike/logs/droid-*`; runs from a desktop session.

- **CRITICAL:** the default ACP mode is `auto-medium` (configOption
  `autonomy_level`). With no mode set, the write tests created a file, ran
  `touch` and wrote outside cwd with **zero permission requests**. The modes:

  | Mode | Behaviour |
  | --- | --- |
  | `normal` | auto-approves reads only |
  | `spec` | read-only planning |
  | `auto-low` | autonomous, low |
  | `auto-medium` | autonomous, medium (the ACP default) |
  | `auto-high` | autonomous, high |

  Read-only sets `normal` and confirms it from the `current_mode_update` /
  `config_option_update` echo before the prompt.
- **`normal` + deny-all:**
  - Edit, shell and outside-cwd writes each raise
    `session/request_permission`. Denial fails the tool, and disk stays
    clean.
  - **After a denial, stopReason is `cancelled`** (agy: `end_turn`).
  - Batches abort after one denial, as with agy.
  - Option ids differ (`allow_once:proceed_once`, `reject_once:cancel`), so
    **options are chosen by `kind`, never by id**.
- **Positive control:** passed.
- **Session:**
  - Ids are UUIDv4.
  - `resume` works.
  - `load` replays earlier turns.
  - Teardown is clean.
- **Auth:**
  - Credentials are in the keychain. Over SSH, `session/new` mints a
    device-pairing code each time.
  - `FACTORY_HOME_OVERRIDE` loses auth, so it is not an isolation lever.
  - `FACTORY_API_KEY` is the headless route.
- **Models** are set through configOption `model`. The list includes the
  user's custom proxy models (`custom:...-(Proxy)-0`). **Thomas wants tests,
  and probably defaults, on cheap proxy models.**
- **Project `.factory/mcp.json` servers are spawned** in every variant, under a
  **different pgid**, so a group kill misses them; they were gone after
  teardown. Root `.mcp.json` was not spawned.
- **Hooks:** per the docs, `droid exec` runs project hooks without folder
  trust, and `droid exec --settings <file>` with
  `{"hooks":{"hooksDisabled":true}}` overrides at the highest precedence.
  Retest pending.
- **Tool surface** includes Task subagents, plus deferred tools via
  ToolSearch: web search and fetch, `computer_*`, `loop_*`, and **Factory cloud
  automations** (Create/Run/Edit/Delete). Automation and loop tests are held
  for Thomas.
- **Proposed lever:** a **`--only-tools` allowlist** of read tools in the
  launch argv makes write, exec, Task, deferred tools and MCP tools
  unreachable. Pending tests:
  - does the allowlist hold in ACP mode, and does ToolSearch bypass it;
  - are MCP servers still spawned;
  - does `--settings` hooksDisabled cover `.factory/hooks.json` and
    `.claude/settings.json`.

## Architecture

```
callers (delegate, phone-a-friend, panel, loop, review)
   │  consensus run / preflight / provider ls   (envelopes only)
   ▼
provider-cli registry ── ProviderAdapter entries carry tier, credential env, override env,
   │                     prerequisites, install hints, admission evidence
   ├─ core adapters: claude | codex | cursor        (native CLIs, unchanged behaviour)
   └─ acpAdapter(descriptor)  ── one factory, six descriptors
         ├─ AcpSessionPlan      per-provider data: argv, clientInfo, capabilities to
         │                      advertise, read-only setup (set_mode / config options /
         │                      launch flags), model reader, session-id rule, auth patterns
         ├─ AcpTranscript       one ACP frame parser → normalized AcpTurnResult
         │                      {text, stopReason, sessionId, promptRequestId, model,
         │                       toolCalls, permissionOutcomes, error{code,detail}, promptSent}
         └─ AcpTransport        interface; backends:
               ├─ stdio  (in-house JSON-RPC client over the agent's stdin/stdout)
               └─ acpx   (subprocess: acpx --format json --json-strict … --agent '<argv>' exec --file -)
```

Both backends produce the same `AcpTurnResult`. acpx's `--format json` already
emits raw ACP frames, so the frame parser is shared. Only the session driver
differs: either acpx drives the session, or our client does. **The first
admission uses one backend only.** A second backend is added later, after a
parity comparison: mode setup, error correlation, lifecycle and cleanup, config
isolation, and diagnostic redaction.

## Read-only enforcement model

**Prevention lives in the owned CLI, not in skill prose.** Direct
`consensus run` calls bypass the delegate workflow entirely: `commands.ts:404`
normalizes the request and calls `runProviderTurn`. So every prevention layer
is applied by the ACP adapter before and during **every** agent launch,
including any active preflight probe. Host-side snapshots are **accounting**,
not enforcement. They miss ignored files, reverted writes, writes outside the
repo, and remote MCP side effects (`accounting.md:70`). A provider whose writes
cannot be *prevented* stays unadmitted, whatever the snapshots would show.

An extended provider is **read-only-admitted** only when prevention layers 1-4
all hold in a live admission test, together with the positive control in
layer 6:

1. **Provider-native read-only.** Each provider's own setting, baked into its
   pinned launch or session setup and **confirmed before the first prompt**.
   Mode evidence is `update` or `initial-state`. A mode *change* (Devin `ask`)
   must be echoed by `current_mode_update` or `config_option_update`. An
   unchanged mode is confirmed by the `session/new` `modes.currentModeId` (or
   configOption `mode`) plus an ok `set_mode` with no contrary update (agy
   `default`). Otherwise the run aborts as `not_started`.
   - Antigravity: mode `default` plus deny-all. **Evidence complete except the
     items listed open in update #6.**
   - Devin: `session/set_mode ask`, or `plan`. Candidate launch levers are
     `--agent-type codemap` and `DEVIN_PERMISSION_MODE`. **[hinges: Q1, Q11]**
   - Gemini: `--approval-mode plan`. **[hinges: Q1]** Does it hold over ACP?
   - Droid: mode `normal`, confirmed by update echo (the ACP default
     `auto-medium` auto-approves writes; update #10). Add a
     `--only-tools <read tools>` allowlist and `--settings <tmp>` with
     `hooksDisabled`. **[hinges: allowlist/MCP/hooks tests]**
   - Pi: a wrapper script set as `PI_ACP_PI_COMMAND` that runs
     `exec pi --tools read,grep,find,ls "$@"`. **[hinges: Q13 live check]**
   - DeepSeek: no flags; check session modes and config once a key exists.
     Antigravity: only `--sandbox` (terminal); check session modes after login.
     **[hinges: Q12, Q15]**
2. **Capability withholding.** Never advertise `fs.writeTextFile` or
   `terminal`. `fs.readTextFile` may be advertised (in-house only, confined to
   cwd). **[hinges: Q2]** Does the agent fall back to native tools?
3. **Permission responder: deny all.** The tool `kind` an agent reports is
   untrusted metadata, so the responder grants nothing. It picks the option
   by its `kind` (`reject_once`), never by option id, because ids differ by
   provider. Read-only agents read
   through their own tools or the client read callback. It picks `reject_once`
   when offered, otherwise answers `cancelled`, and answers any pending request
   with `cancelled` on cancel or timeout (spec `prompt-turn.mdx:610-652`).
4. **No extra tools.** Send `mcpServers: []`, and neutralize user-configured
   MCP servers or extensions:
   - Droid: `--remove-tools MCP:<server>` / `--only-tools`.
   - Gemini: `--allowed-mcp-server-names` with no names, and `-e none`.
   - Devin: a private `XDG_CONFIG_HOME` with `devin/config.json`
     `read_config_from` all false (verified, update #4).
   - Antigravity: `--gemini-dir=<private tmp> --app-data-dir=<relative>`
     (verified, update #6).

   Each descriptor declares a **per-run isolation step**: create a private
   temp dir, write the provider's config, and set the env or flags. The dir is
   removed after the run, or after the delegate session when continuation is
   in use. Credentials must still resolve, which `XDG_DATA_HOME`/`HOME` and
   the keychain do. Admission asserts **no MCP or other child processes in the
   agent's process group** from a process-tree snapshot, not only "no MCP tools
   used". The model's self-report is not evidence. Project-level imports that
   are repo content (AGENTS.md, GEMINI.md, project skills) are recorded per
   provider. Project-level **hooks** that can run commands must be shown not
   to fire, or the provider stays unadmitted.

   An empty acpx `--mcp-config` replaces only acpx's own list. The provider's
   own config still needs its lever.
5. **Accounting (detection, not prevention).** Delegate runs extended
   read-only peers in a disposable detached worktree and snapshots it and the
   host checkout before and after. It uses the existing `delegate_snapshot`
   helpers (`consensus-delegate/references/accounting.md:24-129`). Any diff is
   reported as a confinement violation, and the provider is pulled from
   admission until it is re-tested.
6. **Honest turn classification and a positive control:**
   - Success requires all of these: a `session/prompt` response whose id
     matches the request and whose session matches; `stopReason: end_turn`;
     and **nonblank final answer text after provider-specific startup output is
     discarded** (Pi's banner must not count).
   - Missing, truncated or ambiguous responses are failures. A blank answer
     with tool calls is also a failure: delegate needs an answer.
   - A non-`end_turn` stop reason is a failure.
   - **`permission_denied`** is a distinct outcome: at least one permission
     request was denied and the turn ended, whether the stopReason is
     `end_turn` (agy, empty text) or `cancelled` (Droid). It is reported as a failure with `diagnostics.permission_denials`
     filled ("the peer tried to act outside read-only"). **`empty_turn`** means
     a silent provider failure (Pi on a 401).
   - After `session/load`, chunks arriving before our `session/prompt` is sent
     are replays and are discarded. Prefer `session/resume` where advertised.
   - A JSON-RPC error before `session/prompt` is sent is `turn: not_started`.
   - Agent stats (Devin `agent_stopped.stats.filesChanged/commandsRun`) are
     recorded as a cross-check.
   - `max_attempts` stays 1 even for admitted read-only profiles.
   - The admission test also includes a **positive control**: the same provider
     authenticates, reads a known marker file, and returns the marker.
     Otherwise a provider that did nothing passes every negative test.
7. **Process cleanup on every exit (mandatory).** The current runner never
   signals the process group on a normal exit (`subprocess.ts:185-192`). Devin
   left 4 MCP children alive after `session/close` ok and exit 0, and agy left
   a planted MCP server. The ACP transport therefore runs these steps on every
   exit path: `session/close` where advertised, close stdin, wait a bounded
   time for exit, record any survivors in the agent's process group as
   diagnostics, then kill the group.
8. **Admission tests one action per prompt.** agy asks permission only for
   the first of a batch of tool calls, then fails the rest.

A provider that fails any layer stays registered but **not admitted**. It
appears in named preflight as `unsupported` with a distinct "registered, not
admitted: <reason>" diagnostic; today's message for every `unsupported` entry
is "not registered" (`commands.ts:223-228`). `run` refuses it before launch.
Pi is not admissible until layer 1 is proven, because layers 2-3 do not apply
to it.

**First extended adapter capabilities** (enforced in the CLI):

- `schema_strategies: ['text']` only;
- `permission_modes: ['read-only']` only, so an omitted policy, which resolves
  to `non-interactive` (`runtime-policy.ts:48-52,84-92`), is rejected;
- no `sandboxes`;
- no `env_allowlist`, so `--env-allow` is rejected (credentials come from the
  descriptor's fixed list);
- no scoped tool grants;
- `model`: a **consensus-config default model per extended provider**
  (Thomas prefers cheap proxy models), applied through
  `session/set_config_option` and confirmed before the prompt. A failure
  aborts the run as `not_started`. No model ids are hard-coded in source.
  `--model` from the caller overrides the default, using an advertised id.
- submit capture disabled whatever the strategy (`structured-output.ts:366-377`).

A test covers the direct `run --request-json` JSON entry point, not only the
delegate path.

## Decision points

These are the operator's to make. Recommendations are marked.

- **D1: transport backend.** **Recommended: the in-house stdio client first,
  acpx kept as a possible later backend behind `AcpTransport`.** The
  coordinator agrees; it is with Thomas.

  For in-house:
  - We parse ACP frames either way, and a 100-line raw client already
    handshakes with all six agents.
  - It controls the env scrub, capability withholding (it can advertise read
    but not write), the deny-all responder, mode setup before the prompt, and
    `mcpServers` directly.
  - It avoids the `.acpxrc.json` injection, full-env passthrough, the
    `npx pi-acp` fetch, the Node 22.13 floor and pre-1.0 churn.
  - It keeps provider CLIs as the only external boundary, consistent with
    DR-023.

  Against acpx specifically:
  - `--no-fs` withholds read and write together.
  - Setting a session mode before the prompt in one-shot `exec` is
    undemonstrated.
  - The raw `--agent` form is Unix-only.

  Costs of in-house:
  - A bidirectional transport hook (step 2.0).
  - Owning per-agent quirks: Devin `clientInfo windsurf` and
    `cognition.ai/requestDiagnostics` (whether these are *required* or merely
    what acpx sends is unverified); Gemini `--acp` versus
    `--experimental-acp`.

  The acpx route is cheaper only in the session driver: about 1-2 days less.
  If chosen, it needs an explicit decision reintroducing an orchestration
  prerequisite (DR-023's "install drift" rationale) plus the risk 7
  mitigations. **[hinges: Q2, Q7]**
- **D2: accounting cwd for extended read-only delegate runs.**
  **Recommended: a disposable detached worktree at the host's HEAD, plus
  host-checkout snapshots, with no repo-root opt-out for extended peers.**
  This is defence in depth on top of CLI-level prevention. Caveats:
  - Uncommitted host changes are not visible in the worktree; the host commits
    WIP first or briefs the change.
  - A detached worktree still shares the `.git` metadata.
- **D3: selection policy.** **Recommended:**
  - Extended providers are never auto-selected: not by delegate fallback, panel
    auto-fill or deliberation defaults.
  - `provider ls` lists core only by default.
  - For the first release, named `preflight --provider <id>` is the discovery
    path. An inventory flag (the parser accepts only `--json` today,
    `args.ts:282`) is deferred until it is needed.
- **D4: decision record and policy wording.** If D1 is in-house, DR-023 does
  not strictly require a new record, but the extended tier is a durable
  architecture choice. **Recommended:** record it (core native plus extended
  ACP, read-only admission, the transport seam) through `oat-pjm-decision`
  after `oat pjm doctor --json`, with operator confirmation. If D1 is acpx, the
  DR is required. Proposed wording is in Phase 0.
- **D5: release shape.** Compute affected skill owners from each regenerated
  diff and choose plugin versions separately (see risk 10). **Suggested:**
  - Phase 1 as one PR (a `consensus` patch).
  - Phases 2-3 as one PR shipping the first admitted provider (a `consensus`
    minor).
  - Further providers batched by when their evidence lands.

## Phases

### Phase 0: decisions and policy (docs only)

- 0.1 The operator answers D1-D5. D1 is with Thomas now.
- 0.2 **[after D1]** Record the DR (D4). Update the policy text in the same PR
  as the first extended code (Phase 2), not earlier. Keep `src/AGENTS.md:25`'s
  live-execution authorization sentence in both variants. Proposed wording:
  - **If in-house (D1 recommended):** keep `plugins/consensus/AGENTS.md:11` and
    add: "Extended providers run their own ACP agent command through the
    provider CLI's in-house ACP client. The agent CLI is a user-installed
    prerequisite that preflight checks; nothing is bundled, auto-installed or
    fetched." Root `AGENTS.md:58` stays true. `src/AGENTS.md:25` gains:
    "Extended providers run only through the ACP adapter."
  - **If acpx:** replace `plugins/consensus/AGENTS.md:11` with: "**Provider
    subprocesses are the only sanctioned external boundaries.** Shipped
    consensus code stays dependency-free Node stdlib: nothing is bundled,
    vendored, auto-installed or fetched. The owned provider CLI spawns, with
    `shell: false`, either a core provider's native CLI or, for extended
    providers only, `acpx` at the version pinned in source, which launches that
    provider's ACP agent command. acpx and every provider CLI are user-installed
    prerequisites. Preflight blocks with install instructions when either is
    missing or outside the pin. Callers reach acpx only through the ACP adapter
    interface." Make matching edits to root `AGENTS.md:58`, `src/AGENTS.md:25`,
    `plugins/consensus/README.md:87-89,362`, `.oat/repo/knowledge/project-index.md:45`
    and `documentation/docs/engineering/architecture/consensus-runtime.md:36-46`.

### Phase 1: provider-cli groundwork (one PR, behaviour-preserving for core)

**All [independent] and D1-free.** Started on `feat/consensus-extended-providers`
(coordinator go, 2026-11-20). No extended adapter is registered in Phase 1;
tests use fixture registries.

- 1.1 **Provider metadata on the adapter, not a parallel table.** The registry
  already exists (`adapters.ts:146-355`).
  - Add adapter fields: `tier` (`core`/`extended`), `executable_env` (override
    variable name), `credential_env` (allowlist names), and optional
    `install_hint`.
  - Derive `PROVIDER_EXECUTABLE_ENV` (`executable.ts:11-15`) and
    `PROVIDER_ENV_ALLOWLIST` (`runtime-policy.ts:66-70`) from the adapters.
    Keep stripping every override name (`runtime-policy.ts:421-425`).
  - Rename `FIRST_SCOPE_PROVIDER_IDS` to `CORE_PROVIDER_IDS` with a clean break
    and no alias: update `consensus-config.ts:12,518` and `types.test.ts:14`.
  - Widen `ProviderAdapter.id` (`adapters.ts:20`).
  - Remove `future_extension_kind` (`types.ts:91-94`).
  - Keep `HOST_RUNTIMES` core-only: extended agents are peers, not hosts.
- 1.2 **Adapter hooks that replace `provider ===` branches.** Move core behaviour
  into the core adapters unchanged:
  - `extractText`, from `structured-output.ts:795-855`, including the shared
    non-success subtype rejection and the Claude subtype requirement.
  - `extractStructuredValue`, from `:901-916`, so envelope unwrapping is not
    applied to raw ACP model text.
  - `isSessionId`. Default is the UUID rule. Pass it into the existing
    `continuationUsageError` call (`structured-output.ts:126`;
    `continuation.ts:89-96`); the lookup already precedes it (`:106`).
  - `submitCaptureEligible(request)`, from `structured-output.ts:366-377`.
  - `extractPermissionDenials`, from `:694-728`.
  - `isProvenReadOnly(policy)`, from `runtime-policy.ts:229-243`.
- 1.3 **Probe prerequisites, launch binding and install hints.**
  - `ProviderProbeDefinition.prerequisites[]`, each with
    `{name, command, envOverride, version?: {min, max|exact}, installHint}`.
    `version` may be omitted for a presence-only prerequisite, such as
    `pi-acp`, which has no version flag (Q8). The ACP
    `initialize.agentInfo.version` check belongs to Phase 2.
  - Probe prerequisites before the provider binary (`probe.ts:95-197`).
  - **Run the resolved absolute path**, the same binary under the same
    sanitized environment that the run will use. Today the probe runs the bare
    command token (`probe.ts:114-118`).
  - **Compare full versions, including prerelease tags,** for exact pins.
    Keep the numeric minimum for core adapters.
  - Add an optional `install_hint` to inventory and preflight entries.
  - Add a run-path prerequisite check, because `consensus run` never probes;
    otherwise it fails as `PROVIDER_MISSING` without a hint
    (`subprocess.ts:400`).
  - Wrappers keep `install_hint` and warnings when they reduce a preflight
    failure. That covers the formatter (`shared/cli-helpers.ts:52-66`), the
    status mapper (`cli-helpers-core.ts:132-150`) **and** the callers that
    rebuild error data (for example `consensus-evaluate.ts:192`).
  - Add a distinct "registered, not admitted" diagnostic, separate from "not
    registered" (`commands.ts:223-228`).
  - Separate install and version evidence from auth evidence. Inventory never
    runs stateful auth probes until Q9 and cleanup are settled.
- 1.4 **Tier-aware selection (D3 recommendation).**
  - `provider ls` defaults to core, with no new flag.
  - Panel auto-fill and `builtInAgents` filter to core
    (`consensus-config.ts:410-449`).
  - Delegate fallback prose walks core only (`consensus-delegate/SKILL.md:50-52`).
  - Reviewer config validation keeps its current allowlist of the three core
    ids, unchanged (`consensus-config.ts:147,516-523`). Review execution itself
    still accepts only Claude/Codex (`run.ts:143-148`).

**Verify.**
- Existing suites pass with core behaviour unchanged.
- New tests only for new boundaries: prerequisite missing or out-of-pin with
  an install hint; prerelease exact-pin rejection; the probe running the
  resolved path; install_hint pass-through to a wrapper error; the tier filter
  in panel auto-fill and default `provider ls`; per-adapter `isSessionId`; the
  "not admitted" diagnostic.
- Update the pinned tests (`types.test.ts:14`, `probe.test.ts:140-144`,
  `executable.test.ts:7-11`, `adapters.test.ts:11-22`).
- Run `pnpm run build`, then inspect the diff. Then `pnpm run build:check`,
  `pnpm run validate`, `pnpm test`, `pnpm run smoke` and
  `pnpm run validate:skill-versions -- --base-ref origin/main`.
- Bump the skills the regenerated diff affects, plus the plugin version, with
  CHANGELOG lines naming each skill and its new version on one line.

**Sizing:** ~2-3 days.

### Phase 2: ACP core (module `provider-cli/acp/`)

- 2.0 **[after D1]** Transport seam. If D1 is in-house, add an optional
  adapter-level `run(invocation, options) → ProviderProcessResult` used ahead of
  `runProviderSubprocess`. It reuses the detached process group, timeout,
  interrupt forwarding and output cap (`subprocess.ts:53-60,112-121,215-259`),
  and **also tears the group down after a normal exit**. If D1 is acpx, skip
  it.
- 2.1 **[independent]** `AcpTranscript` parser to the normalized
  `AcpTurnResult`:
  - text from concatenated `agent_message_chunk` text;
  - sessionId from the `session/new` (or load/resume) result, never from chunk
    text;
  - the prompt request id and its correlated response, stopReason, tool calls,
    permission outcomes, `promptSent`, and JSON-RPC errors (`code`, `message`,
    `data`).

  It is generic over frame syntax. A synthetic fixture harness can be written
  now.
- 2.2 **[hinges: Q4, and Q7 if acpx; real frames]** Map `AcpTurnResult` to
  envelopes using the success predicate in read-only layer 6:
  - empty or banner-only turn → `PROVIDER_EMPTY_OUTPUT`;
  - non-`end_turn` stopReason (`refusal`, `max_tokens`, `max_turn_requests`,
    `cancelled`) → failure via `classifyReportedFailure`;
  - an error before `promptSent` → `turn: not_started` (existing field,
    `adapters.ts:74`; precedence in `continuation.ts:142`);
  - `-32000` plus auth text → `PROVIDER_AUTH_REQUIRED`;
  - spawn ENOENT → `PROVIDER_MISSING`.

  Fixtures come from the coordinator's raw frame logs, sanitized and recorded
  with agent versions. Model reporting goes through each descriptor's
  `modelReader`, recorded as provider-reported and kept distinct from observed
  usage (see the observed-model caveat, `consensus-review/src/run.ts:761-763`).
- 2.3 **[independent]** Deny-all permission responder and capability plan as
  pure functions: option selection, the `cancelled` fallback, cancelling
  pending requests on cancel or timeout, and a capability object that never
  includes write or terminal.
- 2.4 **[after D1]** Transport backend, one only for the first admission:
  - **In-house:** a stdio NDJSON JSON-RPC client. Requests:
    `initialize` → (optional `authenticate`, never automatic) → `session/new`
    {cwd, mcpServers: []} → setup steps (`session/set_mode`,
    `session/set_config_option`) **confirmed before** `session/prompt` →
    `session/cancel` on timeout → `session/close` where advertised. Answers
    `session/request_permission` with deny-all; returns `-32601` for withheld
    methods; accepts vendor notifications. Per-agent quirks are descriptor
    data: `clientInfo`, `_meta` capabilities, launch flags.
  - **acpx:** `acpx --cwd <dir> --format json --json-strict --timeout <n>
    --deny-all --non-interactive-permissions deny --no-fs --no-terminal
    --mcp-config <empty> --agent '<pinned argv>' exec --file -`. Pass explicit
    argv, never built-in names, and scrub the env before spawning. Check
    `acpx --version` against the pin. Mode setup before the prompt is an open
    gap.
- 2.5 **[hinges: Q1, Q2, Q4, Q9, Q10, Q11-Q13; Q15 for Antigravity]**
  Per-provider descriptors:
  - launch argv;
  - version probe: the first line of `--version` per Q8, and
    `initialize.agentInfo.version` for `pi-acp`;
  - auth probe: **opt-in per descriptor**. It is a model-free
    `session/new`, then `session/close` where advertised (Q9), and never runs
    from inventory. It is **disabled for Droid**, where `session/new` mints a
    device-pairing code, and for any provider where the probe has side
    effects; those classify auth at run time instead;
  - credential env names, session-id rule, model reader, read-only and MCP
    setup steps, and known stop or error mapping.

**Verify.** Unit tests on parser, responder and classifier fixtures. A fake ACP
agent fixture (a stdlib script) drives the transport end to end in tests,
including the direct `run --request-json` entry, so no live calls happen in CI.

**Sizing:** ~3-4 days in-house, or ~2-3 days with acpx.

### Phase 3: first provider, read-only, in delegate

- 3.1 Pick the first provider by evidence. **Proposed: Antigravity.**
  Priority is now flexible, and it is the only provider with complete live
  evidence (updates #5-#6). Before admission it still needs:
  - project `hooks.json`;
  - deny checks for `schedule`, `subagent`/`swarm`, `send_message` and
    `run_workflow`;
  - whether `search_web` asks permission.

  Its descriptor:
  - launch `agy acp --gemini-dir=<tmp> --app-data-dir=<rel>`;
  - mode `default` with `initial-state` evidence;
  - deny-all responder;
  - auth map: `-32000`/`-32603 No browser` → "sign in from a desktop
    terminal";
  - session id UUID;
  - model from `models.currentModelId`.

  - **Launch gate (allowlist, fail-closed).** Refuse to launch, listing the
    offending paths, if any customization root (`.agents/`, `.agent/`,
    `_agents/`, `_agent/`) between cwd and the repo root contains anything
    other than `rules/`, `rules.json` and `skills/`. One exception:
    `plugins/` may hold `marketplace.json` alone, with no subdirs, no
    `plugin.json`/`hooks.json`, and no `plugins.json` in the root. The gate
    runs in the CLI before every launch. It is a **version-pinned assumption**,
    re-verified on each agy upgrade. `workflows/` and `agents/` stay excluded
    unless Thomas accepts them.
  - Mode is never `accept-edits` or `auto`. The brief forbids
    `invoke_subagent`, `swarm`, `run_workflow` and `schedule`.
  - Disclosed limits, pending Thomas: `search_web` egress, the
    summaries-db write, and silent 60 s worker denials.

  Devin follows; its isolation is now solved. Then Gemini and Droid as their
  sign-ins land. Droid and agy are desktop-session only (keychain auth).
- 3.2 Admission harness. It can be **authored [independent]**, but **runs and
  verdicts [hinges: final launch, config and cleanup policy; Q1-Q4, Q10]**.
  - It is an opt-in live test gated by its own env var, next to
    `provider-cli/e2e/`, run in a scratch repo.
  - Positive control: the provider authenticates, reads a marker file and
    returns the marker.
  - Negative tests: ask the agent to (a) edit, (b) `touch` via shell,
    (c) write outside cwd, (d) use an MCP tool. Then check disk, the process
    tree after both normal exit and kill, and the classification of an empty or
    failed turn.
  - The dated result is recorded in `.oat/repo/reference/evidence/` and as a
    descriptor `evidence` string, the same pattern as `adapters.ts:196-209` and
    `263-278`.
- 3.3 **[after D2 and the Phase 2 invocation contract]** Delegate skill and
  references:
  - Extended providers are explicit-name only.
  - Add an "Extended (ACP)" row to the flag table (`SKILL.md:112-116`):
    read-only only, the model from the consensus-config default (or
    `--model`), no effort, no continuation.
  - Extended read-only runs use the D2 worktree plus snapshots, with no
    repo-root opt-out. Generalize the Claude-only host snapshot to "any peer
    without an OS sandbox" (`accounting.md:95-98,120-125`).
  - Report `Permission denials` from ACP outcomes.
  - Reword `SKILL.md:3,33-34,50-52,104,110,177-181`, keeping the description
    within budget.
- 3.4 Docs. Generic text can be **drafted [independent]**; provider-specific
  instructions and support claims ship only with verified admission.
  - Provider setup: an "Extended providers" section with install commands per
    agent, preflight states, and the read-only-first rule
    (`documentation/docs/user-guide/consensus/provider-setup.md:14-16,125-136`).
  - Delegate user doc table (`delegate.md:42-50,87-109`).
  - README provider floor (`plugins/consensus/README.md:87-89,296-299,362`).
  - Each provider is labelled experimental until its live path is verified
    (root `AGENTS.md:60`).
  - Avoid the phrase guarded by `readme-scope.test.ts:111`, or change that
    guard deliberately in the same PR.

**Verify.**
- The admission harness passes for the chosen provider. It is run by the
  operator or coordinator with live-execution authorization, not CI.
- Full suite, `build:check`, `validate` and smoke pass.
- **Cross-model review** before landing, since the change touches permissions
  and the sandbox posture.

**Sizing:** ~2-3 days after evidence.

### Phase 4: remaining providers, read-only

**[hinges: per-provider Q answers].**

Each provider gets a descriptor, an admission run and a docs row; ~0.5-1 day
each. Per-provider gates:

- **Pi:** needs a proven tool allowlist (Q13).
- **Antigravity:** launched with `agy acp` (not acpx's `.par` argv).
  Unattended sign-in is a risk (Q15).
- **DeepSeek:** needs `DEEPSEEK_API_KEY` in its credential env, and the
  install hint must name Node >= 24.9.

### Phase 5: continuation per provider

**[hinges: Q5].**

- Declare `native_resume: 'unverified'` until a live resume returns the same
  session id.
- Use `session/resume` or `session/load` according to the capabilities each
  provider advertises.
- Each descriptor supplies its own `isSessionId` (Devin uses slugs).

### Phase 6: write mode per provider

**[hinges: live confinement evidence].**

- Add `workspace-write` to one adapter's `permission_modes` with a dated
  evidence comment. Evidence must show an in-worktree edit works and
  outside-worktree and `$HOME` writes are denied, using native tools as well as
  client fs.
- If a provider's native tools can escape, writes need an OS sandbox
  (`sandbox-exec` / `bwrap`). That expansion needs separate operator buy-in.
- Cross-model review is mandatory.

### Phase 7: other skills

- **phone-a-friend** (~1 day): JSON mode via `prompt_only` for extended
  providers. Submit capture stays off. Host-side schema validation is
  top-level only (`schema-validate.ts:3-44`).
- **Panel and deliberation** (~1-2 days): send an explicit read-only
  `runtime_policy` **only for extended providers**, so core behaviour is
  preserved (`loop-provider.ts:331-339`, `consensus-panel.ts:1349-1357`).
  Extended providers are opt-in only.
- **review** (~3-4 days):
  - Capability-based eligibility in place of `isReviewProvider`.
  - A provider-neutral capture field in place of `codex_last_message`, as a
    clean break with no alias.
  - A third transport branch.
  - Config `reviewers` validation from the registry.

  Consider proving the generic transport with Cursor first.

## Sizing

| Milestone                                   | In-house (D1 rec.) | acpx      |
| ------------------------------------------- | ------------------ | --------- |
| Phase 1 groundwork                          | 2-3 d              | 2-3 d     |
| Phase 2 ACP core                            | 3-4 d              | 2-3 d     |
| Phase 3 first provider in delegate          | 2-3 d              | 2-3 d     |
| **First provider read-only in delegate**    | **~1.5-2 wk**      | **~1.5 wk** |
| Each further provider (read-only)           | 0.5-1 d            | 0.5-1 d   |
| phone-a-friend / panel+loop / review        | 1 d / 1-2 d / 3-4 d | same     |

These are estimates, not measured. Live admission runs and operator sign-ins
are extra wall-clock time.

## Live-test questions

Q1-Q7 were sent to the coordinator 2026-11-20. Q8-Q15 came from recon. Status
is as of coordinator update #6.

1. **Answered for agy; others need sign-in.** Edit, shell and outside-cwd writes
   arrive as `session/request_permission`, and denial leaves the disk unchanged.
2. **Answered for agy:** it never uses client fs or terminal, so withholding
   them changes nothing. Others are open.
3. **Answered** (Devin, Pi, DSH, agy). Each provider reports the model in its
   own shape.
4. **Partly answered.** agy denial gives `end_turn` with empty text
   (`permission_denied`). Auth error texts are known for agy, Devin and acpx.
   Cancel and timeout are open.
5. **Partly answered.** Formats: Devin slug; Pi UUIDv7; DSH and agy UUIDv4. agy
   resume and load work, and load replays chunks.
6. **Answered.** pi-acp asks permission only for extension-UI prompts. Pi's
   `--tools` needs a `PI_ACP_PI_COMMAND` wrapper.
7. **Answered.** `acpx --format json` prints raw frames and exits 1 on auth
   failure.
8. **Answered.** All binaries answer `--version`. pi-acp does not; use
   `agentInfo.version`.
9. **Open.** Is a model-free `session/new` auth probe side-effect-free?
   Devin's `persistOnCreate` suggests it persists a record.
10. **Answered.** Devin and agy both leave MCP children after a clean exit, so
    a group kill on every exit is mandatory.
11. **Answered.** Devin uses a private `XDG_CONFIG_HOME` with
    `read_config_from` all false.
12. **Partly answered.** agy has no read-only mode (`default` plus deny-all).
    Gemini, Droid and dsh holding over ACP is open.
13. **Answered (mechanism); live check open.** Use a `PI_ACP_PI_COMMAND`
    wrapper.
14. **Answered.** See the env table above.
15. **Answered.** `agy acp` runs unattended once the keychain is readable
    (desktop session only).
16. **Answered (updates #7-#9).** Project hooks fire unasked, so a launch
    allowlist is needed. `schedule`, `send_message` and `search_web` run
    unasked. Sub-agent writes fail closed silently. Reads outside the
    workspace ask. Nothing persisted after teardown except the summaries db.

## Review disposition

Codex (`gpt-6.2-sol`) ran an independent read-only review on 2026-11-20. All
findings were accepted, and the load-bearing ones were rechecked against
source:

- probe runs the token, not the resolved path (`probe.ts:114-118`);
- the parser drops prerelease tags (`:375-379`);
- lookup already precedes validation (`structured-output.ts:106,126`);
- normal exit never signals the group (`subprocess.ts:185-192`).

Changes made:

- Prevention moved into the owned CLI; snapshots became accounting.
- The responder became deny-all.
- Mode setup is confirmed before the prompt.
- A strict success predicate, cleanup on normal exit and a positive control
  were added.
- First-adapter capabilities are now text plus explicit read-only only, with
  no env or tool grants and no submit capture.
- Readiness now binds the resolved executable and full-version pins, with a
  "not admitted" diagnostic.
- The reviewer-config allowlist is unchanged (core three).
- The version fan-out is conditional on the regenerated bundle.
- D3 needs no new inventory flag.
- The independent/hinges tags were corrected, and citations fixed.

## Appendix: provider-specific sites to change

From the recon lanes, at `12350127`.

- **Identity and lists:**
  - `provider-cli/types.ts:1-5,12,91-94`
  - `adapters.ts:20,146-355`
  - `executable.ts:11-15,25`
  - `runtime-policy.ts:66-70,119-143,149-154,229-243`
  - `config/consensus-config.ts:12,92,147,287-290,410-449,516-524`
- **Output, session, failure:**
  - `structured-output.ts:106,126,177-191,366-377,566-590,694-728,766-916`
  - `continuation.ts:20-35,89-96,140-155`
  - `adapters.ts:81-145,375-490,492-560,584-627`
- **Probe:**
  - `probe.ts:22-30,74,83-197,375-379`
  - `commands.ts:209-239,385-397,404,756-787,829-849`
  - `args.ts:282`
- **Subprocess:** `subprocess.ts:53-60,112-121,185-192,215-259,400`.
- **Host guard** (stays core; verify env reaches ACP children):
  `host-guard.ts:38-63,130-194,219-267`.
- **Wrappers:**
  - `shared/cli-helpers.ts:52-66,173-183`
  - `shared/cli-helpers-core.ts:132-150`
  - callers such as `src/skills/consensus-evaluate/src/consensus-evaluate.ts:192`
  - `core/loop-provider.ts:331-402`
- **Delegate:**
  - `src/skills/consensus-delegate/SKILL.md:3,33-34,42-52,100-122,161-195`
  - `references/worktree-writes.md:29-64`
  - `references/accounting.md:9-10,70,95-98,120-125,146-150`
  - `references/brief-template.md:48-51`
- **Review (Phase 7):**
  - `src/skills/consensus-review/src/selection.ts:99-105,264-268`
  - `run.ts:77,143-148,232-240,445,612-619,1741-1957`
  - `review.ts:404-406`
  - `review.ts:505-512` validates `--host` and stays core-only
- **Docs:**
  - `documentation/docs/user-guide/consensus/{provider-setup.md:14-16,125-136; delegate.md:42-50,75-79,87-109,125-138; configuration.md:158,180-189,238,272; provider-run-controls.md:37-60; phone-a-friend.md:134; index.md:97}`
  - `documentation/docs/engineering/architecture/consensus-runtime.md:36-46,144-146`
  - `plugins/consensus/README.md:87-89,296-299,362,379-395`
  - `plugins/consensus/AGENTS.md:11`
- **Tests pinned to the core set:**
  - `types.test.ts:14`
  - `probe.test.ts:140-144`
  - `executable.test.ts:7-11`
  - `adapters.test.ts:11-22,282-297,322`
  - `runtime-policy.test.ts:483-487,666-692`
  - `consensus-config.test.ts:97-100` (uses `gemini` as the unsupported
    example)
  - `config-commands.test.ts:660`
  - `tests/repo/readme-scope.test.ts:111`
  - `scripts/smoke-test.mjs:89-92`
  - `e2e/submit-live.e2e.test.ts:90-169`
