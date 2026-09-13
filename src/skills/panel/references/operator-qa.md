# Consensus Panel Operator QA

Use this checklist to verify the host-facing `panel` skill against the generated
`consensus-panel.mjs` wrapper. Commands assume you are running from
`plugins/consensus/skills/panel/`; from the repository root, prefix wrapper paths
with `plugins/consensus/skills/panel/`.

## Preflight

Confirm the generated provider CLI and provider inventory are available:

```bash
consensus provider ls --json
consensus preflight --json
```

From a checkout:

```bash
node ../../scripts/consensus.mjs provider ls --json
node ../../scripts/consensus.mjs preflight --json
```

At least two providers must be ready for a passed panel. If a requested provider
is `missing`, `auth_required`, `unavailable`, or `unsupported`, report that
diagnostic instead of retrying blindly.

## Explicit Two-Panelist Run

```bash
node ./scripts/consensus-panel.mjs \
  --question-file references/examples/design-risk-question.md \
  --panelists claude,codex \
  --output .consensus/panel-qa/design-risk-panel.md \
  --run-dir .consensus/panel-qa/run \
  --allow-root .
```

Expected JSONL event sequence:

```json
{"event":"run_started","question_source":"file","run_id":"..."}
{"event":"panel_resolved","source":"invocation","panelists":["claude","codex"],"warnings":[]}
{"event":"panelist_started","panelist":"claude"}
{"event":"panelist_completed","panelist":"claude","status":"ok"}
{"event":"panelist_started","panelist":"codex"}
{"event":"panelist_completed","panelist":"codex","status":"ok"}
{"event":"artifact_written","output_path":".../design-risk-panel.md","run_dir":".../run"}
{"event":"run_completed","status":"passed","output_path":".../design-risk-panel.md","successful_responses":2,"panelists":2}
```

The artifact should contain:

- `kind: consensus-panel`
- `status: passed`
- the original question
- one attributed section per successful panelist
- a `## Shortfalls` section, even if empty
- canonical `panelist-response` and `panel-artifact` JSON blocks

## Config-Default Run

Set panel defaults in a temporary project or user config before running this on a
real machine:

```bash
consensus config set --json --scope project --panelists claude,codex --panel-size 2
consensus config get --json --scope effective --workflow panel
node ./scripts/consensus-panel.mjs \
  --question-file references/examples/privacy-boundary-question.md \
  --output .consensus/panel-qa/privacy-panel.md \
  --allow-root .
```

Expected `panel_resolved.source` is `project` when project defaults are active.
If no project config exists, user config or built-in defaults may be reported
instead. Invocation flags must always win over configured defaults.

## Shortfall Review

When a configured default panelist is unavailable but at least two usable
panelists remain, the artifact records diagnostics and may still pass. When an
explicitly requested panelist is unavailable, the wrapper writes a failed
artifact and exits non-zero.

Review these fields before summarizing:

- `run_completed.status`
- `successful_responses`
- `panelist_unavailable` events
- `## Shortfalls` in the artifact
- `status: failed` frontmatter when fewer than two responses succeeded or a
  requested panelist was unavailable

## Host Disposition

The host should report:

- artifact path
- final status
- panel composition and config source
- each attributed response
- diagnostics and shortfalls

The host should not add its own recommendation, synthesis, tie-breaker, or
panelist-style answer. A later host recommendation is a separate follow-up, not
part of the panel artifact.

## Privacy Boundary

Before running a question that includes customer data, credentials, personal
data, proprietary context, or broad workspace contents, ask the user exactly
which context is approved for provider-backed panelists. Do not send unapproved
sensitive or private context in a question file.

## Multi-Round Deferral

If the user asks panelists to debate each other, revise after seeing peer
answers, or vote across rounds, do not simulate that behavior. V1 is a
single-round independent panel. Point to `BL-260701-add-multi-round-panel` and
offer to run the single-round panel now.
