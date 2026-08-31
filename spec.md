---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-08-31
oat_generated: false
oat_template: false
---

# Specification: coding-session-handoff

## Problem Statement

Agent sessions are usually discovered and resumed in the filesystem directory where
they began. When a developer moves the same Git work into a different existing
worktree, the branch can move independently but the relevant Codex and Claude Code
sessions become difficult to identify and continue. Native session IDs can bridge the
gap, but finding the right IDs across providers, validating the target, and invoking
continuity safely is currently manual and error-prone.

The product must provide one provider-neutral workflow for exact-source discovery,
explicit selection, privacy-safe inspection, target validation, and provider-native
continuity. It must preserve the source session by default, keep provider stores
authoritative, and distinguish verified execution from plans, deferrals, refusals,
and unresolved child reporting. No heuristic such as recency may silently choose a
session or prove that a source writer is closed.

## Goals

### Primary Goals

- Enumerate every Codex and Claude Code session associated with one exact source
  worktree without changing observer state, discovery caches, or provider stores.
- Let the user explicitly select one, several, or all displayed candidates and inspect
  bounded, hidden-payload-sanitized conversation previews when desired.
- Validate an existing target worktree for the same repository and surface Git safety
  evidence before any provider-native operation.
- Produce truthful provider-native successor, same-ID resume, or read-only plan
  outcomes with an explicit batch confirmation boundary and recoverable itemized
  results.

### Secondary Goals

- Reconcile successor lineage when provider evidence is exact and report ambiguity
  without guessing when it is not.
- Provide stable JSON output for agent orchestration in addition to concise human
  output.

## Non-Goals

- Cursor mutation support in v1.
- Cross-host transcript or session-payload synchronization.
- Worktree creation, movement, branch synchronization, Git push/pull, commit transfer,
  or dirty-diff transfer.
- Rewriting provider transcript files, session databases, or recorded cwd metadata.
- A persistent handoff registry, daemon, hook, journal, or background reconciler.
- Generic provider-write abstractions or changes to Orc.
- Automatic approval, sandbox, hook-trust, permission, or workspace-trust bypasses.

## Requirements

### Functional Requirements

**FR1: Exact-worktree session discovery**

- **Description:** Enumerate Codex and Claude Code candidates recorded for the exact
  canonical source worktree, qualified by provider and deduplicated by native identity.
- **Acceptance Criteria:**
  - All exact-source candidates are returned, including multiple candidates per
    provider and Codex sessions older than the observer's normal recency window.
  - Related-worktree and global candidates are excluded from the default result.
  - No candidate is selected or marked current merely because it is recent.
  - `current` is set only from direct provider/session identity evidence; otherwise the
    candidate reports no current identity.
  - If bounded scanning cannot establish the complete exact set, discovery fails closed
    as incomplete and cannot feed selection or mutation.
- **Priority:** P0

**FR2: Bounded sanitized preview and comparison**

- **Description:** Allow opt-in preview or comparison of selected candidates using only
  bounded user and assistant conversation rounds.
- **Acceptance Criteria:**
  - Tool calls/results, commands, control messages, hidden/injected payload classes,
    transcript paths, and provider metadata are excluded from preview content.
  - Round and character limits are enforced before rendering.
  - Transcript reads have explicit per-file and aggregate bounds; malformed, oversized,
    or unreadable input yields path-free reason codes and never falls back to an
    unbounded whole-file read.
  - A preview request accepts at most 20 candidates and is bounded across the whole
    batch by 32 MiB/100,000 input records, 10 seconds elapsed time, and 128 KiB of
    rendered conversation text. Crossing any aggregate bound fails the complete
    comparison as `preview-incomplete`; it never returns a partial batch that appears
    complete.
  - Preview output is never copied into a handoff plan, confirmation digest, native
    result, or reconciliation ledger.
  - The UI states that sanitization removes hidden/control payloads but is not a
    guarantee that human-pasted secrets are absent.
- **Priority:** P1

**FR3: Explicit one, many, or all selection**

