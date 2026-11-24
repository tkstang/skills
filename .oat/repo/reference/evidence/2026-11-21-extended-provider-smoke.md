# Extended providers: live smoke test

Date: 2026-11-21 (run `20261121-202124`). Host: dev, in the desktop session.
Code base: the generated consensus CLI bundle (sha256 prefix `94b28e69ccf5`)
built at feature commit `45a8fc0d` on `feat/consensus-extended-providers`.

Every bundle in this record, re-smokes included, was built from a branch that
also carried PR #170's read-only changes to the Claude, Codex and Cursor
invocations. PR #170 was closed without merging on 2026-11-23, and the branch
was rebased onto `main` without it. Extended runs executed none of that code:
the ACP adapter builds its own invocation and runs its own client, and it
defines no `isProvenReadOnly` hook, so #170's read-only branches never applied
to them. Commit SHAs in this record are from the branch before that rebase.

Each provider ran three read-only prompts through `consensus run` in a
scratch git repository:

1. **answer**: reply with a fixed token (`SMOKE-OK`).
2. **read**: read a file in the repository and report its token
   (`kumquat-4417`).
3. **edit**: create `smoke-write.txt`.

After every run the scratch repository's `git status` was clean and no agent
process was left. The final status of the scratch repository showed 0 changed
paths.

## Results

| Provider    | Route                  | Version | Model                         | answer | read | edit                                                           |
| ----------- | ---------------------- | ------- | ----------------------------- | ------ | ---- | -------------------------------------------------------------- |
| Antigravity | desktop login          | 1.5.13  | `gemini-3.8-flash`            | ok     | ok   | `PROVIDER_PERMISSION_DENIED` (`read_file` denied), no file     |
| Antigravity | `GEMINI_API_KEY`       | 1.5.13  | `gemini-3.8-flash`            | ok     | ok   | `PROVIDER_PERMISSION_DENIED` (`run_command` denied), no file   |
| Gemini CLI  | `GEMINI_API_KEY`       | 0.70.0  | `gemini-3.5-flash-lite`       | ok     | ok   | ok: the reply refused the edit, no file                        |
| Droid       | desktop keychain login | 1.16.0  | `custom:GPT-6-Luna-(Proxy)-0` | ok     | ok   | ok: the reply refused the edit, no file                        |

Every run:

- preflight reported `ready` with the version above;
- `diagnostics.acp.auth` matched the route (`existing_login` or `api_key`);
- every setup step was confirmed before the prompt: Antigravity mode
  `default` from the initial session state and the model from the
  `set_config_option` response; Gemini the model from the session state and
  mode `plan` from its marker; Droid mode `normal` from `current_mode_update`
  and the model from the response;
- the stop reason was `end_turn`, `turn` was `completed`, and the provider
  reported the requested model;
- teardown found the process group already gone, with no signal needed.

## Notes

- The desktop-login Antigravity edit run was denied `read_file`, not a write
  tool. That bundle recorded only tool names, so the request's kind and path
  are unknown. A later raw capture showed agy asking permission only for
  writes inside the workspace; re-smoke 1 below shows the denied requests were
  reads outside it.
- Untested routes: the Gemini CLI saved OAuth login (`oauth-personal`) and
  Droid's `FACTORY_API_KEY`.

## Antigravity known limit

A read-only Antigravity turn ends as `PROVIDER_PERMISSION_DENIED`, with no
answer, when agy asks to read outside the workspace: for example a parent
directory's `package.json`, or, on the desktop login, its own session
transcript in its app data. agy asks permission for such a read, consensus
denies it, and agy ends the turn after that single denied read.

Since `6cbe0730`, consensus adds an Antigravity brief line asking it to read
only inside the working directory. `6cbe0730` also allowed, in API-key mode,
a `read` request whose every location resolved inside the private per-run
home; the second cross-model re-check showed that an approval cannot be bound
to what the agent then reads (a request's reported kind and locations need not
match its operation, and the file can change after approval), so the
allowance was removed again and every request is denied. agy's transcript
read stays a known limit on both routes.

## Re-smoke 1: 2026-11-21 (run `20261121-204112`)

