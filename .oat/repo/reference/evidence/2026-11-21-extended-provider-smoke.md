# Extended providers: live smoke test

Date: 2026-11-21 (run `20261121-202124`). Host: dev, in the desktop session.
Code base: the generated consensus CLI bundle (sha256 prefix `94b28e69ccf5`)
built at feature commit `45a8fc0d` on `feat/consensus-extended-providers`.

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
  writes inside the workspace.
- Untested routes: the Gemini CLI saved OAuth login (`oauth-personal`) and
  Droid's `FACTORY_API_KEY`.

## Re-smoke

- TODO: re-smoke on the fixed bundle (date, bundle sha256, results).
