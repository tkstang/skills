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

Use `--timeout-sec 1800` for a review that needs up to 30 minutes. The option
accepts whole seconds from 1 through 3,600 and defaults to 900 (15 minutes).
This is the provider invocation’s total wall-clock limit; ongoing output does
not reset it. A timeout produces an incomplete diagnostic, not a verdict.
Give the host terminal or process tool at least this timeout plus shutdown
and artifact-persistence margin.
If the host supports background execution, start Review there and poll for
completion. A polling or observation yield controls when the host checks
again; a hard timeout terminates Review and can prevent artifact completion.

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

## Results and exit codes

A valid stable reply produces external `result.json` and `review.md` artifacts.
The Markdown keeps Critical, High, Medium, and Low sections with stable
`C1` / `H1` / `M1` / `L1` IDs, complete repository-relative locations or
captured-document anchors, evidence, suggestions, confidence, provenance,
questions, limitations, checks reported, and suggested verification.

Incomplete, invalid, drifting, or failed runs remain clearly labeled
diagnostics and are not offered as completed review artifacts.

| Exit | Meaning                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------- |
| `0`  | Completed valid review, including a review with findings, or an explicitly labeled empty-scope no-op. |
| `1`  | Provider, validation, drift, persistence, or export failure. Inspect the returned diagnostic path.    |
| `2`  | Usage or pre-dispatch argument error. No provider was invoked.                                        |

## Limits

Review checks these limits before dispatch unless noted. `review.mjs --help`
prints the same values.

| Limit                 | Value                                                                                                                                                                 | When exceeded                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Changed files         | 100. A rename counts once; both paths and both versions stay in the evidence.                                                                                         | `scope_too_large` with the count, the five largest directories, and the workaround.                             |
| Textual evidence      | 8 MiB, charged per path as the larger of its live and base versions. `evidence.json` can therefore retain up to 16 MiB.                                               | `scope_too_large` with the total and the five largest paths.                                                    |
| One file or base blob | 8 MiB for text. A larger binary is skipped by hash instead.                                                                                                           | `scope_too_large` naming the path. A base blob that cannot be read is a scope error, never a recorded deletion. |
| Binary files          | Skipped at any size and listed under the report's limitations. Their size and SHA-256 stay in the evidence, so drift detection still covers them.                     | A scope with no textual change fails with `binary_scope_not_supported`.                                         |
| Assembled prompt      | 64 KiB. The prompt carries the evidence path, the path count, and at most 20 paths; `evidence.json` holds the full manifest. Requests over 32 KiB are passed by file. | `review_prompt_too_large` naming the largest contributor.                                                       |
| Provider output       | `--max-output-bytes`, an integer from 65,536 through 67,108,864, default 10 MiB. Combined stdout and stderr are counted during the run.                               | The provider is stopped and the run is incomplete; the first 2 MiB of each stream is saved.                     |
| Reply presentation    | 100 findings, 100 checks, 50 questions, 50 limitations, 200 coverage and inspected-context entries; text fields at their schema lengths.                              | Cut after validation; the report records `truncated: true` and the omitted count per collection.                |

To stay inside the file and evidence limits, narrow the scope with `--files`,
use a closer base, or pass `base_branch=<sha>`. When the SHA is an ancestor of
`HEAD`, its merge base is that commit, so the review covers exactly the tracked
changes from it through the current worktree. This is the range selector to use
after a branch has merged a newer base.

### Verdict derivation and lost output

The host validates the structure and provenance of every finding in the whole
reply before anything is truncated. It then derives the verdict from the full
validated set: any critical or high finding, or any failed check, means
`changes_requested`; otherwise `pass`, or `inconclusive` when the reviewer said
so. The reviewer's own verdict is stored as `claimed_verdict`, and the report
warns when the two differ. When findings must be truncated, critical and high
findings are kept first.

As soon as the provider returns, Review writes `provider-evidence.json` to the
run directory: bounded stdout and stderr (2 MiB each), the Codex last-message
capture, and the transport result. Every later diagnostic references it, so a
drift, validation, or persistence failure no longer loses the reviewer's
output. If that file cannot be written, the original failure status is kept and
the save error is recorded.

A command line too long for the operating system now fails with
`PROVIDER_ARGV_TOO_LARGE` instead of being reported as a missing provider.

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
exact request, captured evidence, saved provider evidence, any Codex
last-message capture, host-owned JSON, and Markdown or a diagnostic.
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
