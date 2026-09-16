---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-16
oat_generated: false
oat_template: false
oat_template_name: design
---

# Design: Consensus Review

**Disposition:** Revised after user-approved complexity cuts. The smaller v1 and interactive scope choice below supersede the initial seven-selector design. Fable's re-check, formal plan review, and configured planning gate remain pending; nothing here claims shipped behavior.

## Contract and Boundaries

One canonical skill ships standalone `consensus-review` and plugin-local `review`. Its own generated executable resolves a bounded scope and reviewer, invokes the existing provider runner once, validates the result, compares before/after evidence, and writes JSON plus OAT-compatible Markdown. It neither applies findings nor invokes OAT receipt automatically.

- Node >=22, TypeScript, Node standard library only in shipped runtime.
- One mode: reviewer runs in the current worktree under supported read-only controls. No convergence, packet-only mode, universal isolation, repair invocation, or automatic provider replacement after dispatch.
- Three v1 selectors: base branch, explicit files, and document. Staged-only, unstaged-only, and committed-range targeting are deferred until a real review needs them. Materialized conversation artifacts use document input, not a fourth selector.
- All host run state is external. Only explicit `--output` exports finished Markdown into the repository, after comparison.
- High OAT dispatch ceiling; ordinary workflow reviews plus configured planning/final gates. No additional phase gates. Fable's receipt exercise establishes interoperability, not another general code-review gate.

## Entry Point and Ownership

Both distributions contain the same skill-owned `scripts/review.mjs`, built from canonical source. Instructions resolve that installed script and invoke it with Node. There is **no `consensus review` dispatcher subcommand** and no plugin-runtime import of a skill. The previously named subcommand is removed from the backlog contract by the user's approved simplification.

Reuse the existing provider runner and configuration parser directly through a narrow source interface; do not pull the generic dispatcher or convergence loop into the standalone closure. Prefer internal request options for Review's transport behavior, not additional public generic CLI flags without another caller. Shared runtime/config fixes remain owned by their existing modules.

Start with four responsibility areas: scope/state, selection/request, run/validation, rendering/CLI. These are not mandatory file counts or a requirement for new abstractions. Split only where implementation clarity or independently testable boundaries warrant it. Packaging declarations in `src/distributions.ts` and `build.json` own the two generated outputs and allowed source roots.

Packaging is the first proof: bundle the actual runner closure and execute it with a fake provider after copying each installation unit outside the checkout. An unused import or help-only check is insufficient. Review remains the first standalone to bundle this provider-runner closure; Panel does not already prove that path.

## Scope Selection and Interactive Entry

The **host agent**, not the runtime executable, handles conversation.

When the user invokes Review without supplying a scope, the agent must ask before dispatch and present:

1. **Branch diff** — changes from the merge base with a selected base branch through the current tracked worktree, including staged and unstaged edits.
2. **Selected files** — explicitly named files, including named untracked files.
3. **Document or plan** — one document in the repository or external state, including materialized conversation context.

Collect the corresponding base ref or path(s). The agent may suggest an observed default branch or relevant document, but must not silently select it. If the user already supplied an unambiguous scope in their request, translate it directly without asking again. Missing details require a focused follow-up. Cancellation or no interactive response leaves the request undispatched; no generic default-to-everything behavior.

The executable is non-interactive. Missing or conflicting selectors return usage exit 2 with `scope_required` or an appropriate argument error, the three supported options, and invocation count zero. It must not read stdin waiting for a menu choice. A headless caller must provide an explicit selector.

| Selector | Meaning | Captured evidence |
| --- | --- | --- |
| `base_branch=<ref>` | Merge base of ref and HEAD to tracked current worktree | Requested/resolved ref, HEAD and merge-base identities, relevant blob/index identities, exact diff/hash and selected current content |
| `--files <paths...>` | Current bytes of explicitly named repository files; untracked allowed | Complete root-relative paths, file kind/mode, content hashes |
| `--document <path>` | One current regular text document, inside or explicitly outside the worktree | Canonical input path, bytes/hash; external documents use stable anchors rather than fake repository finding paths |

All runs identify a reviewed Git worktree. Repository paths must remain within it after symlink/ancestor resolution. Explicit external documents and request files are bounded regular-file inputs, not executable instructions. Conversation text is materialized under external private state/temp storage and passed as a document; preserve the user's text separately from host context.

Git calls use argument arrays, explicit option/path separation, no external diff/textconv helpers, and no recursive submodule checkout. Base review requires resolvable HEAD/ref/merge base; an unborn repository can still use files/document. Reject unresolved merges, unsupported binary/submodule inputs, escaping paths and special files. Deleted files and renames in branch diffs retain authoritative before/current versions. Reject deferred selector syntax with an honest supported-options message, not an approximate substitute.

