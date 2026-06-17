---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-17
oat_generated: false
---

# Discovery: consensus-peer-invocation

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details.

- Prefer outcomes and constraints over concrete deliverables (no specific scripts, file paths, or function names).
- If an implementation detail comes up, capture it as an **Open Question** for design (or a constraint), not as a deliverable list.

## Initial Request

Kick off an OAT planning project in `/Users/tstang/Code/skills` for replacing
or reducing the Paseo CLI dependency in the consensus plugin. The initiative
combines backlog items `bl-bb7e` (in-house peer-invocation CLI) and `bl-3a88`
(tool-based verdict submission), using the newly landed TypeScript/Vitest
generated-runtime substrate from PR #13 and PR #14 as the planning baseline.

The first pass is planning only. It must not implement peer-invocation code,
modify consensus runtime behavior, edit generated runtime files, or update
backlog statuses unless a concrete reference update becomes necessary.

The operator lean is to support the narrow provider floor `claude` + `codex` +
`cursor`, drawing from Stoa's direct provider adapter and final JSON contract
rather than depending on Paseo for one per-turn `run` capability.

## Clarifying Questions

No live clarification was needed in this pass because the request included the
core planning boundaries and operator preference. The discovery decision is
therefore based on the user's explicit instruction plus repository and Stoa
source review.

### Question 1: Workflow Depth

**Q:** Should this continue as quick lightweight design or full spec-driven
design?
**A:** The request explicitly prefers spec-driven mode unless discovery proves
quick mode sufficient, and calls out provider contracts, structured output,
cursor behavior, inventory/preflight, error taxonomy, audit compatibility,
generated-runtime constraints, and migration sequencing.
**Decision:** Promote from quick-start discovery to spec-driven design. The next
artifact should be produced by `oat-project-design`, which will confirm
requirements and produce formal `spec.md` + `design.md` in one pass.

### Question 2: CLI Boundary

**Q:** Is the goal primarily an internal consensus-plugin adapter, or should the
initiative define a reusable `consensus` CLI surface?
**A:** The user increasingly sees value in owning peer-invocation CLI tooling as
a `consensus` CLI. If it does the job Stoa needs too — executing providers with
structured output and reliable error messages — Stoa could consume it later
instead of repeating mostly the same provider logic.
**Decision:** Reframe the preferred direction around one reusable CLI boundary:
the consensus plugin uses it first, but the contract should be clean enough that
Stoa or future tools can call the same surface.

## Solution Space

_Include this section only when the request is exploratory or multiple viable approaches exist. For well-understood requests with an obvious approach, omit or replace with a single sentence stating the chosen direction._

Discovery reviewed three materially different strategies. Updated
recommendation: continue as a spec-driven design/spike for a small reusable
`consensus` CLI that owns peer invocation, structured output normalization,
provider readiness diagnostics, and consensus verdict submission. The consensus
plugin should be the first consumer, but the boundary should be general enough
that Stoa can later reuse it for provider execution with structured output and
reliable errors.

### Approach 1: Reusable `consensus` CLI Boundary _(Recommended)_

**Description:** Define a small `consensus` CLI as the owned peer-invocation
control surface. It would cover provider inventory/preflight, one-shot provider
execution, structured-output delivery and validation, normalized diagnostics,
and eventually validated verdict submission. The consensus plugin would call it
through the existing `invokePeer` seam, while Stoa could later replace its local
provider adapter with the same CLI if the contract fits.
**When this is the right choice:** Best when the real goal is to avoid repeating
provider command, structured-output, and error-normalization logic across
multiple repos. It also gives the consensus plugin a clean replacement for
Paseo without hiding the new primitive inside one skill wrapper.
**Tradeoffs:** The CLI boundary must avoid becoming a broad provider platform.
The first contract should remain narrow enough to serve the consensus plugin and
Stoa's shared need: provider execution with structured output and reliable
errors.

### Approach 2: Plugin-Local Direct Adapter