- **Description:** Require provider-qualified explicit selection of one or more exact
  candidates, or an explicit request for all displayed candidates.
- **Acceptance Criteria:**
  - Bare native IDs, implicit defaults, and recency selectors are rejected.
  - Single, repeated multi-selection, and explicit all-selection are deterministic.
  - Unknown, duplicated, or out-of-boundary identifiers fail before planning.
- **Priority:** P0

**FR4: Existing target and Git safety validation**

- **Description:** Validate the existing target worktree and report source/target Git
  evidence without transferring Git state.
- **Acceptance Criteria:**
  - Source and target resolve to registered worktrees sharing the same canonical Git
    common directory.
  - Canonical path, branch or detached state, HEAD, and clean/dirty state are reported.
  - A distinct dirty source refuses the batch in v1; target dirty state is prominently
    reported and included in confirmation evidence.
  - Missing paths, non-worktrees, distinct clones with similar remotes, and changed Git
    evidence fail closed.
- **Priority:** P0

**FR5: Distinct continuity modes**

- **Description:** Support `successor`, advanced same-ID `resume`, and read-only `plan`
  semantics without conflating them.
- **Acceptance Criteria:**
  - `successor` is the default and preserves the source identity.
  - `resume` is refused unless a trustworthy provider/host signal proves the source
    writer is closed; inactivity and mtime never satisfy that proof.
  - `plan` performs no native operation and reports the exact eligible invocation or
    refusal/defer reason.
  - The current active turn is deferred to a precise post-turn operation rather than
    reported as moved in place.
- **Priority:** P0

**FR6: Provider capability and behavioral gates**

- **Description:** Probe installed Codex and Claude Code command contracts and enable
  native execution only for behavior proven on the detected version.
- **Acceptance Criteria:**
  - Probes are bounded and verify exact version plus required help/usage shape without
    retaining raw help output.
  - Syntax probes never claim to prove target cwd, successor identity, source
    resumability, or metadata effects.
  - Each executable operation requires disposable two-worktree evidence covering
    parent/child IDs, runtime cwd, source resumability, and metadata effects.
  - A machine-validated receipt binds that evidence to the exact provider version and
    normalized syntax and execution-context fingerprints; reviewed source records only
    the receipt digest and redacted contract metadata.
  - The Codex contract disables lifecycle hooks through the documented `--disable
    hooks` capability. The gate, plan digest, and pre-execution check bind a
    privacy-safe fingerprint of the remaining executable/configuration context and
    defer when that context is unreadable or drifts.
  - Gate cleanup uses only documented provider-owned operations scoped to the fresh
    disposable fixture. Cleanup outcomes are finalized before the mode-0600 receipt is
    written and hashed; failed cleanup makes the gate inconclusive.
  - Implementation must run that gate for successor mode on the exact installed Codex
    and Claude versions. Both providers must pass before v1 is considered complete;
    inability to establish either contract is a reported product blocker rather than a
    silent plan-only scope reduction.
  - After verified contracts are recorded, exact matching versions may execute;
    version/help drift or missing behavioral evidence still produces a labeled
    plan/deferred item and never native success.
- **Priority:** P0

**FR7: Complete plan and explicit confirmation**

- **Description:** Construct and display the complete structured batch before any
  provider-native operation and require confirmation of the exact revalidated plan.
- **Acceptance Criteria:**
  - The plan includes Git evidence, selected provider-qualified IDs, continuity mode,
    capability state, per-item disposition, and structured native argv/cwd.
  - A stable digest covers all mutation-relevant evidence while excluding transcript
    content, transcript paths, and timestamps.
  - Execution recomputes the plan immediately before launch and refuses a missing,
    mismatched, or stale digest.
- **Priority:** P0

**FR8: Provider-native mutation with truthful timing**

- **Description:** Delegate any session mutation to the provider's own CLI using
  structured argv and the target cwd.
