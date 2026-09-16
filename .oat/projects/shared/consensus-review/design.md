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

**Disposition:** Complete lightweight draft, not an approved design or an implementation-ready plan. User judgment and Fable's independent review are pending. All interfaces and behavior below are proposed unless labeled existing.

**Scope:** BL-260916-add-consensus-review-cross — Add consensus-review: cross-model review of a bounded scope.

## Overview

Consensus Review sends one bounded review request to one reviewer, normally on a different provider from the host. The reviewer runs in the current worktree with supported read-only controls, inspects relevant context, and returns structured findings. The host captures the request and scope, selects the reviewer, validates the result, checks for worktree drift, and produces JSON plus readable Markdown. The host does not apply fixes or automatically disposition findings.

The product has one mode, not separate worktree and packet-only modes. A request packet establishes intent and evidence; it does not confine the child's access. The core result schema belongs to this repository. An OAT renderer makes completed reviews usable by `oat-review-receive`, without requiring OAT to install or execute the skill. Canonical `src/skills/consensus-review/` generates standalone `consensus-review` and plugin-local `review`.

Three implementation seams need particular care: the existing runner always requests a peer-written submit sidecar, its schema validator is shallow, and an unknown host bypasses its recursion guard. This design addresses those seams explicitly rather than treating existing dispatch support as sufficient proof of a safe Review run.

## Decisions Needing Your Judgment

| ID | Recommendation used throughout this draft | Tradeoff / alternative |
| --- | --- | --- |
| J1 — What does a base review include? | `base_branch=main` reviews tracked changes from the merge base to the **current worktree**, including staged and unstaged edits. Untracked files require explicit `--files`. A commit range always means committed endpoints only. | This matches reviewing work in progress; committed-only base review is easier to reproduce but misses unsaved-to-Git changes. Both variants retain exact identities/hashes. |
| J2 — May a reviewer run tests? | Default to inspection only. Do not ask the reviewer to run tests, builds, formatters, package managers, or arbitrary shell commands. It can report suggested verification and distinguish tests not run. | Automated tests may improve confidence but can write caches/files or call services. A future explicit check-execution contract can handle them; v1 must not pretend every test is read-only. |
| J3 — Selection and fallback | Config is an ordered list; skip unavailable/unsupported candidates **before** dispatch. An explicit reviewer is pinned, with no fallback. Unknown host runtime requires explicit host identification. Same-provider review requires a pinned reviewer plus explicit consent. | Predictable and auditable, but an unknown host or unavailable pinned model stops rather than guessing. No fallback after a reviewer invocation starts. |
| J4 — Save by default? | Keep request, captured scope, run metadata, JSON, and completed-review Markdown under `.consensus/reviews/<run-id>/`; `--output` additionally exports Markdown to a named new file. | Useful rerun/comparison evidence, but source snippets and user requests persist locally. Alternative: ephemeral default with an explicit save option. No global transcript collection. |

These are the only product judgments needed to turn this draft into a plan. Numeric limits and module splits below are engineering recommendations for peer review, not additional user questionnaires.

## Architecture

### Existing System and Proposed Boundary

The provider CLI already owns config, scoped preflight, host/depth guards, model/effort forwarding, subprocess capture, and structured envelopes. Reuse that code. Review owns scope semantics, reviewer selection policy, request construction, deep findings validation, drift checks, and rendering. Do not import the consensus loop or depend on any other skill's workflow.

```text
User / host skill
      |
      v
Resolve scope + capture request and Git/file evidence
      |
      v
Resolve reviewer preferences -> scoped preflight -> select one
      |
      v
One owned provider run (read-only policy, one attempt, depth one)
      |
      v
Terminal response -> deep validation + scope checks
      |
      v
Before/after drift check -> host-owned run result
      |                              |
      v                              v
Complete: JSON + OAT Markdown     Incomplete/defective/failed:
                                 JSON + diagnostic, not a clean review
```

### Execution Sequence

