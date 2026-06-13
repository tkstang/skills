---
id: bl-f0b6
title: 'Verify cursor-as-peer end-to-end through Paseo (authenticated cursor-agent)'
status: open
priority: medium
scope: task
scope_estimate: S
labels: [consensus, paseo, cursor, verification]
assignee: null
created: '2026-06-13T19:12:43Z'
updated: '2026-06-13T19:12:43Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

Cursor is supported by Paseo as a custom ACP provider (`cursor-agent acp`, routed
through the dedicated `CursorACPAgentClient`), and the consensus `refine` skill
can target it via `--peers cursor,codex` once it appears in `paseo provider ls
--json`. This path has **not** been exercised end-to-end, so cursor-as-peer is
documented as "unverified" at v0.1 (see README "Advanced Configuration" /
"Limitations").

Two specific unknowns motivate this:

1. **Auth/environment:** `cursor-agent` stores credentials in the OS keychain. A
   locked/unauthenticated keychain makes the Paseo provider report `status: error`
   (now caught by preflight `PEER_UNAVAILABLE` after the inventory-status fix). A
   real run needs an authenticated `cursor-agent` and the provider at `available`.
2. **Structured output:** Cursor runs through Paseo's generic ACP path, where
   `--output-schema` is enforced by prompt injection + validation/retry rather
   than the native structured output `claude`/`codex` expose. We need to confirm
   our verdict schema survives that path (schema-retry rate, malformed-JSON
   handling, latency) without degrading deliberation quality.

Setup reference (already documented in the README): register Cursor in
`~/.paseo/config.json` (or via Paseo's one-click ACP catalog):

```json
{ "agents": { "providers": { "cursor": {
  "extends": "acp", "label": "Cursor", "command": ["cursor-agent", "acp"]
} } } }
```

Related: bl-bb7e (in-house peer CLI investigation) — findings here feed the
build-vs-buy decision on whether maintaining ACP-peer support is worth keeping
Paseo for.

## Acceptance Criteria

- A full `refine` deliberation run completes with `--peers cursor,codex` (and,
  separately, `cursor` as one peer in a parallel mode) against an authenticated
  `cursor-agent`, with the run artifact and JSONL captured as evidence.
- Schema behavior is characterized: observed schema-retry rate and any
  malformed-verdict / `PASEO_INVALID_JSON` occurrences recorded, with a verdict
  on whether cursor-as-peer is reliable enough to document as supported.
- Preflight behavior confirmed against a real errored Cursor provider (locked
  keychain or signed-out) — `PEER_UNAVAILABLE` fires with the remediation hint.
- README/SKILL wording updated from "unverified end-to-end" to the verified
  status (supported, or supported-with-caveats, or not-recommended) based on the
  evidence; findings cross-referenced into bl-bb7e.