- **Acceptance Criteria:**
  - No provider store or transcript record is edited directly.
  - Only the locally verified Codex and Claude Code invocation shapes are planned.
  - A digest-confirmed successor on each exact verified installed version can launch
    a bounded provider-native non-interactive marker operation and report the exact
    child identity from machine output plus transcript corroboration.
  - The verified safety argv and execution-context fingerprint are revalidated before
    launch; unsupported hook isolation or context drift defers the item.
  - Current-turn, unavailable-authentication, unverified, and unsafe batch conditions
    become itemized deferrals or refusals.
  - No dangerous bypass flag appears in a planned or executed invocation.
- **Priority:** P0

**FR9: Itemized native and reporting outcomes**

- **Description:** Preserve native-operation outcome separately from child/reporting
  reconciliation for every selected parent.
- **Acceptance Criteria:**
  - Each item reports native status and reporting status independently.
  - Native success remains success if child mapping is unresolved.
  - Outcomes retain any provider-generated expected child ID, parsed machine child ID,
    and provider-qualified target baseline independently from corroboration status, so
    read-only reconciliation can retry exact evidence without recency inference.
  - A parsed-but-uncorroborated child is labeled as such and is never presented as a
    verified mapping.
  - Reconciliation maps a child only from exact lineage evidence and never from
    recency alone.
  - Only failed or deferred native items are eligible for native retry; successful
    parent operations are never repeated automatically.
  - `failed` is valid only with explicit proof that the operation ended before child
    creation and contains no observed, candidate, or mapped child evidence. Any
    nonzero, terminated, or timed-out operation with possible child creation is
    non-retryable `indeterminate`.
- **Priority:** P0

**FR10: Public standalone skill workflow**

- **Description:** Ship one user-facing skill that guides discovery, optional preview,
  selection, target evidence review, confirmation, provider-native action or truthful
  deferral, and outcome reporting.
- **Acceptance Criteria:**
  - The skill is publicly discoverable for supported providers and documents Codex and
    Claude Code as the v1 floor.
  - Skill instructions require explicit confirmation before mutation and explain plan,
    defer, refuse, native, and reporting outcomes.
  - Cursor, cross-host transfer, Git synchronization, and persistent state are not
    represented as supported v1 behavior.
- **Priority:** P0

### Non-Functional Requirements

**NFR1: Read-only inspection**

- **Description:** Discovery, preview, comparison, planning, and reconciliation must be
  observational only.
- **Acceptance Criteria:**
  - Observer offsets, transcript/provider stores, and persistent transcript-discovery
    caches—including `codex-cwd-cache.json`—remain unchanged.
  - Read-only Codex discovery ignores persistent cache reads as well as writes so stale
    cached metadata cannot influence a mutating selection.
- **Priority:** P0

**NFR2: Privacy and output minimization**

- **Description:** Treat transcript content and provider output as sensitive and retain
  no new durable handoff state.
- **Acceptance Criteria:**
  - Plans, digests, results, and diagnostics contain no transcript bodies, hidden
    instructions, transcript paths, raw provider help/output, or credentials.
  - Output contains only bounded safe metadata and explicit user-requested preview.
- **Priority:** P0

**NFR3: Fail-closed security**

- **Description:** Validate untrusted paths, IDs, Git evidence, capability output, and
  subprocess boundaries without shell interpolation.
- **Acceptance Criteria:**
  - Native commands use argv arrays with shell execution disabled.
  - Ambiguous repository identity, writer state, lineage, capability state, or plan
    freshness never silently proceeds.
  - Provider execution-context isolation and fingerprints are revalidated before
    mutation; unreadable or changed context defers rather than executing.
- **Priority:** P0

**NFR4: Dependency-free shipped runtime**

- **Description:** The shipped skill runtime must use Node.js 22+ standard-library APIs
  only and require no install step beyond the skill package.
- **Acceptance Criteria:**
  - Generated runtime output is reproducible from canonical TypeScript.
  - No runtime dependency is added to the public skill.
- **Priority:** P0

**NFR5: Bounded resource use**

- **Description:** Discovery, preview, Git checks, and provider probes must have explicit
  work and output bounds.