1. Validate arguments, discover the exact worktree root, resolve host identity and inherited depth. Reject conflicts/unknown identity before provider dispatch.
2. Resolve the requested scope, capture its immutable identities and bounded source evidence, and preserve the user's request verbatim. No generic transcript harvesting.
3. Resolve the effective preference list. Check adapter-declared provider-option capabilities, then run provider-scoped preflight sequentially until one eligible candidate remains. Evaluate the same resolved host context, inherited depth, and maximum depth of one at preflight and dispatch; never reconstruct depth as zero. Record skips; never probe unrelated providers eagerly.
4. Create a unique private run directory and host-owned request/scope files. Establish the before-state after those writes so they do not look like reviewer edits. Revalidate the captured scope identities immediately before dispatch; a change during preflight/setup requires a new capture, not a stale review.
5. Invoke the owned runner once with `max_attempts: 1`, worktree cwd, a complete host context with `max_depth: 1`, and the selected provider-specific policy. Preserve inherited depth, never reset it to zero.
6. Capture and deeply validate the terminal response. Compare its scope token to the host-generated token and normalize its findings. The peer cannot overwrite host provenance.
7. Compare after-state and classify coverage gaps or changed files. Do this even when dispatch, parsing, validation, or timeout fails.
8. Save host-owned JSON. Render receivable Markdown only for a complete, valid, stable review; otherwise write a clearly labeled diagnostic. Return paths and an explicit machine status.

## Component Design

### 1. Command and Distribution Entry Points

Proposed owner files are `src/skills/consensus-review/src/{cli,review,scope,selection,request,validation,render}.ts`, colocated tests, `schemas/review.schema.json`, `SKILL.md`, and `build.json`. This is a responsibility sketch, not a requirement to create seven modules if fewer stay clear.

- `consensus review ...` delegates to the Review orchestration function. Extend the existing provider CLI's argument/command surfaces minimally; do not put review policy into generic `run`.
- A skill-local generated executable exposes the same behavior without requiring a globally installed `consensus` command.
- Standalone output bundles the owned provider runtime and needed schema/resources. Plugin output may share the maintained plugin-root CLI, but must remain verifiable as its declared installation unit. No runtime imports into another generated skill directory.
- Use a Review-specific provider-runner facade that both entry points call. Keep the generic provider command dispatcher out of the standalone import graph to avoid importing unrelated workflows or creating a dispatch/import cycle.
- Declare both outputs and allowed source roots in `src/distributions.ts`; extend fixed plugin-runtime ownership declarations only where actual imports require it. Exercise both outputs installed outside the checkout.

### 2. Scope Resolver

Exactly one scope selector is required. Reject ambiguous combinations; never infer "everything" from an absent argument.

| Input | Meaning | Identity and content captured |
| --- | --- | --- |
| `unstaged` | Working tree versus index, tracked paths only | Index tree/blob identities, current file hashes, exact diff hash |
| `staged` | Index versus HEAD; empty-tree base in an unborn repository | HEAD/base identity, index blob identities, exact staged diff/hash |
| `base_branch=<ref>` | Merge base of ref and HEAD versus tracked current worktree, per J1 | Requested ref, resolved ref/HEAD/merge-base SHAs, index state, current hashes and diff |
| `<a>..<b>` | Two committed endpoint trees, not Git history traversal | Resolved endpoint SHAs, selected blob identities and diff |
| `--files <paths...>` | Current bytes of explicitly named repository files, including named untracked files | Root-relative paths, file kind/mode, content hashes |
| `<document-path>` | One current repository document | Path and content hash; finding anchors are allowed |
| `--artifact <path>` | Host-materialized description/content, tied to this worktree | Exact artifact bytes/hash and any explicitly supplied context references |

Use Git argument arrays with explicit option/path separation, no shell interpolation, no external diff/textconv helpers, and no recursive submodule checkout. Normalize paths against the worktree root and reject traversal, escaping symlinks, special files, and unresolved merges. Deleted files and renames retain before/after identities. Unsupported binary/submodule content produces an explicit pre-dispatch scope error, not silent omission. Git selectors require Git; document/file v1 also deliberately remains worktree-based.

For staged or historical scopes, provide captured diff plus relevant captured blob contents: the live worktree may differ. The prompt identifies which version is authoritative; any live context read is reported separately. Hashes prove identity/comparison, not that missing historical bytes can always be reconstructed later.