**Description:** Replace the default Paseo-backed invoker with a
dependency-free TypeScript provider adapter that lives inside the consensus
plugin codebase and builds direct one-shot commands for the narrow provider set.
**When this is the right choice:** Best if minimizing first-implementation scope
is more important than reuse. It preserves the existing consensus loop and
artifact shape with the smallest new runtime surface.
**Tradeoffs:** This repeats the same class of provider logic Stoa already owns
and future tools may need. It removes Paseo from the plugin but does not solve
the broader duplication problem.

### Approach 3: Verdict Submission as a Dedicated Primitive

**Description:** Center the design on `consensus submit` as the mechanism peers
use to validate and submit verdicts, with provider execution as supporting
plumbing.
**When this is the right choice:** Best if reliability against structured-output
flakiness is more important than the provider execution abstraction itself. It
normalizes Claude, Codex, and Cursor because even providers with soft schema
behavior can self-correct through a validated tool call.
**Tradeoffs:** Larger first design surface. The design must answer how stateless
per-turn peers receive tool access, whether CLI or MCP is available in each
provider sandbox, how the orchestrator captures submissions, and how audit
records map to the current artifact contract.

### Approach 4: Keep Paseo as the Runtime Backend

**Description:** Stay with `paseo run --provider ... --output-schema ... --json`
and invest only in wrappers, tests, and documentation around the current
dependency.
**When this is the right choice:** Best if broad ACP provider coverage becomes a
product goal, or if direct provider CLI drift is judged more expensive than the
current install/daemon/version friction.
**Tradeoffs:** Keeps the current prerequisite burden and leaves the consensus
plugin dependent on a much larger surface than it uses. It also does not solve
structured-output issues already observed with strict or soft schema paths.

### Chosen Direction

**Approach:** Spec-driven design for a reusable `consensus` CLI boundary, with
provider execution and structured-output reliability as the first jobs and
verdict submission evaluated as a likely first-class CLI capability.
**Rationale:** A plugin-local adapter would remove Paseo but still duplicate the
same provider logic Stoa needs. A reusable CLI gives the consensus plugin a
clean migration target while creating one owned surface for provider execution,
structured output, and reliable diagnostics.
**User validated:** In progress. The user has confirmed the CLI direction; the
remaining discovery question is how public/reusable that boundary should be in
the first implementation.

## Options Considered

Specific options that need to be resolved in `spec.md`/`design.md`:

### Option A: Shared `consensus` CLI Boundary

**Description:** Build the design around a small CLI boundary that can execute a
provider with a structured-output contract and return reliable normalized
results or errors. The consensus plugin is the first consumer; Stoa compatibility
is a contract pressure, not a requirement to migrate Stoa in this project.

**Pros:**

- Prevents repeating provider invocation logic in consensus, Stoa, and future
  tools.
- Creates a clear owned replacement for the single Paseo capability consensus
  uses.
- Can still integrate with the existing `invokePeer` seam as the first
  migration point.

**Cons:**

- Requires stronger boundary design than a plugin-local helper.
- Needs careful scope control so it does not grow into a broad provider platform.

**Chosen:** Preferred direction.

**Summary:** The design should treat the CLI as the durable primitive and the
consensus plugin as its first consumer.

### Option B: Submit-Tool Backend First

**Description:** Make a validated verdict-submission command part of the CLI
contract before or during the provider-execution migration.

**Pros:**

- Addresses the strongest reliability concern directly.
- Makes Cursor's soft-schema path less special.
- Gives peers schema validation feedback in-context instead of relying on
  blind external retry prompts.

**Cons:**

- Requires design around tool exposure, sandbox behavior, submission capture,
  and failure/audit semantics.
- Larger first migration and more risk of changing runtime behavior.

**Chosen:** Open as a core design question.

**Summary:** This may be the right target contract, but discovery is not enough
to declare it as the first implementation slice.

### Option C: Paseo Compatibility Bridge

**Description:** Keep Paseo as a fallback backend while the direct provider
adapter or submit-tool path proves itself.

**Pros:**