Bundle sha256 prefix `d491342e7ee2`, built at feature commit `8219f041`, same
host and prompts. All 12 runs left a clean tree and no agent process; the
answer and read results were unchanged; preflight parsed each version
(agy 1.5.13, gemini 0.70.0, droid 1.16.0). Gemini CLI and Droid again
answered the edit prompt with a refusal and wrote nothing.

That bundle records each denial's kind and path. Both Antigravity edit runs
ended as `PROVIDER_PERMISSION_DENIED` on a `read_file` request of kind `read`
outside the workspace:

- desktop login: the `package.json` in the parent of the scratch repo;
- `GEMINI_API_KEY`: its own transcript under the private home,
  `<private home>/consensus-agy/brain/.../transcript.jsonl`.

## Re-smoke 2: 2026-11-21 (run `20261121-205837`)

Bundle sha256 prefix `2ebd0a87c6f4`, built at feature commit `6cbe0730` (the
round-2 review fixes, the Antigravity read-scope brief line and the
private-home read allowance), same host and prompts.

- All 12 runs ended `ok: true`, with no error codes, warnings or denials.
  Every teardown found the process group already gone, the scratch tree ended
  clean, and no agent process was left. Auth was `api_key` for the six
  `GEMINI_API_KEY` runs and `existing_login` for the other six.
- Antigravity changed: both edit runs (desktop login and `GEMINI_API_KEY`)
  now refuse in the answer text and make no tool call, so they end `ok: true`
  instead of `PROVIDER_PERMISSION_DENIED`.
- No Antigravity run recorded a permission request, so neither the
  private-home read allowance (since removed) nor the transcript-read limit
  came up.
- Gemini CLI and Droid were unchanged: all three prompts ok, and the edit was
  refused in text.

## Re-smoke 3: 2026-11-22 (run `20261122-082533`)

Bundle sha256 prefix `27e67ef80492`, built at feature commit `a0fefbd5`.
It includes the restored deny-all, the probe-label redaction and the
working-tree fingerprint that also compares permission bits. Same host and
prompts. Later commits change only failure paths this smoke does not reach
(the unsupported-version warning, mode drift) and remove unused members.

- **Working-tree fingerprint:** no run reported `working_tree_changes` or
  `PROVIDER_WORKTREE_CHANGED`.
- **Clean runs:** no run recorded a permission denial. Every teardown found
  the process group already gone, the scratch tree ended clean, and no agent
  process was left.
- **Antigravity desktop login, Gemini CLI and Droid:** 9 of 9 ok, with the
  same answers as re-smoke 2. Each refused the edit in its answer text.
- **Antigravity `GEMINI_API_KEY` on `gemini-3.8-flash`:** 3 of 3
  `PROVIDER_TIMEOUT` (answer, read and edit). Setup was confirmed: mode
  `default` from the initial state, the model from the `set_config_option`
  response, auth `api_key`. The turn then produced no text and made no
  permission request for the full 240 s, and consensus cancelled it
  (`stop_reason` `cancelled`). The same key served Gemini CLI minutes later.
  A follow-up diagnostic the same day traced it to agy and the Gemini API:

  - **Retry loop:** agy's own log showed four attempts failing with
    `Error 503 … model is currently experiencing high demand`
    (`UNAVAILABLE`), retried after 4 s, 7.1 s, 9.7 s and 24.4 s.
  - **Quota:** a 429 `RESOURCE_EXHAUSTED` followed
    (`generate_content_free_tier_requests`, limit 20 per day per project per
    model, `gemini-3.8-flash`). It arrived as answer text inside an
    `agent executor error` line with `end_turn`, about 100 s in.
  - **Reading:** the 240 s timeouts were most likely the silent 503 backoff,
    and the retries may have used up the daily quota.
  - **Unverified:** with `gemini-3.7-flash` selected, a run failed in 4 s on
    a 429 whose quota dimension named `gemini-3.8-flash`, so agy may spend
    `gemini-3.8-flash` quota on an auxiliary call whatever model is selected.

  Consensus now adds a key-mode hint to the Antigravity timeout message. A
  test confirms that the 429 text, which also matches `agent executor error`,
  classifies as `PROVIDER_LIMIT_REACHED`.