Proposed initial limits: 100 selected files, 2 MiB selected textual evidence, 256 KiB user request, 64 KiB assembled provider prompt, 1 MiB response, and 10 minutes per provider run. Store larger permitted request/source contents in host-created capture files and reference their exact paths/hashes in the bounded prompt rather than expanding everything into argv. The reviewer reads those files as part of inspection; the final artifact still preserves the verbatim request. Exceeding a bound fails with a request to narrow scope; no silent truncation or automatic scope expansion. These constants need focused boundary tests and documentation, not a general new configuration framework.

### 3. Reviewer Configuration and Selection

Add `defaults.reviewers` to existing config parsing, show/set/clear, source reporting, and resolution. Retain schema version `v1` for the additive key in the updated product; older binaries reject unknown keys, so docs must identify the first supporting release rather than imply backward readability.

Illustrative proposed JSON (model IDs are caller-supplied selectors, not validated availability claims):

```json
{
  "schema_version": "v1",
  "defaults": {
    "reviewers": [
      { "provider": "claude", "model": "chosen-claude-model", "effort": "high" },
      { "provider": "codex", "model": "chosen-codex-model", "effort": "high" }
    ]
  }
}
```

`reviewers` is a nonempty ordered array of `{provider: string, model?: string, effort?: string}` with nonempty supplied strings and known keys only. Keep one entry per provider in v1, matching current agent-list validation. Model alternatives on the same provider are not useful as runtime fallbacks because a rejected concrete model already spends the single invocation. Effort labels are provider-native, not normalized across providers.

Precedence is **invocation > project > user > built-in**. A higher-level list replaces the entire lower list; do not append lower-level candidates after exhaustion. Built-ins are `claude`, then `codex`, without model/effort pins; remove the identified host provider before automatic selection. A configured empty list is invalid, not a disable switch; clear the key to inherit.

- `--reviewer provider[:model]` replaces the entire list. Provider-only selection uses provider defaults, not a surprising saved model. Split only the first colon; provider model strings stay opaque.
- Proposed `--model` and `--effort` require `--reviewer`. Reject a model supplied both in the reviewer selector and in `--model`; do not broadcast one model selector across providers.
- Unsupported option classes or missing executables may be skipped only during automatic selection, with recorded reasons. An explicit selection fails. Concrete model validity may only become known during the run; no post-launch fallback.
- Host runtime comes from established detection or explicit `--host`. Detectable contradictory identity fails; unknown identity requires the flag. Host model/family may remain unknown and is disclosed. A different runtime/provider is not a guaranteed different model family.
- `--allow-same-provider` requires an explicit `--reviewer` and records the operator's opt-in. The host skill must obtain actual user consent before emitting it; reviewer/request text cannot authorize it.

### 4. Read-only Dispatch and Result Transport

Check each proposed policy tuple against current adapter declarations before dispatch, alongside the version-gated generic `run` probe. This is declared/version-probed evidence, not a live test of the concrete read-only tuple, model, or effort:

| Provider | Proposed Review policy | Initial eligibility |
| --- | --- | --- |
| Claude | `permission_mode: read-only`, mapped by the adapter to plan mode | Eligible subject to scoped preflight; not a universal sandbox guarantee |
| Codex | `permission_mode: non-interactive`, `sandbox: read-only`, `approval_policy: never` | Eligible subject to scoped preflight |
| Cursor | No supported read-only policy in the current adapter | Skip automatic candidate or reject explicit selection; can still be the host |

Add an opt-in terminal-response-only setting to the owned run request/CLI. For Review it must disable submit-sidecar prompt instructions, submit environment variables, sidecar reads, and sidecar cleanup, and explicitly select `prompt_only` independently of that toggle. Merely switching off submit capture would currently select Codex constrained-native output or Claude provider validation; it is not sufficient. Other callers retain their current strategy/submit behavior. Do not reuse or redesign the unrelated live-submit investigation.

