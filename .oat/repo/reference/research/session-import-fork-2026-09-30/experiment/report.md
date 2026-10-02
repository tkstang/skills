# Import then native fork: experiment results

Date: 2026-09-29, America/Chicago. Worker: GPT-6 Sol, high effort. Root independently inspected the probe, outgoing request artifacts, child metadata, persisted replies, and source/seed hashes.

## Result

The proposed workflow works in the tested isolated cases: import synthetic history into the destination worktree, create a native provider fork, and continue the fork while preserving imported text and completed tool exchanges. This is feasibility evidence, not a shipped skill change.

| Direction | Client | Evidence | Result |
| --- | --- | --- | --- |
| Claude history → Codex seed → Codex fork | Codex CLI 0.157.1 | Native `thread/fork`, continuation, app-server restart, resume, second continuation and final persisted history | Passed |
| Codex history → Claude seed → Claude fork | Claude Code 2.1.284 | CLI `--resume SEED --fork-session`, continuation, process exit, CLI resume of child, second continuation and persisted history | Passed |
| Imported Codex seed → terminal fork | Codex CLI 0.157.1 | Interactive `codex fork SEED` opened imported text/tool cards and persisted a distinct child with `forked_from_id` and destination cwd | Passed; no model turn in this separate CLI check |

Each continuation case preserved original user/assistant text, native tool call/result structure and IDs in both outgoing requests. Two distinct loopback assistant replies persisted in the child. Source and seed transcript SHA-256 hashes remained unchanged. Parent and child IDs were distinct. The Codex terminal child was separate from the child used in the full app-server continuation lifecycle.

## Important path finding

The first Claude attempt failed to locate its seed when import used `/tmp/...` while the client resolved cwd to `/private/tmp/...`. Those spellings generated different Claude project-store keys. Resolving the destination worktree to its canonical path before import fixed the failure. Both successful directions used `/private/tmp/session-import-fork-7ZO9zB/destination`.

## Isolation and limits

Used synthetic conversation fixtures, a disposable Git repository/worktree, isolated provider homes, a strict environment allowlist and dummy credentials. Provider subprocesses ran under `loopback.sb`, denying external outbound network while permitting localhost; the worker checked loopback success and external-connection refusal. Local HTTP servers returned synthetic successful model replies. No personal session imports, real model-service calls, authentication changes, global installs, product edits, commits or PRs were performed.

This proves tested client loading, native forking, request construction and persistence. It does not prove production model-service acceptance, answer quality, graphical desktop/sidebar placement, arbitrary transcript compatibility or future client versions. Teleporter's supported-history conversion limits still apply.

## Reproduction and artifacts

Importer: unchanged Claude Session Teleporter 1.2.0 at commit `39fd13ae4e4f1c7b484872561226da3764ab5a21`, retained at `/tmp/teleporter-review.pjO2qj/aviadr1-claude-session-teleporter-39fd13a`.

The scripts use fixed paths to the retained fixture and upstream snapshot. To repeat, preserve result artifacts first: `reset-fixture.py` deletes only the two disposable provider homes in this experiment, then recreates them. From this directory, using the upstream `.venv/bin/python`, run `reset-fixture.py`, then `probe.py codex`, then `probe.py claude`. These overwrite the corresponding experiment evidence. Run `run-codex-cli-fork.py` from a real terminal for the separate CLI check; trust only the synthetic empty repository and exit with `/exit`. The earlier `cli_fork_probe.py` automated PTY preflight stopped at interactive setup and is not the successful CLI evidence.

- `probe.py`: isolated importer and two native fork/continuation probes.
- `codex-result.json`, `claude-result.json`: identities, hashes and expected replies.
- `codex-first-request.json`, `codex-second-request.json`, `claude-first-request.json`, `claude-second-request.json`: actual outgoing synthetic requests.
- `codex-child-final.json`: persisted Codex history after the second continuation and restart.
- `claude-result.json` points to the persisted Claude child transcript.
- `codex-cli-fork-result.json` points to the separate CLI child transcript and records its native parent/cwd metadata.
- `run-codex-cli-fork.py`: reproducible interactive terminal invocation.

Recommended product direction: canonicalize the selected destination path, import a seed with that cwd, and return the target provider's fork command to run there. Keep import provenance and conversion omissions explicit. This experiment does not reactivate the retired automated executor.
