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
> Status: **Phases 1-3 implemented on `feat/consensus-extended-providers` (rebased onto PR #170): in-house ACP client; antigravity, gemini and droid admitted read-only after live smoke tests on 2026-11-21 (`.oat/repo/reference/evidence/2026-11-21-extended-provider-smoke.md`); cross-model (Codex) review and two re-checks; Devin, Pi and DeepSeek not started**.. Steps tagged
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
- starts **read-only**, admitted one provider at a time after one live smoke
  test (it answers, and a read-only run leaves files untouched). Write mode
  follows later, one provider at a time, after a write smoke test in the
  delegate worktree and a cross-model review;
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
- Read-only first. Writes come per provider after a write smoke test.
- `delegate` first.

Thomas's decisions (coordinator update #13, 2026-11-20):

- **Core security fix:** approved for read-only profiles only, as a separate PR
  ahead of this work (`fix/consensus-read-only-repo-config`). Write runs keep
  loading repo config. Cross-model review is required, and there is no merge
  without Thomas.
- **Antigravity:** all three limits are accepted and must be disclosed:
  `search_web` egress, the write to the real
  `~/.gemini/antigravity-cli/conversation_summaries.db`, and the brief clause
  banning `invoke_subagent`, `swarm`, `run_workflow` and `schedule`.
- **Droid:** nothing may run in the Factory cloud, and its cloud tools are
  never tested live. The admission terms are in update #15 below.
- **DeepSeek:** test only through its own harness (`dsh`), never through
  Droid's proxy model. Deferred, so it stays registered, not admitted.

Thomas's safety posture (coordinator update #15, Stoa decision `ee3117f3`,
2026-11-21). It replaces the stricter posture in the earlier updates:

- **Guard only three things:** a read-only run does not change the working
  tree; nothing causes unexpected cost or leaves cloud or recurring jobs
  running; credentials stay out of logs and chat.
- **Not gated:** repo hooks and MCP servers, Claude's auto-mode classifier,
  web search, sub-agents and folder trust. They are his own config.