- Reduces migration risk and allows side-by-side dogfooding.
- Keeps broad ACP support available while the narrow provider floor is hardened.

**Cons:**

- Extends the period with two peer-invocation paths.
- Requires explicit configuration and tests to avoid ambiguous failures.

**Chosen:** Keep as a design option, not a default assumption.

**Summary:** Useful for migration sequencing, but the initiative's goal remains
owning the narrow provider path.

## Key Decisions

1. **Workflow Mode:** Promote to spec-driven design because quick lightweight
   design would skip too many contract decisions.
2. **Initiative Scope:** Treat `bl-bb7e` and `bl-3a88` as one peer-invocation
   initiative, not separate near-term implementation tasks.
3. **Provider Floor:** Design for `claude`, `codex`, and `cursor`; broad ACP
   provider coverage is explicitly not a floor.
4. **Source Material:** Use Stoa's `provider-adapter.ts` and
   `final-json-contract.ts` as proven source material, but narrow and adapt them
   to the consensus plugin's dependency-free generated-runtime constraints.
5. **Migration Boundary:** Preserve `runConsensusLoop` and wrapper runtime
   behavior during planning. Design against the existing `invokePeer` seam and
   current validation/audit records.
6. **Generated Runtime:** Implementation must edit canonical TypeScript under
   `src/`, then regenerate committed `.mjs` outputs through
   `scripts/build-generated.mjs`. Generated files must not be hand-edited.
7. **CLI Boundary:** Prefer one owned `consensus` CLI surface over duplicating
   direct provider invocation, structured-output delivery, and diagnostics logic
   across consensus and Stoa.

## Constraints

- Planning only in this pass; no peer-invocation implementation.
- Do not edit generated runtime files or modify consensus runtime behavior.
- Do not update backlog statuses as part of this pass.
- Runtime plugin code must remain dependency-free and use Node standard library
  APIs unless a future decision changes the shipped-plugin contract.
- Node >=22 and pnpm are the expected development/runtime baseline.
- Provider-facing runtime output remains committed `.mjs` under the plugin tree;
  canonical TypeScript source lives under `src/`.
- Current schema validation, byte caps, resume/audit-trail behavior, and
  structured record formats must remain compatible unless design explicitly
  records a migration.
- Cursor must be treated as a soft-schema provider unless new live evidence
  proves a native schema flag exists.
- Stoa compatibility should influence the CLI contract, but this project should
  not require migrating Stoa as part of the first implementation.

## Success Criteria

- A spec/design pass defines the owned peer-invocation architecture for the
  narrow provider floor.
- The design defines the `consensus` CLI boundary clearly enough that consensus
  can use it first and Stoa can evaluate it later without copying provider
  logic again.
- The design chooses or phases provider execution vs. submit-tool verdict
  submission with explicit tradeoffs.
- The design defines provider adapter contracts, provider inventory/preflight,
  schema delivery, validation/retry, and error taxonomy parity with current
  Paseo-backed behavior.
- The design preserves artifact/audit compatibility or documents the exact
  migration.
- The design includes a migration sequence from current Paseo-backed
  `invokePeer`, with clear verification and rollback/fallback strategy.
- The later implementation plan avoids generated-file hand edits and uses
  Vitest/build drift guards for canonical TypeScript changes.

## Out of Scope

- Implementing a direct provider adapter.
- Implementing a submit-tool or MCP verdict submission surface.
- Changing consensus runtime behavior, prompt behavior, artifact format, or
  generated `.mjs` files during this planning pass.
- Expanding provider support beyond `claude`, `codex`, and `cursor`.
- Public release/distribution claims about provider support.

## Deferred Ideas

- Broad ACP adapter catalog replacement - deferred because the provider floor is
  intentionally narrow.
- Cursor-as-peer Paseo-path verification - useful only if the project decides to
  keep Paseo or needs more Cursor behavior evidence.
- Consensus family skill implementation (`evaluate`, `create`, `decide`,
  `plan`, `research`) - separate roadmap lane.

## Open Questions

