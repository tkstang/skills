# Generated-importer verification

2026-09-30, macOS execution host, branch `t3code/investigate-session-teleporter`.
GPT-6.1 Sol implemented the runtime and isolated-client suite after Opus design review passed. Root inspected critical conversion/publication paths and ran the final checks. No personal sessions or real model services were used in the native-client tests.

| Check | Result |
| --- | --- |
| Full Vitest suite | 173 files passed, 2 files skipped; 2,502 tests passed, 3 skipped |
| Opt-in generated-importer native-client suite | 2 passed, no skips |
| TypeScript | Passed |
| Generated build / build:check | Passed |
| Repository validate / mocked smoke | Passed |
| Skill version guard against origin/main | Passed; one changed owner, session-fork-to-destination 0.3.0 |
| Changed runtime lint and authored formatting | Passed |
| Documentation production build | Passed |

Initial full-run failures were stale manifest/payload version assertions at starting commit 3e383a07, plus generated drift while a worker finalized source. Upstream main 17e88cb5 included the assertion fixes and was merged. A brittle documentation example-count assertion was replaced with its installed-command-path invariant. The final full run is clean. The repo's drift test temporarily modifies and restores an observer payload; standalone build:check was run after it settled.

After implementation review, eleven fidelity/completion regressions and two publication-diagnostic regressions were reproduced on pre-fix code and passed after fixes. Final focused suites pass 35 import cases and eight publication cases. The two publication watcher-window cases passed ten repetitions each. The full suite and both generated native-client loops above were rerun on the revised runtime. [Review disposition](implementation-review.md) records the bounded changes.

Opus follow-up implementation review passed with no critical/high/medium findings; two low completion-detection limitations remain in the [disposition](implementation-review.md#final-acceptance). This is acceptance of the bounded alpha change for a draft PR, not release or global installation.

## Native client evidence

- [Codex result](verification/codex-native-clients.json): **0.159.2**, generated import into a populated provider home, distinct app-server native fork, continuation, process restart/resume, and final persisted history. The existing bootstrap thread remained discoverable alongside the imported seed.
- [Claude result](verification/claude-native-clients.json): **2.1.284**, generated import into a populated provider home, native CLI `--resume --fork-session` with noninteractive flags, then new-process child resume.
- Both directions verify native tool call names, arguments, IDs and results, earlier replies in later outgoing requests, destination cwd, distinct native children, and byte-identical source/seed after use. Destinations include spaces and underscores.
- Provider processes use disposable Git worktrees/homes, a fresh allowlisted environment, dummy credentials, and a verified loopback-only sandbox. Before launch, a real localhost connection must succeed and an external direct-IP connection must receive EPERM/EACCES. Unavailable isolation skips explicitly, never falls back to real services.
- [Exact Codex terminal diagnostic](verification/codex-real-terminal.json): unverified. A real PTY reached the TUI, but daemon startup failed to invoke `ps` inside the sandbox. No child was created; source/seed remained unchanged. No `--no-daemon` substitution was made.
- Exact printed-command creation and interactive terminal continuation remain unverified for this generated importer. Claude's tested command adds print/isolation flags. No production model-service acceptance, arbitrary-history compatibility, future-version, or GUI-placement claim.

Reproduce the isolated suite after `pnpm run build`:

```bash
SESSION_IMPORT_NATIVE_CLIENTS=1 pnpm run test:vitest src/skills/session-fork-to-destination/src/import-native-clients.test.ts
```

`SESSION_IMPORT_NATIVE_EVIDENCE_DIR` optionally retains compact result JSON outside the disposable fixtures. [Artifact hashes](verification/hashes.json) pin the reviewed runtime and acceptance harness; historical prototype evidence remains separate under `experiment/`.
