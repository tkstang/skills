# Exact terminal acceptance, 2026-10-01

This directory retains synthetic acceptance evidence for the generated session-fork-to-destination importer 0.3.1. It is research history, not a live-provider gate or a claim that every provider configuration works.

| Scope                                       | Result                                                                                                            | Evidence                                                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex 0.159.2, configured embedded server   | Exact printed fork command, terminal continuation, process restart and native resume passed                       | [Summary](codex-exact-terminal.json), [first request](codex-exact-terminal-first-request.json), [second request](codex-exact-terminal-second-request.json) |
| Codex default daemon                        | Unverified: the sandbox rejects execution of setuid `/bin/ps` with Operation not permitted                        | [Prior terminal refusal](codex-real-terminal.json), [bounded diagnosis](daemon-ps-diagnostic.json)                                                         |
| Claude Code 2.1.285, exact terminal command | Startup exited 1 before child creation: `Unable to connect to Anthropic services`; `api.anthropic.com: ENOTFOUND` | [Summary and observed limitation](claude-exact-terminal.json)                                                                                              |

The Codex summary records the exact command, configuration difference, distinct native child and parent, canonical destination cwd, source/seed hashes and unchanged-byte checks. The captured requests assert the native tool name, arguments, call ID and exact result; the second request includes the first persisted reply. Both replies were persisted by the native client. [All Codex requests](codex-exact-terminal-all-requests.json) also retain startup warmup requests, separately from the actual typed turns. [Claude requests](claude-exact-terminal-all-requests.json) contain its successful noninteractive fixture bootstrap; they do not prove terminal continuation. Source and seed hashes were recorded before Claude's refusal but were not rechecked afterward.

The JSON files and [original controller snapshot](terminal-acceptance.snapshot.mts) are byte-preserved from `/tmp/session-import-generated-evidence.CB35i5/`; [SHA256.json](SHA256.json) records their digests. The snapshot deliberately retains absolute paths to that checkout and evidence directory and must not be used for new runs. All request payloads came from synthetic fixtures; no credential headers were captured. Inspection found no sensitive credential fields or token-pattern values.

## Reproduce safely

Use Node >=22, the repository's installed development dependencies, genuine installed Codex/Claude executables, macOS `sandbox-exec`, and a real interactive PTY. The [reusable controller](terminal-acceptance.mts) resolves the helper and generated importer relative to its repository location. It creates a fresh `mkdtemp` evidence directory for each run and prints `TERMINAL_EVIDENCE_DIR`; it never writes this retained directory. It records the current generated skill version, which may differ from the historical 0.3.1 evidence. Generate the intended importer before acceptance through the repository's normal build workflow.

From the repository root, run one provider:

```sh
pnpm exec tsx .oat/repo/reference/research/session-import-fork-2026-09-30/terminal-2026-10-01/terminal-acceptance.mts codex
```

The controller creates temporary source and target homes, a Git source repository, and a registered destination worktree named `destination with_spaces`. It prepopulates the native target store with a synthetic turn, invokes the generated importer for a dry run and digest-guarded apply, and executes the generated terminal command verbatim. Fixture-local provider symlinks point to genuine installed executables; there are no executable stubs or system changes.

The fixture uses an allowlisted environment, dummy API credentials, and a synthetic loopback HTTP server. Before clients launch, it proves a real loopback connection succeeds and an external connection is denied. Native processes remain beneath this policy:

```scheme
(version 1)
(allow default)
(deny network-outbound)
(allow network-outbound (remote ip "localhost:*"))
```

The network policy is the isolation boundary; the filesystem environment routes clients to disposable homes. No personal transcript store, config, credentials or account is supplied. Never relax this policy to get a terminal probe past a startup check.

For Codex, the fixture adds literal `CODEX_EXEC_SERVER_URL=none` and writes a fixture-local config selecting `model_provider="probe"`, `model="probe-model"`, Responses wire protocol, the loopback `base_url`, and `supports_websockets=false`, with the destination trusted. The generated `codex fork` command receives no additional flags. This proves the configured embedded-server path, not the default daemon. The pinned [official Codex 0.159.2 source](https://raw.githubusercontent.com/openai/codex/rust-v0.159.2/codex-rs/tui/src/lib.rs) selects Embedded for an explicit `CODEX_EXEC_SERVER_URL` and tests the value `none` (`app_server_target_for_launch`, lines 969–998; test lines 2969–2983).

At the fork terminal prompt:

1. Type `Continue synthetic imported tools.` and press Enter. A separate Enter may be needed if the paste guard leaves a draft.
2. Wait for `CODEX_EXACT_TERMINAL_REPLY_101`, then type `/exit` and submit.
3. The controller starts a new native resume process. Type `Check previous synthetic reply.` and submit.
4. Wait for `CODEX_EXACT_TERMINAL_REPLY_102`, then exit.

Each terminal stage has a 90-second limit. The controller checks the actual requests identified by the typed prompts, native child persistence and source/seed invariants, writes its result, then removes only its own fixture. The new evidence directory remains available for inspection. A failed assertion records `validated:false`; inspect the result JSON rather than treating the controller's process exit status as the acceptance verdict.

The same controller accepts `claude`, with fixture-local `ANTHROPIC_BASE_URL`, a dummy API key and `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. Its one historical exact-command attempt stopped at the startup service check despite that configuration. No external service exception, unsandboxed fallback or retry was attempted. Earlier noninteractive native acceptance is a separate scope; it does not establish exact interactive terminal support.

Protects against: native terminal loaders losing imported tool payloads or persisted replies; noninteractive lifecycle tests cannot exercise the exact printed terminal command; covered by the retained synthetic controller and captured requests.