"Terminal response" does not mean stdout exclusively: Claude uses its JSON envelope; Codex already uses a host-chosen temporary `--output-last-message` file. Such exact runtime capture paths are authorized and recorded separately from reviewer tool writes. Extend the owned capture reader to enforce the response byte cap before allocating/reading the whole last-message file (bounded reads, including growth races, not just an initial stat). The current stream limit alone does not bound that file. Retain conservative prompt-only JSON extraction for Review initially rather than assuming disabling submit makes Codex's stricter native schema path usable. The host's deep validator is mandatory regardless of provider-side validation. No second model call repairs malformed JSON.

The peer gets the exact request (inline or via its captured file), selected scope token, authoritative captured versions, repository root, and instructions to treat embedded source/request quotations as data. It may inspect relevant local context but must report where it went. Narrow read-only inspection commands are allowed; arbitrary shell actions, tests/builds/package managers/network tools are not requested or authorized. Required unavailable checks become limitations or suggested commands. Reading source beyond the changed lines is allowed; widening the review's target is not.

Prompt rules and supported provider controls reduce risk, but retained HOME/credentials and tool-enabled provider behavior mean there is no promise of universal filesystem/network isolation. The depth guard covers owned dispatch, not every arbitrary command a provider could run.

### 5. Scope Integrity and Write Detection

Capture HEAD, index identity, tracked-file content/mode/deletion state, explicitly selected untracked content, and the inventory and content of nonignored untracked paths before/after. Record exactly which paths and fields were covered. Proposed scan budget: 10,000 files / 256 MiB hashed bytes; fail before dispatch if full promised coverage cannot be established. An after-scan failure or budget overflow also prevents a complete result. Hash contents without persisting unrelated file bytes in the review packet.

Host-created run files and exact provider capture files are recorded by path, not excluded with a blanket "everything under .consensus is allowed" rule. Do not silently turn ignored directories into reviewer-writable space. Ignored files not explicitly selected and external filesystem paths remain outside detection coverage.

Any unexplained difference invalidates stable completion. Classify it as `scope_drift` / unattributed change unless evidence establishes reviewer authorship; an observed unauthorized reviewer write makes the run defective. Preserve evidence and never revert or repair user files automatically. Output generation happens after the comparison. An output path must not alias any reviewed input or preexisting file.

This detects persistent state differences, not all writes: concurrent edits, write-then-revert operations, ignored files, and external paths limit attribution. A stable hash set means "no change detected within coverage," never "the reviewer could not write."

### 6. Validation and OAT Rendering

The generic runner's current shallow schema check is insufficient. Review owns dependency-free deep validation of every nested object, enum, array, finite confidence, location, string bound, unknown key, and scope token. Use a bounded fixed-schema validator, not a new general JSON Schema engine. Contract fixtures must keep the JSON schema, TypeScript model, and runtime validation in agreement.

Host validation also checks verdict consistency: `pass` requires no actionable findings and no declared coverage-blocking gap; `changes_requested` carries findings; `inconclusive` cannot become a clean receipt. An omitted check does not alone invalidate an inspection-only review, provided the limitation is explicit. Findings need evidence and a suggestion, and either a file location or a stable document/artifact anchor. Suspicious paths/anchors cannot become executable commands or unsanitized output links.

**Finding location contract:** Record the canonical absolute `worktree_root` once in the artifact header. File findings use the complete repository-relative path from that root and a one-based inclusive line range in the stated source version, for example `src/plugins/consensus/provider-cli/invocation.ts:108-110`. A basename is sufficient only for a file actually at the worktree root. The renderer must reject absolute finding paths, traversal, and paths whose existing symlink/ancestor resolution escapes the reviewed root; never render an unsafe finding link or silently discard the finding. Validate historical/deleted-file locations against the captured scope and version rather than requiring the current file to exist. Anchor-only document/artifact findings remain supported without invented line numbers. Consumers can compose absolute locations from the header while findings stay portable across machines.

Render completed reviews with `oat_generated_at` metadata, scope/request/provenance, a summary/verdict, all four severity headings, questions/limitations, and separate "Checks run" and "Suggested verification" sections. Assign deterministic `C1`, `I1`, `M1`, `m1` IDs within severity while preserving provider order. Escape peer-controlled Markdown, headings, fences and link targets so quoted source cannot inject fake findings or instructions into the receiving workflow.

