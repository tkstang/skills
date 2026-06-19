# Cursor Submit-Tool Spike Outcome

Date: 2026-06-19

## Decision

Deferred. Cursor submit-tool support is not accepted for the first provider CLI
cutover.

The shipped first-scope posture remains:

- Cursor advertises `submit_tool_candidate` only as a reserved strategy.
- `supports_submit_tool` remains `false`.
- Cursor's default structured-output strategy remains `prompt_only` with local
  validation and bounded retry.
- No Cursor SDK or submit-tool runtime dependency is added.

## Evidence Collected

Local CLI inventory:

- `command -v cursor` -> `/Users/tstang/.local/bin/cursor`
- `cursor --version` -> `3.5.33` / `aac81804b986d739acab348ed96b8bea6e83cc50` /
  `arm64`
- `cursor agent --help` -> blocked before help output with: `Error: Your macOS
  login keychain is locked. Run security unlock-keychain and try again.`
- `node plugins/consensus/scripts/consensus.mjs provider ls --json` -> `claude`
  ready, `codex` ready, `cursor` `auth_required`; Cursor capabilities include
  `schema_strategies: ["prompt_only", "submit_tool_candidate"]` and
  `supports_submit_tool: false`.

No live Cursor SDK custom-tool run was completed. The local credential/auth path
is not usable in this session, and no concrete evidence was collected for the
acceptance criteria below.

## Acceptance Criteria Not Met

- Reliability: no authenticated Cursor run proved that a stateless peer
  reliably discovers and calls a verdict submit tool.
- Audit capture: no evidence proves where the submitted payload is captured and
  how it maps into consensus JSONL/artifact records.
- Local/cloud behavior: no evidence distinguishes local Cursor Agent behavior
  from any cloud or hosted tool execution behavior.
- Dependency posture: adopting an SDK path would introduce a new runtime surface;
  the shipped plugin runtime remains dependency-free.

## Follow-Up

Revisit submit-tool support only after an authenticated Cursor run can prove the
acceptance criteria above. Until then, keep the provider CLI implementation
viable through prompt/output validation and provider-neutral diagnostics.
