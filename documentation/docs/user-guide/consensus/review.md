---
title: 'Review'
description: 'Run one bounded, read-only, provider-backed review and produce validated JSON plus OAT-compatible Markdown.'
---

# Review

`review` asks one independent provider-backed reviewer to inspect one bounded
scope. It makes one provider invocation, validates the structured reply,
compares selected state before and after dispatch, and writes deterministic
JSON and OAT-compatible Markdown. It does not apply findings or invoke OAT
receipt automatically.

The standalone skill is `consensus-review`; the Consensus plugin-local skill is
`review`. Both ship the same dependency-free `scripts/review.mjs` executable.

## Choose exactly one scope

The v1 release supports exactly three selectors:

1. **Branch diff** — `base_branch=<ref>` captures tracked changes from the
   merge base through the current tracked worktree, including staged and
   unstaged changes. Untracked files are not implicit.
2. **Selected files** — `--files <paths...>` captures the current bytes of the
   named repository files, including explicitly named untracked files.
3. **Document or plan** — `--document <path>` captures one bounded repository
   or external text document. Materialized conversation context uses this
   selector too.

When no scope was supplied in conversation, the host agent presents those
three choices, collects the base ref or paths, and waits. It does not guess or
dispatch after cancellation. An unambiguous supplied scope needs no repeat
question. The executable itself never prompts or reads a menu from stdin:
missing scope exits 2, lists the options, and invokes no provider.

Staged-only, unstaged-only, and committed-range selectors are deliberately
deferred; the CLI rejects them instead of approximating them.

## Run a review

From either installed skill directory:

```bash
node ./scripts/review.mjs base_branch=origin/main --host codex
node ./scripts/review.mjs --files src/example.ts docs/example.md --host codex
node ./scripts/review.mjs --document docs/design.md --host codex
```

Use `--request <text>` or `--request-file <path>` for an exact question. Pin a
reviewer with `--reviewer provider[:model]`; `--model` and `--effort` require
that explicit reviewer. Same-provider review also requires user consent and
`--allow-same-provider`.

`--host` names the runtime executing Review. A known inherited
`CONSENSUS_PARENT_HOST` is authoritative when it matches `--host`, even if the
shell also carries unrelated ambient provider markers. A mismatched inherited
parent fails with `contradictory_host`. When no inherited parent is present,
Review requires exactly one ambient runtime marker matching `--host`; mixed
markers fail with `contradictory_host`, and a marker-free shell fails with
`unknown_host`. These identity failures occur before provider selection or
invocation.

`--output <path>` creates an additional completed Markdown copy only after the
drift comparison. It refuses overwrite, symlink/input aliases, and destructive
destinations. Human and `--json` output report full absolute paths to every
artifact actually written.

Each provider invocation has a 15-minute wall-clock runtime by default. The CLI
does not expose a timeout override. Set the host command's hard timeout above
15 minutes, with additional margin for shutdown and artifact persistence. If
the host supports background execution, start Review there and poll for
completion instead. A polling or observation yield controls when the host
checks again; a hard timeout terminates Review and can prevent artifact
completion.

## Results and exit codes

A valid stable reply produces external `result.json` and `review.md` artifacts.
The Markdown keeps Critical, Important, Medium, and Minor sections with stable
`C1` / `I1` / `M1` / `m1` IDs, complete repository-relative locations or
captured-document anchors, evidence, suggestions, confidence, provenance,
questions, limitations, checks reported, and suggested verification.

Incomplete, invalid, drifting, or failed runs remain clearly labeled
diagnostics and are not offered as completed review artifacts.

| Exit | Meaning                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------- |
| `0`  | Completed valid review, including a review with findings, or an explicitly labeled empty-scope no-op. |
| `1`  | Provider, validation, drift, persistence, or export failure. Inspect the returned diagnostic path.    |
| `2`  | Usage or pre-dispatch argument error. No provider was invoked.                                        |

## Configuration and selection

Review uses the ordered `defaults.reviewers` list documented in
[Configuration](configuration.md). Each entry has a provider and optional model
and effort. Invocation values replace project, user, and built-in lists as a
whole. Automatic selection excludes the host and skips unsupported or unready
candidates before dispatch; a pinned reviewer fails instead of falling back.
There is no repair call or post-dispatch alternate provider.

## State, retention, and detection limits

Private state lives under
`${XDG_STATE_HOME:-~/.local/state}/consensus/<worktree-key>/reviews/<run-id>/`,
outside the reviewed worktree and keyed by its canonical path. It contains the
exact request, captured evidence, host-owned JSON, Markdown or a diagnostic.
Retention is operator-managed: there is no automatic cleanup, TTL, or replay.

The comparison covers HEAD, index identity, Git status, and hashes/kinds/modes
of selected paths. A file outside the selected set can change contents while
its Git status stays the same and remain undetected. Ignored, unselected, and
external paths plus transient write-then-revert activity are not fully
monitored. A stable result means only that no change was detected within the
stated coverage. Provider read-only controls are not universal filesystem or
network isolation.

Author evidence is recorded as detected, declared, or unknown with explicit
coverage. Reviewer claims remain separate from host-observed provider evidence;
different providers do not prove different model families.

## Installation forms

Install the complete Consensus plugin to get plugin-local `review`, or install
only standalone `consensus-review`. See [Installation](../installation.md) for
provider-specific plugin and standalone commands. Fixture and receipt tests do
not establish live provider acceptance; live acceptance remains unverified
until the opt-in provider gate is separately authorized and run.