Initial bounds: 100 selected files, 2 MiB selected textual evidence, 256 KiB user request, 64 KiB assembled prompt, 1 MiB response, ten minutes per run. Larger permitted evidence stays in bounded external capture files referenced by path/hash, not expanded into argv. Exceeding a limit asks the caller to narrow input; no silent truncation. Constants stay local; no new limits configuration system.

## Reviewer Selection

Add `defaults.reviewers` to existing strict config parsing, show/set/clear and source reporting. Nonempty ordered array of known `{provider, model?, effort?}` entries; supplied strings nonempty; one entry per provider in v1. Model IDs remain opaque, effort provider-native. Keep schema version v1 for this additive key and document the first supporting release; older binaries reject unknown keys.

Precedence: invocation > project > user > built-in, replacing the entire lower list. Built-ins are Claude then Codex, excluding the host. `--reviewer provider[:model]` pins selection; provider-only uses provider defaults, not a saved model. `--model` and `--effort` require an explicit reviewer; duplicate model sources fail. Automatic selection may skip unavailable or unsupported candidates before dispatch and records why. A pinned candidate fails rather than falling back. Concrete model rejection during execution does not authorize another invocation.

The host skill always passes `--host` from its known runtime. Detection checks consistency; unknown or contradictory identity blocks. Resolve one explicit host/depth context for both scoped preflight and dispatch, preserving inherited depth with max depth one. Same-provider review requires pinned selection and actual user consent before emitting `--allow-same-provider`. Different provider does not prove different model family.

## Provider Transport

| Provider | Review policy | Result transport |
| --- | --- | --- |
| Claude | Adapter read-only permission mode, currently mapped to plan mode | Existing provider-validated terminal response |
| Codex | Non-interactive, read-only sandbox, approval never | Prompt-only response with host-chosen external last-message capture |
| Cursor | No supported read-only policy in current adapter | Ineligible reviewer; may host |

Add opt-in no-submit-sidecar behavior while retaining current defaults for other callers. Gate sidecar setup, prompt/schema injection, environment injection, reads, and cleanup at all existing lifecycle sites. Claude already uses provider validation; disabling submit is not a reason to change that. Explicitly keep Codex prompt-only rather than accidentally selecting constrained-native output.

Bound both last-message and generic submit-file reads before whole-buffer allocation, including concurrent growth. Review places its Codex capture under the external run directory. Host deep validation remains mandatory regardless of provider validation. Do not broaden this work into the separate live-submit investigation.

Prompt and provider controls authorize inspection, not edits, tests/builds, formatters, package managers or network operations. Checks not run must be labeled. Local context inspection is allowed but reported separately from the requested target. Retained HOME/credentials and provider tooling mean this is not universal filesystem/network isolation.

## External State and Narrow Drift Detection

Run directory: `${XDG_STATE_HOME:-~/.local/state}/consensus/<worktree-key>/reviews/<run-id>/`. Require an absolute configured XDG root, otherwise use the home fallback. Key by SHA-256 of the canonical absolute worktree path; sibling worktrees stay distinct. Resolve ancestors and reject state located inside the reviewed worktree. Use private modes, exclusive creation and atomic final writes.

Persist request/captured evidence, host result JSON, and either completed review Markdown or clearly labeled diagnostic. Retention is operator-managed: no automatic TTL, cleanup job or resume engine. Existing convergence `.consensus/` behavior stays unchanged.

Before and after the provider invocation compare:

- HEAD identity;
- index identity;
- deterministic, NUL-delimited Git porcelain status, with explicit untracked enumeration;
- current content/kind/mode/deletion state of **selected paths only**, including explicitly selected external documents.

Reuse capture/hash machinery. For branch diffs, compare the current before/after state of selected old/new paths separately from historical base blobs; do not mistake the requested diff itself for reviewer drift. Revalidate selected scope immediately before dispatch. Fail if selected evidence cannot be captured within its bounds. Repeat comparison on failures/timeouts when the process returns; a crash must not claim a completed check.

There is **no whole-worktree content hashing engine**, no 10,000-file/256-MiB hash budget, and no in-worktree runtime allowance list. Bound status output through existing capture limits without truncating it. Differences are unexplained drift unless evidence establishes reviewer authorship; an observed unauthorized write is defective. Never revert user changes.

Mandatory limitation in results/docs: a file outside the selected set may change contents while its Git status remains the same, and this can go undetected. Ignored/unselected/external paths and transient write-then-revert activity are not fully monitored. A stable comparison means only "no change detected within the stated coverage." This is deliberately narrower than the original design, not an equivalent guarantee.

Explicit `--output` copies completed Markdown only after comparison. Refuse preexisting destinations, symlink/input aliases, or destructive overwrite. Output failure does not rerun the provider.