- **Acceptance Criteria:**
  - Preview round/character limits, probe time/output caps, and deterministic candidate
    ordering are enforced.
  - Preview candidate count, aggregate input bytes/records, elapsed time, and aggregate
    rendered characters are hard bounded with all-or-error comparison semantics.
  - Malformed or oversized provider/transcript input yields bounded diagnostics.
- **Priority:** P1

**NFR6: Repository and installation compatibility**

- **Description:** Integrate with the repository's public-skill, generated-output,
  versioning, documentation, and provider-sync contracts.
- **Acceptance Criteria:**
  - Repository tests, generated-output checks, validation, full tests, smoke, docs
    navigation, and provider installation compatibility pass.
  - The new skill begins at version 1.0.0 with matching version fields.
- **Priority:** P0

## Constraints

- Node.js 22+ and Node standard-library runtime APIs only.
- Current verified syntax evidence is scoped to Codex CLI 0.151.0 and Claude Code
  2.1.251; later versions require revalidation.
- Neither installed provider exposes trustworthy writer-closed evidence.
- This project's autonomous implementation authorization includes bounded disposable
  live-provider successor verification for the exact installed versions. The gate may
  mutate only disposable provider-owned sessions/worktrees and may consume bounded
  provider quota; it must not use real project sessions as fixtures.
- Provider stores and transcript files remain immutable inputs.
- Provider-owned cleanup may delete only state associated with the gate's fresh
  disposable IDs or project paths, using documented native commands. It never unlinks
  provider files directly.
- Default persistence is none.
- Local implementation commits are allowed; push, PR, publishing, release, and GitHub
  mutation are not.

## Dependencies

- Existing shared transcript runtime discovery, metadata extraction, normalization,
  and hidden-payload sanitization.
- Git CLI for registered-worktree and repository identity evidence.
- Installed Codex and Claude Code CLIs for bounded capability probes and native
  continuity operations.
- Repository generated-runtime builder, validators, Vitest suites, and documentation
  tooling.

## High-Level Design (Proposed)

Add a small handoff runtime that composes the repository's shared transcript substrate
through an explicitly mutation-free discovery option. It produces provider-qualified
candidates and bounded sanitized previews, validates canonical Git worktree evidence,
and constructs a complete immutable handoff plan with a confirmation digest.

Provider adapters own only capability probing and exact native invocation planning.
The orchestration layer keeps `plan`, native execution, and read-only reconciliation
separate. Provider-native operations are enabled only when exact version and disposable
behavioral evidence are available; otherwise the product returns precise post-turn
commands and labeled deferrals. Results remain ephemeral and separate native success
from reporting success.

**Key Components:**

- Read-only session discovery and preview.
- Git worktree evidence and plan freshness validation.
- Codex and Claude Code capability/invocation adapters.
- Batch planning, confirmation, native outcome, and reconciliation orchestration.
- Public skill instructions and human/JSON rendering.

**Alternatives Considered:**

- Durable cross-provider registry — rejected because v1 does not need another identity,
  concurrency, or privacy surface.
- Provider-store rebinding — rejected because private provider storage is not a safe or
  supported migration API.
- Provider-specific public skills — rejected because users need one consistent
  cross-provider workflow and shared safety semantics.

## Success Metrics

- All exact-source fixture candidates are returned with zero recency selections and
  zero related/global leaks.
- Read-only fixture runs leave observer state, persistent discovery cache, transcripts,
  and provider stores byte-identical.
- Every mutating path requires an exact confirmation digest and produces no shell or
  bypass-flag invocation.
- Every mixed batch has a one-to-one selected-parent outcome ledger and never places a
  successful parent in the native retry set.
- Disposable native gates pass for successor mode on exact Codex 0.151.0 and Claude
  Code 2.1.251, and the resulting source-controlled contracts enable confirmed native
  execution with exact parent-to-child outcomes for those versions.
- All repository, build, test, smoke, docs, and provider-install compatibility gates
  pass.

## Requirement Index

