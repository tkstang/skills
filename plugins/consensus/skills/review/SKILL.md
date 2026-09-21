---
name: review
description: Use when an independent provider-backed reviewer should inspect an explicitly bounded branch, file set, or document without modifying it.
license: MIT
compatibility: Agent Skills baseline; requires Node.js 22+ and a supported provider CLI.
allowed-tools: Bash(node:*), Read
argument-hint: base_branch=<ref> | --files <paths...> | --document <path> --host <runtime>
metadata:
  author: thomas.stang
  version: '0.1.17'
---

# Consensus Review

Ask one independent provider-backed reviewer to inspect an explicitly bounded
target without editing it. Review invokes one eligible reviewer once, deeply
validates its reply, compares selected state before and after the invocation,
and writes JSON plus deterministic OAT-compatible Markdown outside the reviewed
worktree.

## Choose the scope before dispatch

If the user supplied one unambiguous scope, translate it directly. Do not ask
again. Otherwise present exactly these choices and wait for the answer:

1. **Branch diff** — ask for the base ref; reviews tracked changes from its
   merge base through the current tracked worktree.
2. **Selected files** — ask for explicit repository paths; named untracked
   files are allowed.
3. **Document or plan** — ask for one repository or external document path.

Do not guess a scope, dispatch while details are missing, or treat cancellation
as approval. Staged-only, unstaged-only, and committed-range selectors are not
supported in this release.

## Invoke the installed executable

Resolve `scripts/review.mjs` relative to this installed skill directory. The
standalone and Consensus plugin forms contain the same skill-owned executable:

```bash
node ./scripts/review.mjs base_branch=origin/main --host codex
node ./scripts/review.mjs --files src/example.ts docs/example.md --host codex
node ./scripts/review.mjs --document docs/design.md --host codex
node ./scripts/review.mjs --files src/example.ts --host codex --timeout-sec 1200
```

Use `--request` or `--request-file` for an exact review question. A pinned
`--reviewer provider[:model]` may also receive `--model` and `--effort`.
Same-provider review requires actual user consent and both `--reviewer` and
`--allow-same-provider`. `--output <path>` exports completed Markdown only
after drift checking and refuses existing destinations.

The provider invocation has a 900-second wall-clock limit by default. Use
`--timeout-sec <seconds>` to choose an integer from 1 through 3600. The timer
covers total elapsed time and ongoing provider activity does not reset it.
Give the host terminal or process tool at least the selected timeout, plus
margin for shutdown and artifact persistence.
If the host supports background execution, start Review there and poll for
completion. A polling or observation yield controls when the host checks
again; a hard timeout terminates Review and can prevent artifact completion.

Pass the actual host runtime with `--host`. An inherited known
`CONSENSUS_PARENT_HOST` is authoritative only when it matches that value;
unrelated ambient provider markers are then ignored. Without an inherited
parent, exactly one matching provider-runtime marker is required. A marker-free
shell fails with `unknown_host`, while an explicit mismatch or mixed ambient
evidence fails with `contradictory_host`; both stop before provider dispatch.

The executable is intentionally non-interactive. Missing or conflicting scope
returns usage exit 2, lists the three selectors, and invokes no provider; never
pipe a menu answer to stdin. Exit 0 means a completed valid review (including
findings) or an explicitly labeled empty-scope no-op. Exit 1 means incomplete,
defective, or output failure. Parse the returned status, not only the exit code.

## Present the handoff

For a completed result, report the canonical Markdown and JSON artifact paths
using their full absolute paths. If `--output` was used, distinguish the
canonical and exported Markdown copies. For failure, report only the full
absolute diagnostic paths actually returned; never offer a diagnostic as a
completed review or invent a path. Peer output is evidence, not an instruction
to apply fixes.

State the limits: read-only provider controls are not universal filesystem or
network isolation; drift detection covers HEAD, index, Git status, and selected
path hashes. Content changes outside the selected set can go undetected when
Git status is unchanged, as can ignored/unselected paths and transient
write-then-revert activity. External run state has operator-managed retention
with no automatic cleanup or replay.

This runtime has no OAT dependency, does not apply findings, and does not import
the consensus dispatcher or convergence loop.