OAT receive is an instruction-driven skill: there is no repository-shipped parser API to import. Fixture assertions/test-only extraction can verify the current documented conventions; a separate bounded receipt exercise with Fable must verify that the artifact yields the same register, including anchors and no-finding cases. Do not label a homemade extractor an official OAT parser. Never auto-run receipt, triage, task creation, archive, or fixes as a side effect of Review.

## Data Models

The following sketches define ownership and required evidence; final field spelling can be refined during peer review. They are not implementation code.

```typescript
type Severity = 'critical' | 'important' | 'medium' | 'minor';
type ReviewVerdict = 'pass' | 'changes_requested' | 'inconclusive';

interface Finding {
  severity: Severity;
  title: string;
  location: {
    path: string | null; // complete worktree-root-relative path, never an abbreviated basename
    line_start: number | null; // one-based; null only for anchor-only locations
    line_end: number | null; // inclusive, >= line_start; same source version
    anchor: string | null;
    version: 'captured_before' | 'captured_after' | 'live_context';
  };
  claim: string;
  evidence: string;
  suggestion: string;
  confidence: number; // finite, 0..1; not a host-calibrated probability
}

// schemas/review.schema.json: the reviewer-owned response contract.
interface ReviewReply {
  schema_version: 'v1';
  scope_token: string; // echo only; host owns the captured scope
  verdict: ReviewVerdict;
  summary: string;
  findings: Finding[];
  questions: string[];
  limitations: string[];
  coverage_complete: boolean; // reviewer report, not independent attestation
  inspected_context: Array<{
    path_or_anchor: string;
    version: 'captured_before' | 'captured_after' | 'live_context';
    description: string;
  }>;
  checks: Array<{
    command: string;
    status: 'passed' | 'failed' | 'not_run';
    evidence: string;
  }>;
  reviewer_claims: { model: string | null; notes: string[] };
}
```

The host-owned `ReviewArtifact` wraps the validated reply (or null on failure) with:

- `schema_version`, run ID, UTC timestamps, status (`complete`, `incomplete`, `defective`, `failed`) and error code;
- canonical absolute `worktree_root`, recorded once in the header; finding paths are complete root-relative paths;
- verbatim request and hash, raw selector and resolved requested scope, commit/index/blob identities, captured diff/file hashes, scope token, declared limits;
- host runtime/model with evidence source (`detected`, `declared`, `unknown`);
- `authored_by`, separate from the calling host: contributors' provider/model/family when known, each with `evidence_source: detected | declared | unknown`, an evidence reference, and the scope that evidence covers; disclose partial or unknown authorship coverage;
- selected provider, config source/index, skips, requested model/effort, passed model/effort, independently observed identity when available, otherwise null;
- achieved author/reviewer diversity (`different-family`, `same-family`, or `unknown`), with its evidence basis and any incomplete coverage; do not equate a different calling runtime with a different author model family;
- effective runtime policy, local preflight/version evidence, output transport/source, host invocation count and provider-internal attempts (`unknown` unless observed);
- before/after coverage and drift, exact host/runtime write allowances, response validation disposition;
- reviewer-reported inspected context/checks separately labeled from host-observed evidence.

The peer cannot set `status`, selected identity, observed model, capture hashes, or mutation disposition. Validate this aggregate before saving. Never promote a self-reported model into an independently verified model. Store raw failure content only when bounded and intentionally retained; default diagnostics redact credentials and omit environment dumps/raw command arguments.

The host owns `authored_by`. Its current session model is authorship evidence only for work that session actually produced, not every file it asks someone to review. Commit trailers and human/agent statements are declared attribution; runtime/dispatch records can supply detected evidence for their recorded scope. Keep the evidence reference, do not promote a trailer to independently detected identity, and leave missing or conflicting attribution unknown. Compare reviewer identity with the authors of the reviewed scope; claim different-family diversity only when the relevant authorship coverage and reviewer identity support it. These fields report evidence and do not silently broaden v1's agreed selection/fallback rules.

## API Design

Proposed public examples:

```bash
consensus review staged
consensus review base_branch=origin/main
consensus review HEAD~2..HEAD --reviewer claude
consensus review --files src/example.ts docs/example.md
consensus review docs/design.md --reviewer codex --model chosen-model --effort high
consensus review --artifact .consensus/review-request.md --output review.md
```