| ID | Description | Priority | Verification | Planned Tasks |
| --- | --- | --- | --- | --- |
| FR1 | Exact-worktree provider-qualified discovery | P0 | unit + integration: exact/related/global candidate fixtures | Pending plan mapping |
| FR2 | Bounded hidden-payload-sanitized preview | P1 | unit: preview filtering and bounds | Pending plan mapping |
| FR3 | Explicit one, many, or all selection | P0 | unit + CLI: selection parser and boundary validation | Pending plan mapping |
| FR4 | Existing target and Git safety evidence | P0 | unit + integration: registered-worktree Git fixtures | Pending plan mapping |
| FR5 | Successor, resume, and plan semantics | P0 | unit + CLI: mode and writer/current-turn decisions | Pending plan mapping |
| FR6 | Provider syntax and behavioral gates | P0 | unit + live gate: receipt-bound exact-version matrix | Pending plan mapping |
| FR7 | Complete digest-confirmed batch plan | P0 | unit + CLI: digest freshness and stale-plan refusal | Pending plan mapping |
| FR8 | Provider-native mutation and truthful deferral | P0 | unit + live gate: bounded machine successor execution | Pending plan mapping |
| FR9 | Separate native/reporting outcomes and retries | P0 | unit: mixed outcome and reconciliation ledger | Pending plan mapping |
| FR10 | Public standalone skill workflow | P0 | integration: layout, docs, version, and provider sync | Pending plan mapping |
| NFR1 | Mutation-free inspection and cache bypass | P0 | integration: empty/stale state remains unchanged | Pending plan mapping |
| NFR2 | Privacy-minimized output and no durable state | P0 | unit + integration: output absence assertions | Pending plan mapping |
| NFR3 | Fail-closed no-shell security | P0 | unit: adversarial IDs, paths, drift, and ambiguity | Pending plan mapping |
| NFR4 | Dependency-free generated Node runtime | P0 | build: generated-output and dependency checks | Pending plan mapping |
| NFR5 | Bounded resource use | P1 | unit: preview/probe/time/output limits | Pending plan mapping |
| NFR6 | Repository and installation compatibility | P0 | integration: validate, test, smoke, docs, sync | Pending plan mapping |

## Open Questions

- **Behavioral authorization:** The implementation gate must decide whether successor
  mode passes for exact Codex 0.151.0 and Claude Code 2.1.251. If either cannot be
  proven, stop with a product blocker; do not silently ship plan-only behavior.
- **Same-ID proof:** No installed provider currently exposes writer-closed proof, so
  what future provider/host evidence could enable `resume` without weakening v1?
- **Claude lineage:** Which stable native output or transcript field can corroborate a
  successor child without relying on recency?

## Assumptions

- Source and target are on the same machine and accessible to the invoking user.
- Git common-directory identity is the authoritative same-repository boundary for
  existing worktrees.
- Provider-qualified native IDs are the only durable session identities in v1.
- Users understand that an opt-in preview can contain human-pasted sensitive text even
  after hidden/control-payload sanitization.

## Risks

- **Provider drift:** CLI syntax or behavior changes after upgrade.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Exact-version/help probes plus required receipt-bound behavioral
    evidence; drift remains plan-only.
- **False writer inference:** Quiet transcripts appear safe to resume.
  - **Likelihood:** High
  - **Impact:** High
  - **Mitigation:** Unknown writer state always refuses same-ID resume.
- **Inspection side effects:** Reused discovery writes or trusts stale cache state.
  - **Likelihood:** High
  - **Impact:** High
  - **Mitigation:** Bypass persistent cache reads/writes and test empty/stale state.
- **Privacy leakage:** Preview exposes hidden payloads or human-pasted secrets.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Structural filtering, hidden-payload sanitization, strict bounds,
    opt-in warnings, and exclusion from every plan/result.
- **Partial native success:** A provider operation succeeds but lineage reporting does
  not.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation:** Independent native/reporting states and no retry of successful
    parents.

## References

- Discovery: `discovery.md`
- Knowledge base: `.oat/repo/knowledge/project-index.md`
- Supporting ADE packet:
  `/Users/thomas.stang/Documents/Codex/2026-08-30/new-realtime-voice-chat-2/ade-session-portability-handoff.md`