## Result Contract and Rendering

The owned `schemas/review.schema.json` specifies the reviewer reply:

- schema version, echoed scope token, verdict `pass | changes_requested | inconclusive`, summary;
- findings with severity `critical | important | medium | minor`, title, location-or-anchor, claim, evidence, suggestion, finite confidence in 0..1;
- questions, limitations, reported coverage, inspected context with source version, and checks labeled passed/failed/not_run;
- reviewer identity claims explicitly separated from independently observed identity.

Use a fixed dependency-free validator for nested shapes, bounds, enums, unknown keys, locations, scope echo and verdict consistency, not a general JSON Schema engine. Types, schema and contract fixtures must agree. Invalid/incomplete output cannot become a clean review; no model repair loop.

The host aggregate owns run identity/status, worktree root, exact request/hash, captured scope identities, selected reviewer and skipped candidates, requested/passed model-effort, policy, invocation count, output paths, drift coverage and validation outcome. Peer fields cannot overwrite host evidence.

`authored_by` records known contributors, evidence source `detected | declared | unknown`, evidence reference and scope coverage. The host is not automatically the author of everything reviewed; commit trailers are declared, not detected. Mixed/conflicting/partial attribution remains explicit. Report achieved diversity as different-family/same-family/unknown only as supported. Collect supplied or already available evidence; do not build a transcript crawler or autonomous attribution engine.

Record canonical absolute worktree root once. Findings use complete repository-relative paths and one-based inclusive line ranges in the stated captured/live source version; reject traversal and escaping symlinks. Validate deleted/base-version findings against captured bytes, not existence in today's worktree. External documents use captured-document anchors. Do not invent line numbers.

Render stable C/I/M/m IDs, four severity sections, exact request, scope/provenance, questions/limitations, and separate checks run/suggested verification. Escape peer-controlled Markdown/link targets. Only complete, valid, stable results produce receivable Markdown; other results yield diagnostics. OAT is an optional consumer, not a runtime dependency.

Receipt compatibility requires deterministic fixtures plus Fable's bounded independent exercise using current `oat-review-receive`. Use a clean result and a findings fixture spanning severities/locations/anchors; verify diagnostics are not offered as completed reviews. Do not invent a substitute OAT parser or auto-triage/fix findings.

## Invocation and Handoff

Examples are relative to either installed skill directory, not a globally installed command:

```bash
node ./scripts/review.mjs base_branch=origin/main --host codex
node ./scripts/review.mjs --files src/example.ts docs/example.md --host codex
node ./scripts/review.mjs --document docs/design.md --reviewer claude --host codex
node ./scripts/review.mjs --document /absolute/state/request.md --output review.md --host codex
```

Optional `--request-file` supplies the exact question; otherwise capture a deterministic scope-specific request. CLI exit 0 means completed review (even findings) or explicitly labeled empty-scope no-op; exit 2 means usage/predispatch error; exit 1 means failed/incomplete/defective execution or output failure. JSON mode returns status, invocation count and absolute artifact paths; do not rely on generic runner exit zero to imply success.

The host's final answer and CLI human/JSON output always name full absolute paths to artifacts actually written. Chat links visibly include the full path. Distinguish canonical and exported copies. No basename-only, relative, tilde, or environment-placeholder handoff; no invented diagnostic path.

## Proof and Deferred Scope

Focused tests cover each of the three selectors, missing-scope interaction/invocation-zero behavior, config precedence/selection, provider host/policy/transport boundaries, bounded capture, deep validation, selected-path drift and its known blind spots, rendering, and both installations outside the checkout. Run repository build/freshness/version/type/test/structure gates and the documentation build before delivery. Fixture success is not live-provider acceptance.

Deferred capabilities: staged-only, unstaged-only and committed ranges, triggered by a concrete review that cannot be expressed adequately with the three v1 selectors. Additional phase gates are deferred unless a consequential changed boundary or unresolved invariant needs evidence normal tests/review cannot supply. Neither deferred item is silently required for v1 acceptance.

## References

- [Discovery](discovery.md)
- [Plan](plan.md)
- [Backlog contract](../../../repo/pjm/backlog/items/BL-260916-add-consensus-review-cross.md)
- [Kickoff handoff](../../../repo/pjm/handoffs/BL-260916-add-consensus-review-cross.md)
- Existing source: `src/plugins/consensus/provider-cli/{structured-output,subprocess,host-guard,commands,schema-validate}.ts`; `src/plugins/consensus/config/consensus-config.ts`.
- Packaging proof infrastructure: `src/distributions.ts`, `scripts/lib/packaging.ts`, `tests/tooling/skill-packaging.test.ts`.