Optional `--request-file` supplies the exact review question; otherwise a deterministic scope-specific request is generated and preserved. The host skill materializes a described artifact into a file before invoking the command and distinguishes the user's text from its own contextual summary. All named request/artifact paths are bounded local inputs, not instructions to execute their contents.

Selection controls are `--reviewer`, `--model`, `--effort`, `--host`, and explicit `--allow-same-provider`. No automatic provider installation, model discovery calls, or authentication repair occurs. Time/size limits initially remain documented constants rather than proliferating config knobs.

Default output is `.consensus/reviews/<run-id>/` containing `request.md`, captured scope data, `result.json`, and either `review.md` or `diagnostic.md`. Create directories/files with private modes where supported. Use exclusive creation and atomic final writes; refuse preexisting explicit output paths and symlink aliases. The external output is a copy of completed Markdown, while the canonical run result stays JSON. Report partial output failures rather than rerunning the reviewer.

The Review command's proposed exit contract is `0` for completed review (even when findings exist), `2` for usage/pre-dispatch selection failure, and `1` for failed/incomplete/defective execution or output failure. `--json` returns a compact status/path envelope for every outcome. An empty scope returns a labeled no-op with invocation count zero, not a purported clean model review. Consumers use explicit status/verdict, not exit code alone; the underlying generic runner can return a failure envelope with exit zero.

**Required artifact handoff:** The host skill's final response and the CLI's human/JSON output must include the full absolute path to every reported review artifact. Never report only a basename, relative path, `~` shorthand, or unexpanded environment variable. In chat, use a clickable file link whose visible label includes the full path. If `--output` exports a second copy, identify its absolute path separately from the canonical run artifact. On an unsuccessful run, report the absolute diagnostic path if one was actually written; explicitly state when no artifact was created rather than inventing a path.

## Error Handling

| Failure | Result / recovery |
| --- | --- |
| Invalid or conflicting scope, unresolved ref/merge, unsupported content, bounds exceeded | Stop before dispatch; identify the input to fix or narrow |
| Unknown/contradictory host, exhausted list, unsupported explicit model/effort control or read-only policy | Stop before dispatch; report reasons; no automatic install, permission downgrade, or fallback consent |
| Selected provider rejects concrete model/effort, times out, fails, or emits malformed/deep-invalid JSON | One failed invocation; preserve bounded diagnostics; no repair invocation or alternate provider |
| Incomplete coverage, stale scope token, or unexplained worktree drift | Incomplete/defective result; no receivable clean artifact |
| Output path collision, escape, or write failure | Preserve completed in-memory/run evidence where possible; fail output explicitly; no destructive overwrite |
| Interruption/crash | Do not promise final drift verification; partial run manifest remains incomplete; no automatic resume/retry |

## Testing Strategy

Use colocated Vitest tests and deterministic provider fixtures; no live calls in ordinary test runs.

- **Scopes:** staged versus working-tree divergence, unborn HEAD, base merge-point plus dirty changes, immutable ranges, untracked opt-in, deletions/renames, empty scope, malicious ref/path arguments, symlink escapes, binary/submodule rejection, concurrent scope changes, and every bound.
- **Selection/config:** each precedence layer, whole-list replacement, invalid empty/duplicate entries, pinned overrides and conflicts, unknown/contradictory host, actual consent requirement, scoped preflight order, option rejection, model/effort forwarding, and no second dispatch after terminal failure.
- **Transport/policy:** declared Claude/Codex policy tuples; Cursor ineligibility; identical preflight/dispatch depth; terminal-response-only request explicitly chooses prompt-only and does not inject/write/read/clean a submit sidecar; existing callers keep current behavior; bounded Codex last-message reads (including concurrent growth) remain an explicit capture allowance.
- **Validation/provenance:** malformed nested findings, enum/range/key errors, false scope echo, verdict inconsistencies, invalid paths/anchors, self-reported identity, unknown internal attempts, and fake test claims never upgraded to observed evidence. Cover known/declared/unknown authorship, a host reviewing another model's work, partial/mixed authorship, untrusted trailers, conflicting attribution, and honest unknown diversity.
- **Drift:** tracked/untracked changes, input/output alias protection, failed-run comparison, host outputs not mistaken for peer changes, unattributed concurrency, bounded coverage, and documented inability to detect transient/outside-coverage writes.
- **Rendering:** one fixture per severity plus mixed/empty findings, document anchors, exact request preservation, Markdown-injection payloads, stable IDs, escaping, and separation of checks run from proposed checks. Test nested paths with duplicate basenames, legitimate root-level filenames, line ranges tied to captured versions, deleted/historical files, traversal and symlink escapes, and portability using the recorded absolute worktree root. Assert absolute artifact paths in human/JSON output for default storage, relative `--output` arguments, paths with spaces, and failure diagnostics; never claim a nonexistent artifact. Run the independent OAT receipt exercise before claiming that acceptance criterion complete.
- **Packaging:** both generated entry points outside the checkout, bundled schema/assets and provider runtime, no OAT/runtime package dependency, exact generated inventories and consumer version fan-out.