- **Admission is one smoke test per provider:** it answers, and a read-only
  run leaves files untouched. No layered battery, launch gates or
  process-tree MCP checks, unless one is the only way to make a run
  read-only (as Gemini's in-session `set_mode plan` is). The light checks
  that stay: deny-all, mode confirmation and group kill.
- **Droid is admitted over ACP:** `normal` mode, the deny-all-by-kind
  responder, the model set through config, and one brief line telling it
  not to use its `loop_*`, ConnectApp or cloud/`computer_*` tools. No
  stream-jsonrpc adapter, no airgap env, no launch gate.
- **Gemini CLI:** keep `set_mode plan`; no untrusted-folder requirement.
- **Antigravity:** the accepted limits above stay as they are.
- **Read-only Claude:** unchanged. It keeps shell; no `--tools` restriction
  and no `useAutoModeDuringPlan` override.
- **Deliberation skills:** no read-only follow-up PR for the core loop paths.
- **PR #170** is unchanged and waits for Thomas's merge.

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
   write and exec locally and never asks. Read-only therefore rests on the
   **provider-native mode** first, with deny-all as the second control.
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
   `mcpServers: []`. Under the update #15 posture these are the operator's
   config and are not isolated; only their leftover processes matter (group
   kill).
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

Evidence is kept as recorded. Where an update below concludes that a gate,
isolation step or launch allowlist is required, that conclusion is
superseded by the update #15 posture (see "Decisions in force"); the
observations still stand.

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
  - ~~**General rule:** list what each agent imports from other tools' config,
    and give it an isolation lever or keep it unadmitted.~~ Superseded by
    update #15: imports are the operator's config.
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
    rules, and the temp dir is deleted after the run. (Update #15 drops this
    as an isolation step; a gemini-dir is still used for API-key mode, see
    Phase 3.1.)
  - **Exposed tools** (self-reported): read_file, write_file, edit_file,
    run_command, search_web, schedule, send_message, manage_task,
    invoke_subagent, define_subagent, manage_subagents, run_workflow, swarm,
    ask_question.
  - ~~**Open before admission:**~~ Answered in updates #7-#9; no longer
    admission gates under update #15:
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
- **Thomas accepted** (update #13) `search_web` egress, the summaries-db write,
  and the brief clause on sub-agents as disclosed limits.

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

### Coordinator update #11: Droid round 2-3

Every run used `normal` (echoed), deny-all, and the model pinned to
`custom:GPT-6-Luna-(Proxy)-0` with `set_config_option`.

- **`--only-tools` is ignored in ACP mode.** Write and shell attempts used
  `Execute`, which raised `request_permission`; denial gave `cancelled` and a
  clean disk. The permission layer is what holds.
- **ToolSearch** surfaces deferred tools, but **WebSearch and FetchUrl are
  permission-gated** in `normal` (kind `fetch`). Deny-all blocks this egress,
  unlike agy's `search_web`.
- **`.factory/mcp.json` servers are always spawned**, twice per run and in
  another pgid. That held under `--only-tools`, hooksDisabled, and failed
  auth. Droid reaped them after a clean exit in 14/14 runs. Reaping after a
  SIGKILL (our timeout path) is unproven. No per-run MCP-disable key was found.
- **Hooks:** project `.factory/hooks.json` fires unasked, and **`--settings
  <tmp>` with `{"hooks":{"hooksDisabled":true}}` stops it**. Droid does not
  read `.claude/settings.json` hooks.
- **Task workers:** a write is rejected internally and immediately. No request
  reaches the client, and nothing is written (a silent denial, as with agy).

**Droid descriptor** (as trimmed by update #15):

- launch `droid exec --output-format acp`;
- `set_mode normal` (echo required);
- `set_config_option model=<configured default>` (confirmed);
- deny-all by `kind`;
- brief line: do not use the `loop_*`, ConnectApp or cloud/`computer_*`
  tools;
- auth: desktop session or `FACTORY_API_KEY`.

The `--settings hooksDisabled` file and the `.factory/mcp.json` launch gate
are dropped.

**Update #12, Droid testing complete:**

- **SIGKILL mid-turn:** the dummy MCP servers had `ppid` = droid but their
  own pgid (setsid). A group kill cannot reach them; a ppid walk finds them.
  After `kill -9` of droid, both were gone within 5 s, with no orphans
  (mechanism unknown). Update #15 keeps the group kill only; Droid's own
  reaping is what cleared these servers in testing.
- **Find the agent by its spawned pid, never by command-line match:** a
  `pgrep` on argv matched the probe instead.
- **User-level `~/.factory/mcp.json` servers are spawned in every run.** They
  are operator-controlled, so they are recorded and not gated; no disable key
  exists.

**Static research on Droid's cloud tools (update #13 follow-up, no live calls):**

The workflow used `droid --help`, `exec --help` and binary strings of droid
1.16.0 on tstang-dev, with an adversarial verifier.

- **No ACP lever removes tools.**
  - `--only-tools`, `--add-tools` and `--remove-tools` are computed, then
    discarded before `runAcpDaemon()`.
  - `session/new` forwards no tool filter.
  - `set_config_option` accepts only reasoning effort, autonomy level and
    model.
  - No user, project or `--settings` key disables built-in tools.
    `disabledTools` exists only per MCP server.
- **Gating in `normal`**, where autonomy level is `off`, so any impact level
  asks:
  - **Automation writes are permission-gated:** Create (medium/high), Edit
    (medium), Delete (high), Run (medium), EditAutomationFiles and
    SetAutomationRunOutcome.
  - **Automation reads are ungated cloud reads:** `chooseSlackChannels`, and
    List/Read/ReadFiles/ListTemplates.
  - **`loop_*` is not gated.** It has no confirmation function and
    schedules crons in the local daemon.
  - **ConnectApp is not gated.** It is enabled in ACP (interactive-cli mode)
    and lists slugs or returns a connect link.
  - **`computer_*` is not gated.** It is two read-only cloud list calls.
  - **The built-in default autonomy is `auto-medium`.** Automation writes are
    gated only if `normal` is set and echoed.
- **Verdict at the time:** neither "unreachable" nor "permission-gated" holds
  for `loop_*`, ConnectApp or `computer_*`. Update #15 admits Droid anyway,
  with a brief line banning those tools; Thomas judged the instruction enough.
- **Routes considered and not taken** (update #15):
  - (a) `FACTORY_AIRGAP_ENABLED=1`, which blocks Factory egress and
    `backendOnly` tools, plus `FACTORY_MACHINE_TYPE=ephemeral`, which makes
    loop create throw. Both are undocumented for the public build, which the
    docs say is not airgap.
  - (b) Move the Droid adapter from ACP to Droid's stream-jsonrpc
    `droid.initialize_session` with `disabledToolIds` / `restrictToolIds`.
- **Adjacent ungated tools:** send-message, create/update/delete-task, the
  PR-autofix setters, and Script's top-level confirmation in ACP sessions.

### Coordinator update #14: Gemini CLI over ACP, agy in API-key mode

Recorded as evidence; update #15 later settled the Gemini read-only route. Dev logs on tstang-dev: `~/acp-spike/logs/gemini-key-report.txt`,
`gemini-plan-report.txt`, `gem-*` and `agy-key2-*.jsonl`.

**Gemini CLI 0.70.0** (`gemini --acp`, API key, `gemini-3.5-flash-lite`,
isolated HOME):

- **Auth:** `initialize` advertises `loadSession` and the methods
  `oauth-personal`, `gemini-api-key`, `vertex-ai` and `gateway`.
  `authenticate gemini-api-key` works with `GEMINI_API_KEY` in env.
- **Modes:** `default`, `autoEdit`, `yolo` and `plan`; sessions start in
  `default`.
- **`--approval-mode plan` is ignored under ACP.** With the flag alone,
  writes and shell raise permission requests exactly as in `default`.
- **`session/set_mode plan` works, but its only echo is an
  `agent_message_chunk` with text `[MODE_UPDATE] plan`.** No
  `current_mode_update` arrives, and the marker leaks into the reply. The
  adapter must parse the marker as mode evidence and strip it from the text.
- **In `plan`:** writes, shell and outside-cwd writes are refused with no
  permission request and nothing on disk; reads work. `google_web_search`,
  `web_fetch`, `invoke_agent` and `activate_skill` stay exposed.
- **In `default`, deny-all holds:** options are `allow_always`, `allow_once`
  and `reject_once`; answering `cancel` left the disk clean. Outside-workspace
  writes are refused before any permission request.
- **Continuation:** no `session/resume` (`-32601`); `session/load` works and
  recalls the earlier turn.
- **Teardown** was clean in every run.
- **Folder trust is the repo-config gate:**
  - An untrusted folder (the default under an isolated HOME) skips project
    hooks, project agents and project MCP. Stderr says "Approval mode
    overridden to default because the current folder is not trusted", yet
    `set_mode plan` still applied afterwards.
  - A trusted folder (isolated HOME with `trustedFolders.json`) spawned the
    project `.gemini/settings.json` MCP server and hung until timeout; the
    group kill reaped it.
  - `GEMINI.md` and `AGENTS.md` load either way (repo content).

**Antigravity in API-key mode:**

- **Setup:** `--gemini-dir=<tmp>` with `{"modelProvider":"gemini"}` in
  `settings.json`, `GEMINI_API_KEY` in env, and ACP `authenticate` with
  methodId `gemini-api-key`. Without the `authenticate` call it silently
  stays on the Google-account login. The settings were written to both
  `antigravity-cli/settings.json` and `config/settings.json`; which one
  counts is not isolated.
- **Models:** Gemini 4 Neon, Carbon, Hydrogen and Argon; 3.8, 3.7 and 3.6
  Flash; 3.1 Pro.
- **The default model is `gemini-3.1-pro`,** so the descriptor must set the
  model explicitly.
- The `gemini-4-hydrogen` marker prompt passed with no permission requests.
- **Quota and API errors arrive as agent text with stopReason `end_turn`,**
  not as errors (a 429 daily free-tier quota on 3.1 Pro; Thomas's key is
  free tier). Classification must detect quota and API errors in the text.

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
parity comparison: mode setup, error correlation, lifecycle and cleanup, and
diagnostic redaction.

## Read-only enforcement model

Calibrated to Thomas's safety posture (Stoa decision `ee3117f3`,
2026-11-21). Delegated peers are his own agents on his own machines in his
own repos, so only three things are guarded:

1. **A read-only run does not change the working tree.**
2. **Nothing causes unexpected cost or leaves cloud or recurring jobs
   running.**
3. **Credentials stay out of logs and chat.**

Repo hooks, MCP servers (project or user), web search, sub-agents, folder
trust and Claude's auto-mode classifier are his own configuration. The
adapter does not gate on them, isolate them, or test for them. A check
belongs in this plan only when it serves one of the three points, or is the
only way to make a run read-only at all.

**The controls live in the owned CLI, not in skill prose.** Direct
`consensus run` calls bypass the delegate workflow (`commands.ts:404`
normalizes the request and calls `runProviderTurn`), so the ACP adapter
applies these on every launch:

1. **Provider-native read-only mode, confirmed before the first prompt**
   (point 1). Mode evidence is `update` or `initial-state`. A mode *change*
   must be echoed (`current_mode_update`, `config_option_update`, or a
   provider-specific marker). An unchanged mode is confirmed by the
   `session/new` `modes.currentModeId` (or configOption `mode`) plus an ok
   `set_mode` with no contrary update. Otherwise the run aborts as
   `not_started`.
   - Antigravity: mode `default` plus deny-all; never `accept-edits` or
     `auto`.
   - Devin: `session/set_mode ask` (the default `accept-edits` auto-approves
     edits). **[hinges: Q1]**
   - Gemini CLI: `session/set_mode plan`. Its only echo is an
     `agent_message_chunk` reading `[MODE_UPDATE] plan`, which the adapter
     takes as mode evidence and strips from the reply. `--approval-mode plan`
     is ignored over ACP (update #14).
   - Droid: mode `normal`, confirmed by update echo. The ACP default
     `auto-medium` auto-approves writes (update #10).
   - Pi: pi-acp never asks permission, so the only read-only lever is a
     wrapper script set as `PI_ACP_PI_COMMAND` that runs
     `exec pi --tools read,grep,find,ls "$@"`. **[hinges: Q13 live check]**
   - DeepSeek: check session modes and config once a key exists.
     **[hinges: Q12]**
2. **Deny-all permission responder** (point 1). The tool `kind` an agent
   reports is untrusted, so the responder grants nothing. It picks the
   `reject_once` option by its `kind`, never by option id (ids differ by
   provider), otherwise answers `cancelled`, and answers any pending request
   with `cancelled` on cancel or timeout (spec `prompt-turn.mdx:610-652`).
   The client advertises no `fs.writeTextFile` or `terminal` capability and
   sends `mcpServers: []`; it adds nothing of its own.
3. **Group kill on every exit path** (point 2). The current runner never
   signals the process group on a normal exit (`subprocess.ts:185-192`), and
   Devin and agy left MCP children alive after a clean exit. The transport
   runs `session/close` where advertised, closes stdin, waits a bounded time,
   then kills the agent's process group.
4. **Credential env allowlist** (point 3). The child gets the parent env
   scrubbed to the descriptor's fixed credential names. Diagnostics and
   fixtures are redacted, and `--env-allow` is rejected.
5. **Working-tree check, failing loudly** (point 1; coordinator, update #15
   follow-up). The CLI snapshots the checkout at cwd before launch and after
   teardown, on every extended read-only turn, so direct `consensus run`
   calls are covered too. Any difference makes the turn `ok: false` with a
   new non-retryable failure code and the changed paths listed in the
   envelope; it is never just a warning. The snapshot reuses the logic of
   the `delegate_snapshot` helpers
   (`consensus-delegate/references/accounting.md:24-129`). It does not see
   ignored files or writes outside the checkout; mode confirmation and
   deny-all are what prevent those.
6. **Honest turn classification** (correctness, and point 2 for quota):
   - Success requires a `session/prompt` response whose id and session
     match, `stopReason: end_turn`, and **nonblank answer text after
     provider-specific startup output is discarded** (Pi's banner must not
     count).
   - Missing, truncated or ambiguous responses, a blank answer, and any
     non-`end_turn` stop reason are failures.
   - **`permission_denied`**: at least one permission request was denied and
     the turn ended, whether the stopReason is `end_turn` (agy, empty text)
     or `cancelled` (Droid). Reported as a failure with
     `diagnostics.permission_denials` filled. **`empty_turn`** is a silent
     provider failure (Pi on a 401).
   - **Quota and API errors that arrive as agent text** with `end_turn`
     (agy, update #14) are matched per descriptor and reported as failures.
   - After `session/load`, chunks before our `session/prompt` is sent are
     replays and are discarded. Prefer `session/resume` where advertised.
   - A JSON-RPC error before `session/prompt` is sent is `turn: not_started`.
   - `max_attempts` stays 1, so a failed turn is never re-run for cost.

**Admission is one smoke test per provider**, run live by the operator or
coordinator with authorization, not in CI: the provider answers a trivial
prompt, and a read-only run that asks it to edit a file leaves the working
tree untouched. The dated result is recorded in
`.oat/repo/reference/evidence/` and as the descriptor's `evidence` string.

A provider that is registered but not yet smoke-tested appears in named
preflight as `unsupported` with a distinct "registered, not admitted:
<reason>" diagnostic (today every `unsupported` entry reads "not registered",
`commands.ts:223-228`), and `run` refuses it before launch.

**First extended adapter capabilities** (enforced in the CLI):

- `schema_strategies: ['text']` only;
- `permission_modes: ['read-only']` only, so an omitted policy, which resolves
  to `non-interactive` (`runtime-policy.ts:48-52,84-92`), is rejected;
- no `sandboxes`;
- no `env_allowlist` (credentials come from the descriptor's fixed list);
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
- **D2: cwd for extended read-only delegate runs.** **Recommended (update
  #15, confirmed by the coordinator): the repo root, like core read-only
  peers, with the before/after host-checkout snapshot** (read-only model
  item 5). Any change fails the run with `ok: false` and lists the changed
  paths. No disposable worktree.
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
  and **also kills the group after a normal exit**. If D1 is acpx, skip
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
  envelopes using the turn classification in item 6 of the read-only model:
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
- 2.3a **[independent]** The working-tree check (read-only model item 5):
  snapshot before launch and after teardown around every extended read-only
  turn, and an `ok: false` envelope with a non-retryable code and the changed
  paths. Tests: an unchanged tree passes; a changed, added or deleted file
  fails with that path listed.
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
- 2.5 **[hinges: Q1, Q4, Q9, Q12, Q13]**
  Per-provider descriptors:
  - launch argv;
  - version probe: the first line of `--version` per Q8, and
    `initialize.agentInfo.version` for `pi-acp`;
  - auth probe: **opt-in per descriptor**. It is a model-free
    `session/new`, then `session/close` where advertised (Q9), and never runs
    from inventory. It is **disabled for Droid**, where `session/new` mints a
    device-pairing code, and for any provider where the probe has side
    effects; those classify auth at run time instead;
  - credential env names, session-id rule, model reader, read-only mode
    setup, brief lines (Antigravity, Droid), and known stop or error mapping,
    including quota and API errors that arrive as agent text.

**Verify.** Unit tests on parser, responder and classifier fixtures. A fake ACP
agent fixture (a stdlib script) drives the transport end to end in tests,
including the direct `run --request-json` entry, so no live calls happen in CI.

**Sizing:** ~3-4 days in-house, or ~2-3 days with acpx.

### Phase 3: first provider, read-only, in delegate

- 3.1 Pick the first provider by evidence. **Proposed: Antigravity**, the
  provider with the most live evidence (updates #5-#9, #14). Its descriptor:
  - launch `agy acp`. API-key mode adds `--gemini-dir=<private abs tmp>
    --app-data-dir=<relative name>`, with `{"modelProvider":"gemini"}` in the
    dir's settings (update #14 wrote both `antigravity-cli/settings.json` and
    `config/settings.json`; which one counts is unconfirmed) and
    `GEMINI_API_KEY` in the credential env. Continuation keeps the same dir
    for the delegate session's lifetime;
  - mode `default` with `initial-state` evidence, never `accept-edits` or
    `auto`;
  - deny-all responder;
  - auth map: `-32000`/`-32603 No browser` → "sign in from a desktop
    terminal"; API-key mode needs an explicit `authenticate gemini-api-key`;
  - an explicit model (the API-key default is `gemini-3.1-pro`);
  - quota and API errors in the answer text classified as failures;
  - session id UUID;
  - model from `models.currentModelId`;
  - brief clause banning `invoke_subagent`, `swarm`, `run_workflow` and
    `schedule`.

  Disclosed limits, accepted by Thomas (update #13): `search_web` egress, the
  write to the real `conversation_summaries.db`, and that brief clause
  (workers otherwise fail closed after a silent 60 s denial).

  Devin, Gemini CLI (already run on an API key, update #14) and Droid
  follow. Droid and agy are desktop-session only (keychain auth) unless an
  API key is configured.
- 3.2 Smoke test. It can be **authored [independent]**; runs **[hinges: the
  final descriptor]**.
  - An opt-in live test gated by its own env var, next to
    `provider-cli/e2e/`, run in a scratch repo.
  - Two prompts: a trivial question that must be answered, and a read-only
    run asked to edit a file, after which `git status` must be clean.
  - The dated result is recorded in `.oat/repo/reference/evidence/` and as a
    descriptor `evidence` string, the same pattern as `adapters.ts:196-209` and
    `263-278`.
- 3.3 **[after D2 and the Phase 2 invocation contract]** Delegate skill and
  references:
  - Extended providers are explicit-name only.
  - Add an "Extended (ACP)" row to the flag table (`SKILL.md:112-116`):
    read-only only, the model from the consensus-config default (or
    `--model`), no effort, no continuation.
  - Extended read-only runs rely on the CLI's working-tree check (D2); the
    skill reports its `ok: false` failure and changed paths verbatim.
    Generalize the Claude-only host snapshot prose to "any peer without an
    OS sandbox" (`accounting.md:95-98,120-125`).
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
- The smoke test passes for the chosen provider. It is run by the operator
  or coordinator with live-execution authorization, not CI.
- Full suite, `build:check`, `validate` and smoke pass.
- **Cross-model review** before landing, since the change touches permissions
  and the sandbox posture.

**Sizing:** ~1.5-2 days after evidence.

### Phase 4: remaining providers, read-only

**[hinges: per-provider Q answers].**

Each provider gets a descriptor, a smoke test and a docs row; ~0.5 day
each. Per-provider notes:

- **Devin:** `set_mode ask`, echo required.
- **Gemini CLI:** `set_mode plan`, confirmed by the stripped
  `[MODE_UPDATE] plan` marker; no folder-trust requirement.
- **Droid:** `normal`, deny-all by kind, model through config, and the brief
  line banning `loop_*`, ConnectApp and cloud/`computer_*` tools. Its cloud
  tools are never called live.
- **Pi:** needs the `PI_ACP_PI_COMMAND` tool-allowlist wrapper proven live
  (Q13), since it is Pi's only read-only lever.
- **DeepSeek:** needs `DEEPSEEK_API_KEY` in its credential env, and the
  install hint must name Node >= 24.9. Evidence must come from `dsh` itself,
  not Droid's DeepSeek proxy model. Deferred (update #13).

### Phase 5: continuation per provider

**[hinges: Q5].**

- Declare `native_resume: 'unverified'` until a live resume returns the same
  session id.
- Use `session/resume` or `session/load` according to the capabilities each
  provider advertises.
- Each descriptor supplies its own `isSessionId` (Devin uses slugs).

### Phase 6: write mode per provider

**[hinges: a write smoke test per provider].**

- Add `workspace-write` to one adapter's `permission_modes` with a dated
  evidence comment from a smoke test: an in-worktree edit works in the
  delegate's dedicated worktree, and the host checkout is unchanged.
- Cross-model review is mandatory (permissions change).

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
| Phase 3 first provider in delegate          | 1.5-2 d            | 1.5-2 d   |
| **First provider read-only in delegate**    | **~1.5-2 wk**      | **~1.5 wk** |
| Each further provider (read-only)           | 0.5 d              | 0.5 d     |
| phone-a-friend / panel+loop / review        | 1 d / 1-2 d / 3-4 d | same     |

These are estimates, not measured. Live admission runs and operator sign-ins
are extra wall-clock time.

## Live-test questions

Q1-Q7 were sent to the coordinator 2026-11-20. Q8-Q15 came from recon. Status
is as of coordinator update #14. Q11 and Q16 fed checks that update #15
dropped, as did the descendant-tree part of Q10; they are kept as evidence.

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
    a group kill on every exit stays (update #15).
11. **Answered.** Devin can be isolated with a private `XDG_CONFIG_HOME` and
    `read_config_from` all false. Not used under update #15.
12. **Partly answered.** agy has no read-only mode (`default` plus deny-all).
    Gemini `plan` holds over ACP via `set_mode` only (update #14). dsh is
    open.
13. **Answered (mechanism); live check open.** Use a `PI_ACP_PI_COMMAND`
    wrapper.
14. **Answered.** See the env table above.
15. **Answered.** `agy acp` runs unattended once the keychain is readable
    (desktop session only).
16. **Answered (updates #7-#9).** Project hooks fire unasked; update #15
    leaves them to the operator, so no launch allowlist. `schedule`,
    `send_message` and `search_web` run unasked. Sub-agent writes fail
    closed silently. Reads outside the workspace ask. Nothing persisted
    after teardown except the summaries db.

## Review disposition

Codex (`gpt-6.2-sol`) ran an independent read-only review on 2026-11-20. All
findings were accepted, and the load-bearing ones were rechecked against
source:

- probe runs the token, not the resolved path (`probe.ts:114-118`);
- the parser drops prerelease tags (`:375-379`);
- lookup already precedes validation (`structured-output.ts:106,126`);
- normal exit never signals the group (`subprocess.ts:185-192`).

Changes made:

- Prevention moved into the owned CLI; snapshots became accounting. (Update
  #15 later trimmed the layered model to the three guarded points.)
- The responder became deny-all.
- Mode setup is confirmed before the prompt.
- A strict success predicate, cleanup on normal exit and a positive control
  were added. (Under update #15 the smoke test's trivial question serves as
  the positive control.)
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