- **Provider IDs:** Should consensus keep user-facing IDs
  `claude`/`codex`/`cursor` and map them internally to Stoa-style
  `claude-cli`/`codex-exec`/`cursor-agent`, or introduce a new normalized
  adapter ID layer?
- **CLI Reuse Boundary:** Should the first `consensus` CLI contract be treated
  as internal-to-this-repo but intentionally reusable, or should it be packaged
  as a stable cross-repo tool from the start?
- **Schema Delivery:** Which schemas should use provider-native delivery, and
  which should use prompt-only delivery plus post-run validation?
- **Codex Native Mode:** Should Codex always use `--output-schema`, or only when
  the contract is constrained enough to avoid strict-output quirks?
- **Cursor Output:** What exact Cursor JSON envelope and success/failure fields
  should be accepted, and how should invalid Cursor output map to consensus
  errors?
- **Verdict Submission:** Should submit-tool be a CLI, MCP tool, or both? How is
  it made available to stateless per-turn peer invocations?
- **Submission Capture:** If a submit-tool exists, does the orchestrator read a
  sidecar file, stdout envelope, temp directory, or structured event stream?
- **Retry Semantics:** Which failures retry inside the provider adapter vs.
  inside the consensus loop? How do validation errors get returned to a peer for
  self-correction?
- **Preflight:** What replaces `paseo --version` and
  `paseo provider ls --json` for executable discovery, auth/readiness, and
  provider inventory?
- **Error Taxonomy:** What are the new equivalents for `PASEO_MISSING`,
  `PEER_UNAVAILABLE`, `PASEO_EXIT`, and `PASEO_INVALID_JSON`, and which old
  codes need compatibility aliases?
- **Migration Switch:** Is the new backend selected by config, env var, CLI
  flag, or compile-time default during A/B dogfooding?

## Assumptions

- PR #13 and PR #14 are present in `origin/main`; verified `HEAD` is
  `1095718 refactor(consensus): migrate refine wrapper to TypeScript (#14)`.
- The consensus loop's existing `invokePeer` seam is stable enough to preserve
  control flow during migration.
- Stoa's direct provider adapter and final JSON contract are portable as design
  source material, but not copy-paste ready for the consensus plugin because
  Stoa depends on workspace packages and server-specific logging/config types.
- The narrow provider floor is acceptable even though it gives up Paseo's broad
  ACP adapter catalog.
- Owning one CLI surface is preferable to repeating mostly identical provider
  invocation logic in consensus, Stoa, and future tools, provided the first CLI
  contract stays narrow.

## Risks

- **Provider CLI Drift:** Direct adapters may break when Claude, Codex, or
  Cursor CLI flags change.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Keep adapters narrow, test command construction, add
    preflight diagnostics, and preserve Paseo fallback during migration if
    design chooses.
- **Structured Output Reliability:** Prompt-only final JSON remains fragile for
  Cursor.
  - **Likelihood:** High
  - **Impact:** High
  - **Mitigation Ideas:** Evaluate submit-tool verdict submission as a first
    class design option, and preserve validation/retry/cap logic.
- **Audit Trail Regression:** Changing where verdicts are captured could break
  resume or artifact provenance.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Design around current record formats and add
    compatibility tests before changing runtime behavior.
- **Generated Runtime Drift:** Adding new TS sources without proper build
  mappings could leave shipped `.mjs` stale.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Extend `scripts/build-generated.mjs` deliberately and
    require `pnpm run build:check` / generated-output tests.
- **Scope Creep:** Broad ACP replacement could turn a narrow peer-invocation
  project into a provider platform.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Keep `claude` + `codex` + `cursor` as the floor and
    document broad ACP support as explicitly out of scope unless product goals
    change.
- **Reusable CLI Overreach:** Designing for Stoa and future tools could make the
  first consensus migration too broad.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Treat Stoa as a contract-shaping future consumer, not
    as an implementation requirement for this project.

## Next Steps

Continue with `oat-project-design`. That workflow should confirm requirements
and produce formal `spec.md` and `design.md` before any implementation plan is
written.