During implementation, use `pnpm run test:vitest <exact-test-path>` for scoped tests, then type-check, build/freshness, structure validation, changed-file lint/format, version validation against the selected main baseline, and full `pnpm run premerge` before handoff. Test commands in the eventual plan must name actual files; this draft does not invent a passing suite.

No live-provider behavior is verified by this draft. Fixture-tested support and live acceptance must be labeled separately in docs/release notes; any optional paid/live acceptance requires explicit authorization. Fable's artifact review complements, not replaces, configured OAT lifecycle gates.

## Peer Review Focus and Handoff

Fable should review the whole document, concentrating on:

1. Whether terminal-response capture truly removes the sidecar/read-only conflict without changing existing run behavior.
2. Whether scope/version provenance and drift limitations prevent misleading clean reviews.
3. Whether selection and unknown-host handling remain usable without silently weakening independence or depth controls.
4. Whether the schema/renderer and independent receipt exercise satisfy the item without overclaiming parser compatibility.
5. Whether packaging avoids loop coupling, dispatcher import cycles, and accidental runtime dependencies.

User approval of J1–J4 and peer feedback precede the runnable plan. The later plan must coordinate with Fable's maintenance branch and use a separately visible implementation worktree as specified in the kickoff handoff. No implementation, new PR, or user-global install occurs in this design pass.

## Evidence References

Evidence was inspected against merged planning baseline `08f59459`; these are existing contracts, not proof the proposed feature already works. Paths are repository-relative.

- `src/plugins/consensus/config/consensus-config.ts`: agent refs/defaults/known keys and precedence; `parseAgentList` currently requires unique providers.
- `src/plugins/consensus/provider-cli/{args,commands}.ts`: `run`, scoped preflight and request normalization; request-JSON and CLI-flag forms have different validation boundaries.
- `src/plugins/consensus/provider-cli/structured-output.ts`: `runProviderTurn`, attempt budget, always-on submit capture and final-message fallback.
- `src/plugins/consensus/provider-cli/{adapters,invocation,runtime-policy}.ts`: advertised controls, policy mapping, last-message capture, retained environment, cwd rather than universal confinement.
- `src/plugins/consensus/provider-cli/host-guard.ts`: depth propagation and unknown-host bypass.
- `src/plugins/consensus/provider-cli/schema-validate.ts`: shallow existing checker; no nested Review validation today.
- `src/skills/phone-a-friend/SKILL.md`: bounded advice and structured-envelope failure handling; `src/skills/session-handoff/SKILL.md`: request/evidence/authority discipline.
- `.agents/skills/oat-review-receive/SKILL.md`: normalized findings, four severities, path/line extraction and explicit-path receipt; no executable parser API.
- `src/distributions.ts`, `scripts/lib/packaging.ts`, `tests/tooling/skill-packaging.test.ts`: canonical owner, bundled allowed-source closure and installed-output checks.
- [Discovery](discovery.md), [backlog item](../../../repo/pjm/backlog/items/BL-260916-add-consensus-review-cross.md), and [kickoff handoff](../../../repo/pjm/handoffs/BL-260916-add-consensus-review-cross.md).
