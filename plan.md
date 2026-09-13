---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-09-12
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ["p-rev1"]
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: spec-driven
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: coding-session-handoff

## Current Revision Routing — p-rev1

**Authoritative scope:** the accepted 2026-09-12 revision in discovery/spec/design
replaces the automated-execution product below. Implement `p-rev1` beginning at
`prev1-t01`; do not resume p04-t02. User requested a planning handoff to Sol, not
implementation during this turn. Independent revision review found no blocking
findings; one Medium verification suggestion is preserved below for user disposition.

**New goal:** Provide read-only discovery, explicit selection, safe preview, existing
destination validation, and user-run destination-tab fork-and-open instructions for
Codex, Claude, and Cursor. Support current-source-session, other-source-session, and
fresh-destination-session entry points. Unsupported provider/surface transitions are
explicit; the fresh-session fallback is exit and relaunch in the same tab.

**Disposition of old work:** p01–p03 remain completed historical implementation.
p04-t01/p04-t02 and p05-t01/p05-t02 live/receipt gates are paused, not passed.
Unimplemented p05-t03/p05-t04 activation and p06-t01/p06-t03 packaging tasks are
superseded for the public guidance product by p-rev1, not completed or deleted.
Reserved p06-t02/p06-t04 closeout instructions are historical; use the revised
closeout below. Their old dependencies must not block or silently reactivate the
new guidance path. No old review-cap usage, findings, or evidence is erased.

**Review/closeout:** Independent review of this revised artifact, per-phase code
review, and final configured lifecycle review remain required. Historical HiLL
settings are preserved; p06 is no longer executable, so the implementation root must
confirm the checkpoint applicable to p-rev1 before starting, not silently skip it.
No live provider gate, installation, help/version/auth operation, cleanup, branch
push, PR update, or release is authorized by this revision.

The sections describing the original goal, dependencies, and p01–p06 below are
historical except for reusable implementation evidence. `p-rev1` is the sole active
implementation phase. Spec R1–R8 and design's revision section govern its acceptance.

> Execute this plan using `oat-project-implement`. Phases are sequential because each
> phase consumes contracts or reviewed evidence produced by the preceding phase.

**Goal:** Ship one public dependency-free skill that safely hands explicitly selected
Codex and Claude Code sessions to an existing sibling worktree through verified
provider-native successor operations, with exact parent-to-child outcomes and truthful
deferral when evidence is missing or unsafe.

**Architecture:** Extend the shared transcript substrate with bounded zero-persistence
reads, then compose handoff-specific discovery, preview, Git evidence, provider
contracts, immutable planning, native execution, and reconciliation under
`src/transcript/coding-session-handoff/`. Bundle one generated runtime for the public
skill; keep provider stores immutable and activate exact-version execution only after
disposable live gates and independent receipt review.

**Tech Stack:** Node.js 22+, TypeScript, Node standard library, Vitest, Git CLI, Codex
CLI 0.151.0, Claude Code 2.1.251, repository generated-runtime tooling, Fumadocs/MDX.

**Commit Convention:** `{type}(pNN-tNN): {description}`

## Planning Checklist

- [x] Defer HiLL checkpoint confirmation to `oat-project-implement`
- [x] Evaluated phase parallelism; all five implementation phases and the root gate boundary have hard evidence or source dependencies
- [x] Set `oat_plan_parallel_groups: []`
- [x] Mapped every FR/NFR to stable task IDs in `spec.md`
- [x] Pass independent plan artifact review

## Parallelism

There are useful peer lanes inside phases, but no safe phase-level parallel group:

- p01 transcript readers feed p02 discovery/preview.
- p02 freezes handoff types and Git evidence consumed by p03.
- p03 builds and receives normal phase review for the unverified gate runtime.
- Root then runs the four mandatory live-execution and receipt-review entry gates.
- p05 cannot start until all four gates pass, and it must activate both reviewed
  contracts before p06 can ship public guidance.

Within a phase, implementers may use bounded workers only for file-disjoint
reconnaissance or test generation. The phase implementer retains integration ownership.
Shared generated outputs, behavior-contract source, and project bookkeeping are always
single-owner surfaces.

---

## Phase p01: Mutation-free transcript substrate

**Goal:** Add bounded quiet readers and an exact-all, persistence-forbid discovery seam
without changing existing session-observer defaults.

### Task p01-t01: Add bounded quiet transcript readers

**Dependencies:** None.

**Files:**

- Modify: `src/transcript/core/runtimes.ts`
- Modify: `tests/transcript-core/runtimes.test.ts`
- Modify: `skills/session-observer/SKILL.md` (bump `1.0.25` → `1.0.26` in both version fields)
- Modify: `skills/export-session-transcript/SKILL.md` (bump `1.0.8` → `1.0.9` in both version fields)
- Modify (generated): `skills/session-observer/scripts/lib/runtimes.mjs`
- Modify (generated): `skills/export-session-transcript/scripts/lib/runtimes.mjs`

**RED:** Add tests for bounded metadata-prefix and tail readers covering byte/record
caps, malformed/oversized records, deadlines, partial final lines, and path-free
diagnostics.

Run: `pnpm exec vitest run tests/transcript-core/runtimes.test.ts`

Expected: new bounded-reader cases fail before the APIs exist.

**GREEN:** Implement standard-library-only readers that never fall back to whole-file
loading and never emit transcript paths. Preserve existing reader behavior for current
callers. Bump both affected existing skills once for the complete branch diff, run
`pnpm run build`, and include both generated runtime outputs in this task.

**Refactor:** Centralize byte/record/deadline accounting and safe diagnostic emission.

**Format:** `pnpm exec oxfmt --write src/transcript/core/runtimes.ts tests/transcript-core/runtimes.test.ts skills/session-observer/SKILL.md skills/export-session-transcript/SKILL.md`; regenerate generated runtimes with `pnpm run build` and do not format generated files.

**Verify:** `pnpm exec vitest run tests/transcript-core/runtimes.test.ts && pnpm run type-check && pnpm run build:check && pnpm run validate:skill-versions --base-ref origin/main`

**Commit:** `feat(p01-t01): add bounded transcript readers`

---

### Task p01-t02: Add exact-all zero-persistence discovery

**Dependencies:** p01-t01.

**Files:**

- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Modify (generated): `skills/session-observer/scripts/lib/locate.mjs`

**RED:** Add stale-cache, no-cache-write, older-than-seven-days, aggregate budget,
per-entry bound, and deadline tests. Pin existing default cache/recency behavior.

Run: `pnpm exec vitest run tests/session-observer/locate.test.ts`

Expected: exact-all and persistence-forbid cases fail while baseline cases pass.

**GREEN:** Add optional `persistence`, `recency`, budget, and safe-diagnostic policies.
Under handoff policies, bypass both Codex cache reads and writes, skip the seven-day
cutoff, classify all entries within fixed bounds, and return no partial candidate set.
Run `pnpm run build` and include the generated `locate.mjs`; the session-observer skill
version was already bumped in p01-t01 for this branch's canonical skill changes.

**Refactor:** Keep option defaults identical for existing session-observer consumers.

**Format:** `pnpm exec oxfmt --write src/transcript/session-observer/lib/types.ts src/transcript/session-observer/lib/locate.ts tests/session-observer/locate.test.ts`; regenerate `locate.mjs` with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/session-observer/locate.test.ts && pnpm run type-check && pnpm run build:check && pnpm run validate:skill-versions --base-ref origin/main`

**Commit:** `feat(p01-t02): add exact read-only session discovery`

---

### Task p01-t03: Prove shared-substrate non-mutation

**Dependencies:** p01-t01, p01-t02.

**Files:**

- Modify: `tests/session-observer/integration.test.ts`
- Modify: `tests/session-observer/cli.test.ts`

**RED:** Add integration assertions that an absent state directory remains absent, a
seeded cache stays byte-identical, transcripts and observer offsets do not change, and
legacy observer CLI behavior remains stable.

Run: `pnpm exec vitest run tests/session-observer/integration.test.ts tests/session-observer/cli.test.ts`

Expected: non-mutation coverage fails until the new seam is wired correctly.

**GREEN:** Make only bounded corrections required by the integration tests; do not add
handoff policy to session-observer defaults.

**Refactor:** Consolidate fixture hashing and state-absence assertions.

**Format:** `pnpm exec oxfmt --write tests/session-observer/integration.test.ts tests/session-observer/cli.test.ts`.

**Verify:** `pnpm exec vitest run tests/transcript-core/runtimes.test.ts tests/session-observer/locate.test.ts tests/session-observer/integration.test.ts tests/session-observer/cli.test.ts`

**Commit:** `test(p01-t03): prove read-only discovery invariants`

---

## Phase p02: Handoff discovery, preview, and Git evidence

**Goal:** Freeze handoff schemas, enumerate exact provider-qualified candidates, render
bounded opt-in previews, and prove source/target worktree identity.

### Task p02-t01: Define handoff schemas and limits

**Dependencies:** p01 complete.

**Files:**

- Create: `src/transcript/coding-session-handoff/types.ts`
- Create: `tests/coding-session-handoff/types.test.ts`

**RED:** Add runtime-schema fixtures for qualified IDs, candidates, preview limits, Git
evidence, capability states, plans, receipts, cross-discriminated outcomes, and JSON
envelopes. Reject contradictory retry/child combinations.

Run: `pnpm exec vitest run tests/coding-session-handoff/types.test.ts`

Expected: schema imports and validation cases fail.

**GREEN:** Implement leaf types, constants, and validators only. Keep preview types
structurally separate from plan and outcome types.

**Refactor:** Remove circular dependencies and expose stable reason-code unions.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/types.ts tests/coding-session-handoff/types.test.ts`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/types.test.ts && pnpm run type-check`

**Commit:** `feat(p02-t01): define handoff contracts`

---

### Task p02-t02: Implement exact candidate discovery

**Dependencies:** p02-t01.

**Files:**

- Create: `src/transcript/coding-session-handoff/discovery.ts`
- Create: `tests/coding-session-handoff/discovery.test.ts`

**RED:** Cover exact/sister/global cwd fixtures, provider-native ID collisions,
deterministic ordering, direct current identity, old Codex sessions, duplicate records,
and incomplete discovery refusal.

Run: `pnpm exec vitest run tests/coding-session-handoff/discovery.test.ts`

Expected: handoff discovery cases fail.

**GREEN:** Compose the shared exact-all/persistence-forbid seam into provider-qualified
candidate discovery. Ignore same-cwd fallback as current evidence and never select by
recency.

**Refactor:** Keep provider mapping and candidate signature projection deterministic.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/discovery.ts tests/coding-session-handoff/discovery.test.ts`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/discovery.test.ts tests/session-observer/locate.test.ts`

**Commit:** `feat(p02-t02): discover exact handoff candidates`

---

### Task p02-t03: Implement aggregate-bounded sanitized preview

**Dependencies:** p02-t01 and p01 bounded readers; peer to p02-t02 after types freeze.

**Files:**

- Create: `src/transcript/coding-session-handoff/preview.ts`
- Create: `tests/coding-session-handoff/preview.test.ts`
- Modify: `tests/export-session-transcript/sanitize.test.ts` only if a shared sanitizer regression is required

**RED:** Cover hidden/control/tool filtering, malformed tails, per-candidate round/char
limits, 21 candidates, aggregate bytes/records/render/deadline crossings, sanitizer
warning, path-free failures, and absence of preview from plan/outcome serialization.

Run: `pnpm exec vitest run tests/coding-session-handoff/preview.test.ts tests/export-session-transcript/sanitize.test.ts`

Expected: preview behavior and aggregate all-or-error limits fail.

**GREEN:** Normalize and sanitize only bounded user/assistant entries. Enforce 20
candidates, 32 MiB/100,000 input records, 10 seconds, and 128 KiB aggregate rendered
text; discard partial output on any aggregate crossing.

**Refactor:** Reuse canonical sanitizer functions without broadening their secret-free
claim.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/preview.ts tests/coding-session-handoff/preview.test.ts`; if the optional sanitizer test changes, include `tests/export-session-transcript/sanitize.test.ts`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/preview.test.ts tests/export-session-transcript/sanitize.test.ts && pnpm run type-check`

**Commit:** `feat(p02-t03): add bounded session previews`

---

### Task p02-t04: Validate exact Git worktree targets

**Dependencies:** p02-t01; peer to p02-t02/p02-t03.

**Files:**

- Create: `src/transcript/coding-session-handoff/git-target.ts`
- Create: `tests/coding-session-handoff/git-target.test.ts`

**RED:** Cover missing paths, non-worktrees, separate clones with similar remotes,
symlink aliases, same common Git directory, detached HEAD, dirty source refusal, dirty
target fingerprinting, oversized status, timeout, and evidence drift.

Run: `pnpm exec vitest run tests/coding-session-handoff/git-target.test.ts`

Expected: typed Git evidence cases fail.

**GREEN:** Use bounded `execFile`/argv Git calls with shell disabled. Canonicalize roots
and common directories, hash status without exposing filenames, and preserve detached
state.

**Refactor:** Centralize bounded Git subprocess/result parsing and typed failures.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/git-target.ts tests/coding-session-handoff/git-target.test.ts`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/git-target.test.ts && pnpm run type-check`

**Commit:** `feat(p02-t04): validate handoff worktrees`

---

### Task p02-t05: (review) Enumerate every exact Claude store entry

**Dependencies:** p02-t02.

**Files:**

- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Modify: `tests/coding-session-handoff/discovery.test.ts`
- Regenerate: `skills/session-observer/scripts/lib/locate.mjs`

**RED:** Add simultaneous direct-slug and alias/unexpected-slug Claude fixtures whose
transcript-record cwd values canonicalize to the same source, plus an unrelated cwd
control. Exact-all discovery must return both exact sessions and exclude the control.

**GREEN:** In bounded exact-all mode, enumerate every Claude project directory even
after direct hits, deduplicate transcript paths, and qualify candidates only from exact
canonical transcript-record cwd evidence. Preserve the legacy direct-first optimization
for default observer discovery.

**Verify:** `pnpm exec vitest run tests/session-observer/locate.test.ts tests/coding-session-handoff/discovery.test.ts && pnpm run build:check`

**Commit:** `fix(p02-t05): complete exact Claude enumeration`

---

### Task p02-t06: (review) Fail closed on metadata-prefix truncation

**Dependencies:** p02-t02; peer to p02-t05 after shared discovery behavior is understood.

**Files:**

- Modify: `src/transcript/core/runtimes.ts`
- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify: `tests/transcript-core/runtimes.test.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Regenerate: `skills/session-observer/scripts/lib/runtimes.mjs`
- Regenerate: `skills/export-session-transcript/scripts/lib/runtimes.mjs`
- Regenerate: `skills/session-observer/scripts/lib/locate.mjs`

**RED:** Cover a clean 129th metadata record, a late contradictory cwd, and a
byte-boundary truncation. Exact-all discovery must fail with stable path-free reason
codes instead of accepting a partial prefix.

**GREEN:** Surface every bounded-prefix incomplete condition to callers and make
exact-all reject incomplete metadata derivation. Preserve existing default-reader
behavior and diagnostic redaction.

**Verify:** `pnpm exec vitest run tests/transcript-core/runtimes.test.ts tests/session-observer/locate.test.ts && pnpm run build:check`

**Commit:** `fix(p02-t06): reject incomplete metadata prefixes`

---

### Task p02-t07: (review) Enforce preview input-work budgets during reads

**Dependencies:** p02-t03 and p02-t06.

**Files:**

- Modify: `src/transcript/core/runtimes.ts`
- Modify: `src/transcript/coding-session-handoff/preview.ts`
- Modify: `tests/transcript-core/runtimes.test.ts`
- Modify: `tests/coding-session-handoff/preview.test.ts`
- Regenerate: `skills/session-observer/scripts/lib/runtimes.mjs`
- Regenerate: `skills/export-session-transcript/scripts/lib/runtimes.mjs`

**RED:** Prove the 10,001st per-transcript inspection and aggregate byte/record
boundaries stop physical parsing before overshoot, including real-reader fixtures and
dependency-result validation.

**GREEN:** Separate retained-record and inspected-record budgets, pass each request's
remaining aggregate byte/record allowance into the reader, and stop I/O/parsing at the
boundary. Discard partial batch output on any crossing.

**Verify:** `pnpm exec vitest run tests/transcript-core/runtimes.test.ts tests/coding-session-handoff/preview.test.ts && pnpm run type-check && pnpm run build:check`

**Commit:** `fix(p02-t07): enforce preview work budgets`

---

### Task p02-t08: (review) Make qualified-ID ordering locale independent

**Dependencies:** p02-t02 and p02-t03.

**Files:**

- Modify: `src/transcript/coding-session-handoff/discovery.ts`
- Modify: `src/transcript/coding-session-handoff/preview.ts`
- Modify: `tests/coding-session-handoff/discovery.test.ts`
- Modify: `tests/coding-session-handoff/preview.test.ts`

**RED:** Cover mixed-case, punctuation, and non-ASCII qualified IDs in discovery and
preview ordering.

**GREEN:** Use one shared locale-independent code-unit comparator for qualified IDs.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/discovery.test.ts tests/coding-session-handoff/preview.test.ts`

**Commit:** `fix(p02-t08): stabilize qualified ID ordering`

---

### Task p02-t09: (review) Round-trip multiline preview text

**Dependencies:** p02-t01 and p02-t03.

**Files:**

- Modify: `src/transcript/coding-session-handoff/types.ts`
- Modify: `tests/coding-session-handoff/types.test.ts`
- Modify: `tests/coding-session-handoff/preview.test.ts`

**RED:** Add a producer-to-parser fixture containing ordinary newlines and tabs while
retaining rejection of NUL and unsafe terminal controls.

**GREEN:** Add a preview-specific text validator that permits intended multiline
whitespace without weakening other generic string fields.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/types.test.ts tests/coding-session-handoff/preview.test.ts && pnpm run type-check`

**Commit:** `fix(p02-t09): allow sanitized multiline previews`

---

### Task p02-t10: (review) Ignore unrelated stale worktree registrations

**Dependencies:** p02-t04.

**Files:**

- Modify: `src/transcript/coding-session-handoff/git-target.ts`
- Modify: `tests/coding-session-handoff/git-target.test.ts`

**RED:** Add a real-Git fixture with a valid requested worktree and an unrelated
missing/prunable registered sibling.

**GREEN:** Establish registration of the requested canonical root without requiring
unrelated entries to resolve, while still failing if the requested root is absent or
ambiguous.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/git-target.test.ts`

**Commit:** `fix(p02-t10): tolerate stale sibling worktrees`

---

### Task p02-t11: (review) Preserve NUL-delimited worktree paths

**Dependencies:** p02-t04; peer to p02-t10.

**Files:**

- Modify: `src/transcript/coding-session-handoff/git-target.ts`
- Modify: `tests/coding-session-handoff/git-target.test.ts`

**RED:** Add a real-Git fixture whose registered worktree path contains a newline.

**GREEN:** Parse the `worktree list --porcelain -z` grammar strictly by NUL fields
without newline tokenization, and retain literal argv/shell-disabled execution.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/git-target.test.ts`

**Commit:** `fix(p02-t11): parse NUL worktree records safely`

---

### Task p02-t12: (review) Align candidate timestamps to milliseconds

**Dependencies:** p02-t02.

**Files:**

- Modify: `src/transcript/coding-session-handoff/discovery.ts`
- Modify: `tests/coding-session-handoff/discovery.test.ts`

**RED:** Assert a transcript candidate expressed in epoch seconds projects to the
schema's `modifiedAtMs` millisecond contract.

**GREEN:** Multiply the shared candidate mtime by 1,000 at the handoff projection
boundary without changing session-observer's established seconds contract.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/discovery.test.ts`

**Commit:** `fix(p02-t12): project candidate timestamps in milliseconds`

---

### Task p02-t13: (review) Reject conflicting Codex cwd evidence

**Dependencies:** p02-t06 and p02-t12.

**Files:**

- Modify: `src/transcript/core/runtimes.ts`
- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify: `tests/transcript-core/runtimes.test.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Modify: `tests/coding-session-handoff/discovery.test.ts`
- Regenerate: `skills/session-observer/scripts/lib/runtimes.mjs`
- Regenerate: `skills/export-session-transcript/scripts/lib/runtimes.mjs`
- Regenerate: `skills/session-observer/scripts/lib/locate.mjs`

**RED:** Add bounded exact-all fixtures whose later top-level or `payload.cwd`
contradicts the first Codex cwd. Cover agreeing repeated values plus empty, relative,
and malformed cwd evidence. Conflicts and malformed evidence must fail with the stable
path-free incomplete reason and expose no candidate.

**GREEN:** Add a strict Codex cwd extractor that inspects every recognized top-level and
payload cwd in the bounded metadata prefix. Require non-empty absolute strings and
agreement across every observed value, then make bounded exact-all discovery reject
missing, malformed, or conflicting evidence. Preserve legacy/default observer behavior.

**Verify:** `pnpm exec vitest run tests/transcript-core/runtimes.test.ts tests/session-observer/locate.test.ts tests/coding-session-handoff/discovery.test.ts && pnpm run type-check && pnpm run build:check && pnpm run validate:skill-versions --base-ref origin/main`

**Commit:** `fix(p02-t13): reject conflicting Codex cwd evidence`

---

## Phase p03: Provider contracts, planning, execution, and CLI

**Goal:** Build the initially unverified provider matrix, immutable plan/execution state
machine, disposable gate harness, and one bundled CLI runtime.

### Task p03-t01: Implement provider probes and unverified contracts

**Dependencies:** p02 complete.

**Files:**

- Create: `src/transcript/coding-session-handoff/providers.ts`
- Create: `src/transcript/coding-session-handoff/behavior-contracts.ts`
- Create: `tests/coding-session-handoff/providers.test.ts`

**RED:** Cover missing binaries, exact versions, version/help/feature drift, 10-second
and 64 KiB probe bounds, auth metadata, Codex hook isolation, Claude safe mode, context
fingerprint drift/unreadable inputs, literal malicious argv, and forbidden bypass flags.

Run: `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts`

Expected: provider probe and invocation cases fail.

**GREEN:** Implement bounded probes, redacted syntax/context fingerprints, exact safe
argv builders, and source-controlled Codex 0.151.0 / Claude 2.1.251 entries whose
successor status begins `unverified`.

**Refactor:** Separate pure fingerprint/argv policy from subprocess boundaries.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/providers.ts src/transcript/coding-session-handoff/behavior-contracts.ts tests/coding-session-handoff/providers.test.ts`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts && pnpm run type-check`

**Commit:** `feat(p03-t01): add provider handoff contracts`

---

### Task p03-t02: Add exact provider lineage metadata

**Dependencies:** p01-t01; peer to p03-t01.

**Files:**

- Modify: `src/transcript/core/runtimes.ts`
- Modify: `tests/transcript-core/runtimes.test.ts`
- Modify (generated): `skills/session-observer/scripts/lib/runtimes.mjs`
- Modify (generated): `skills/export-session-transcript/scripts/lib/runtimes.mjs`

**RED:** Cover Codex `payload.id`, optional root `payload.session_id`,
`forked_from_id`, cwd, and Claude `sessionId`/`uuid`/`parentUuid`/cwd fields while
pinning existing `sessionId` caller compatibility.

Run: `pnpm exec vitest run tests/transcript-core/runtimes.test.ts`

Expected: native/root/lineage metadata cases fail.

**GREEN:** Extend shared metadata with explicit native/root/fork fields without changing
legacy session identity semantics. Run `pnpm run build` and include both generated
runtime outputs; the existing skill versions remain the branch-level bumps from
p01-t01.

**Refactor:** Keep provider record ownership inside transcript core.

**Format:** `pnpm exec oxfmt --write src/transcript/core/runtimes.ts tests/transcript-core/runtimes.test.ts`; regenerate both runtime outputs with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/transcript-core/runtimes.test.ts tests/session-observer/locate.test.ts && pnpm run type-check && pnpm run build:check && pnpm run validate:skill-versions --base-ref origin/main`

**Commit:** `feat(p03-t02): expose exact transcript lineage`

---

### Task p03-t03: Implement selection, plans, execution, and reconciliation

**Dependencies:** p03-t01, p03-t02, p02 discovery/Git/types.

**Files:**

- Create: `src/transcript/coding-session-handoff/handoff.ts`
- Create: `tests/coding-session-handoff/handoff.test.ts`
- Create: `tests/coding-session-handoff/reconcile.test.ts`

**RED:** Cover one/many/all selection, resume refusal, current-turn deferral, canonical
digest stability/drift, exact revalidation, sequential bounded execution, child
corroboration, `failed-before-child` proof, indeterminate handling, mapped/unresolved
reporting, exact reconcile selectors/baselines, and retry-key invariants.

Run: `pnpm exec vitest run tests/coding-session-handoff/handoff.test.ts tests/coding-session-handoff/reconcile.test.ts`

Expected: orchestration cases fail.

**GREEN:** Implement pure selection/policy/digest functions plus injected bounded
execution and read-only reconcile boundaries. Reject every contradictory runtime
outcome, including failed-plus-child evidence.

**Refactor:** Keep canonical digest projection, native state, and reporting state
separate and deterministic.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/handoff.ts tests/coding-session-handoff/handoff.test.ts tests/coding-session-handoff/reconcile.test.ts`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/handoff.test.ts tests/coding-session-handoff/reconcile.test.ts && pnpm run type-check`

**Commit:** `feat(p03-t03): orchestrate verified session handoffs`

---

### Task p03-t04: Implement disposable behavioral gates

**Dependencies:** p03-t01, p03-t02; may develop alongside p03-t03 before CLI join.

**Files:**

- Create: `src/transcript/coding-session-handoff/behavior-gate.ts`
- Create: `tests/coding-session-handoff/behavior-gate.test.ts`

**RED:** Cover mutation-free `behavior-plan`, digest mismatch, new receipt-path
requirement, atomic mode-0600 finalization, exact Codex/Claude fixture argv, bounded
output/time/budget, evidence parsing, provider/Git cleanup order, cleanup failure to
inconclusive, and stdout redaction.

Run: `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts`

Expected: gate engine cases fail.

**GREEN:** Create fresh temporary repositories/worktrees and disposable sessions only
after confirmation. Finalize cleanup outcomes before receipt write/hash; never unlink
provider stores or expose raw IDs/paths/output on stdout.

**Refactor:** Isolate injectable provider/Git/filesystem boundaries for deterministic
mock coverage.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/behavior-gate.ts tests/coding-session-handoff/behavior-gate.test.ts`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/providers.test.ts && pnpm run type-check`

**Commit:** `feat(p03-t04): add disposable behavior gates`

---

### Task p03-t05: Implement CLI commands and renderers

**Dependencies:** p03-t03, p03-t04.

**Files:**

- Create: `src/transcript/coding-session-handoff/cli.ts`
- Create: `tests/coding-session-handoff/cli.test.ts`

**RED:** Cover all seven commands, stable exit codes/envelopes, one JSON object on
stdout, explicit qualified selection, no recency/force option, digest confirmation,
provider-control isolation, parsed-unverified guidance, adversarial IDs/paths, and safe
errors.

Run: `pnpm exec vitest run tests/coding-session-handoff/cli.test.ts`

Expected: CLI cases fail.

**GREEN:** Add thin argument parsing and human/JSON rendering over services. Make
behavior verification unavailable on auth failure and execution unavailable for
unverified/context-drift contracts.

**Refactor:** Keep policy out of renderers and raw provider output out of envelopes.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/cli.ts tests/coding-session-handoff/cli.test.ts`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/cli.test.ts tests/coding-session-handoff/handoff.test.ts && pnpm run type-check`

**Commit:** `feat(p03-t05): add handoff command interface`

---

### Task p03-t06: Generate the pre-activation development runtime

**Dependencies:** p03-t01 through p03-t05.

**Files:**

- Modify: `scripts/build-generated.mjs`
- Modify: `.oxfmtrc.json`
- Modify: `.oxlintrc.json`
- Modify: `tests/tooling/generated-output-sync.test.ts`
- Create (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Add generated-output mapping/ignore coverage and a build parity assertion.

Run: `pnpm exec vitest run tests/tooling/generated-output-sync.test.ts`

Expected: the new mapping/output synchronization case fails.

**GREEN:** Add one bundled canonical TypeScript mapping to the non-public development
output under `tools/`, run `pnpm run build`, and commit that generated `.mjs`. This is
the only runtime p04 may execute before behavior activation. Do not create any
`skills/coding-session-handoff/` path yet, and never hand-edit generated output.

**Refactor:** Keep import rewrites derived by the existing builder.

**Format:** `pnpm exec oxfmt --write scripts/build-generated.mjs .oxfmtrc.json .oxlintrc.json tests/tooling/generated-output-sync.test.ts`; create the generated tool runtime only through `pnpm run build`.

**Verify:** `pnpm run build:check && pnpm exec vitest run tests/tooling/generated-output-sync.test.ts`

**Commit:** `build(p03-t06): generate handoff gate runtime`

---

### Task p03-t07: (review) Propagate exact Codex native identity

**Dependencies:** p03-t01 through p03-t06 and fix commits `703918c` and `304ec86`.

**Files:**

- Modify: `src/transcript/coding-session-handoff/discovery.ts`
- Modify: `src/transcript/coding-session-handoff/behavior-gate.ts`
- Modify: `src/transcript/coding-session-handoff/cli.ts`
- Modify: `tests/coding-session-handoff/discovery.test.ts`
- Modify: `tests/coding-session-handoff/behavior-gate.test.ts`
- Modify: `tests/coding-session-handoff/cli.test.ts`
- Modify: `tests/transcript-core/runtimes.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Add fixtures where the legacy/top-level Codex session ID, `payload.id`, and
`payload.session_id` are distinct. Prove selection argv, gate child corroboration, and
read-only reconciliation require the exact provider-native `payload.id`.

Run: `pnpm exec vitest run tests/coding-session-handoff/discovery.test.ts tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/cli.test.ts tests/transcript-core/runtimes.test.ts`

Expected: discovery and corroboration still use the legacy candidate ID.

**GREEN:** Carry required exact Codex native identity from bounded exact-all discovery
into `SessionCandidate.nativeId`; fail closed on missing or contradictory metadata.
Locate gate and production reconciliation evidence by parsed `meta.nativeSessionId`,
never by the legacy candidate ID. Regenerate the development bundle.

**Refactor:** Keep legacy transcript/session-observer identity behavior unchanged for
existing consumers; isolate the handoff-specific exact-native projection.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/discovery.ts src/transcript/coding-session-handoff/behavior-gate.ts src/transcript/coding-session-handoff/cli.ts tests/coding-session-handoff/discovery.test.ts tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/cli.test.ts tests/transcript-core/runtimes.test.ts`; regenerate the generated runtime with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/discovery.test.ts tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/cli.test.ts tests/transcript-core/runtimes.test.ts && pnpm run type-check && pnpm run build:check`

**Commit:** `fix(p03-t07): propagate exact Codex native identity`

---

### Task p03-t08: (review) Make partial Codex cleanup truthful

**Dependencies:** p03-t07.

**Files:**

- Modify: `src/transcript/coding-session-handoff/behavior-gate.ts`
- Modify: `tests/coding-session-handoff/behavior-gate.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Exercise default cleanup for an attempted creation with unknown parent ID,
known parent with unknown child ID, and known parent/child IDs.

Run: `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts`

Expected: unknown-ID cases falsely finalize cleanup as `removed`.

**GREEN:** Track every Codex creation/successor attempt and whether it produced the
complete exact-ID set needed for cleanup. Delete every known ID, but return `failed`
whenever any attempted creation boundary lacks a provably complete exact cleanup ID.

**Refactor:** Keep cleanup state monotonic and receipt finalization redacted; never
guess an ID or directly unlink provider state.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/behavior-gate.ts tests/coding-session-handoff/behavior-gate.test.ts`; regenerate the generated runtime with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/cli.test.ts && pnpm run type-check && pnpm run build:check`

**Commit:** `fix(p03-t08): make partial Codex cleanup truthful`

---

### Task p03-t09: (review) Validate exact Codex cleanup IDs

**Dependencies:** p03-t08 and the third p03 review at `a20c138`.

**Files:**

- Modify: `src/transcript/coding-session-handoff/behavior-gate.ts`
- Modify: `tests/coding-session-handoff/behavior-gate.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Add direct cleanup and end-to-end gate cases for machine-observed Codex
parent/child IDs that are option-shaped, non-UUID, or control-bearing. Include a
cleanup runner that returns success and prove no invalid value reaches
`codex delete --force` or produces a `removed` receipt.

Run: `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts`

Expected: invalid non-empty IDs still count as exact cleanup IDs and can falsely report
successful removal.

**GREEN:** Validate every machine-observed Codex parent/child ID against the exact
Codex 0.151.0 UUID grammar before retaining, corroborating, or deleting it. Treat every
invalid value as missing; delete only retained valid exact IDs and keep cleanup
`failed` whenever an attempted creation boundary lacks one. Regenerate the development
bundle through `pnpm run build`.

**Refactor:** Keep the untrusted-ID boundary centralized and provider-specific. Do not
weaken Claude identity handling, guess IDs, invoke a shell, or directly unlink provider
state.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/behavior-gate.ts tests/coding-session-handoff/behavior-gate.test.ts`; regenerate the generated runtime with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/cli.test.ts && pnpm run type-check && pnpm run build:check`

**Commit:** `fix(p03-t09): validate exact Codex cleanup IDs`

---

### Task p03-t10: (gate) Recognize Codex 0.151.0 authentication safely

**Dependencies:** p03-t09 and the p04-t01 mutation-free plan-check blocker recorded on
2026-09-01.

**Files:**

- Modify: `src/transcript/coding-session-handoff/providers.ts`
- Modify: `tests/coding-session-handoff/providers.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Pin Codex 0.151.0 authentication probing to the supported
`codex login status` argv. Cover its exact authenticated stdout, logged-out and unknown
stdout, extra/contradictory text, stderr-only success-looking text, nonzero execution,
and the existing 10-second/64-KiB/shell-disabled bounds. Preserve Claude's JSON auth
probe and parser unchanged.

Run: `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts`

Expected: the exact Codex 0.151.0 authenticated text is rejected because the current
probe invokes the unsupported `--json` flag and parses JSON only.

**GREEN:** Use the exact Codex 0.151.0 `login status` command and recognize only its
known authenticated stdout after bounded normalization. Do not authenticate from
stderr, substring matches, unknown output, command failure, or provider-version drift.
Keep Claude's JSON path unchanged and regenerate the development bundle through
`pnpm run build`.

**Refactor:** Keep provider-specific auth parsing explicit and fail closed. Do not
request credentials, invoke login, relax version/help/context gates, or run a live
behavior gate from the implementer.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/providers.ts tests/coding-session-handoff/providers.test.ts`; regenerate the generated runtime with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/cli.test.ts && pnpm run type-check && pnpm run build:check`

**Commit:** `fix(p03-t10): recognize Codex authentication status`

---

### Task p03-t11: (gate) Recognize exact Codex stderr authentication

**Dependencies:** p03-t10, its targeted independent review, and the p04-t01 post-fix
mutation-free channel capture recorded on 2026-09-01.

**Files:**

- Modify: `src/transcript/coding-session-handoff/providers.ts`
- Modify: `tests/coding-session-handoff/providers.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Pin the observed Codex 0.151.0 result shape: exit code 0, empty stdout, and
stderr exactly `Logged in using ChatGPT` after bounded line-ending normalization.
Cover rejection of the PATH-alias warning plus authenticated text, any extra stderr,
nonempty stdout, contradictory or logged-out text, a nonzero exit, and version/help
drift. Preserve the existing 10-second/64-KiB/shell-disabled bounds and Claude's JSON
authentication behavior unchanged.

Run: `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts`

Expected: the exact stderr-only authenticated result remains rejected by the p03-t10
stdout-only parser.

**GREEN:** Recognize Codex authentication only when all four conditions hold: the
exact supported `login status` argv completed with exit 0, normalized stdout is empty,
normalized stderr equals the single known authenticated line, and the exact
version/help/context gates already passed. Reject substrings, warnings, mixed-channel
output, unknown text, and execution failure. Keep Claude's JSON path unchanged and
regenerate the development bundle through `pnpm run build`.

**Refactor:** Keep the provider-specific channel contract explicit and fail closed.
Do not request credentials, invoke login, relax version/help/context gates, accept
general stderr success, or run a live behavior gate from the implementer.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/providers.ts tests/coding-session-handoff/providers.test.ts`; regenerate the generated runtime with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/cli.test.ts && pnpm run type-check && pnpm run build:check`

**Commit:** `fix(p03-t11): recognize exact Codex stderr auth`

---

### Task p03-t12: (review) Enforce exact Codex authentication output

**Dependencies:** p03-t11 and Important finding I1 in
`reviews/archived/p03-t11-review-2026-09-01T224710Z.md`.

**Files:**

- Modify: `src/transcript/coding-session-handoff/providers.ts`
- Modify: `tests/coding-session-handoff/providers.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Prove the p03-t11 comparator incorrectly accepts near matches produced by
the shared capability normalizer: case changes, doubled/leading/trailing spaces, ANSI
wrapping, extra blank stderr lines, and whitespace-only stdout. Preserve the exact
observed LF and CRLF success shapes as positive fixtures.

Run: `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts`

Expected: the near-match cases authenticate incorrectly before the repair.

**GREEN:** Add a Codex-auth-specific comparator that normalizes only CRLF/CR to LF and
removes at most one terminal line ending from stderr. Require stdout to be exactly
empty and the remaining stderr to equal the case- and whitespace-sensitive
`Logged in using ChatGPT` phrase. Do not strip ANSI, trim, collapse, lowercase,
filter, or sort auth output. Keep Claude's JSON path and all probe bounds unchanged,
then regenerate the development bundle through `pnpm run build`.

**Refactor:** Keep the exact auth comparator private and provider-specific. Do not
change general capability normalization, request credentials, invoke login, or run a
live behavior gate from the implementer.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/providers.ts tests/coding-session-handoff/providers.test.ts`; regenerate the generated runtime with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/cli.test.ts && pnpm run type-check && pnpm run build:check`

**Commit:** `fix(p03-t12): enforce exact Codex auth output`

---

### Task p03-t13: (gate) Preserve a redacted live-gate failure stage

**Dependencies:** p03-t12 and its passing targeted review, plus the two authorized
p04-t01 receipts that both collapsed the persistent parent failure to
`reporting-failed` before an exact native ID was observed.

**Files:**

- Modify: `src/transcript/coding-session-handoff/behavior-gate.ts`
- Modify: `src/transcript/coding-session-handoff/types.ts`
- Modify: `tests/coding-session-handoff/behavior-gate.test.ts`
- Modify: `tests/coding-session-handoff/types.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Add receipt/parser and gate tests proving that a failed bounded provider call
retains one stable, low-cardinality failure stage for call exception, nonzero exit,
timeout/signal, output bound, unresolved native identity, or evidence validation. Prove
that the receipt and returned result never include raw stdout/stderr, thrown messages,
fixture paths beyond the existing receipt contract, credentials, or unvalidated IDs.

Run: `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/types.test.ts`

Expected: the new cases fail because the current catch path discards the provider or
evidence stage and emits only `reporting-failed`.

**GREEN:** Add the smallest typed failure-stage contract needed to classify the bounded
execution result and evidence boundary before the existing fail-closed cleanup and
receipt finalization. Preserve `reporting-failed`, existing status semantics, cleanup
ordering, exact-ID deletion safeguards, provider argv, authentication, retry policy,
and all live-gate bounds. Regenerate the development bundle through `pnpm run build`.

**Refactor:** Keep classification deterministic and redacted. Do not retain raw
provider output or exception text, alter provider cleanup, add a retry, create or delete
a provider session, or run the live gate from the implementer.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/behavior-gate.ts src/transcript/coding-session-handoff/types.ts tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/types.test.ts`; regenerate the generated runtime with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/types.test.ts tests/coding-session-handoff/cli.test.ts && pnpm run type-check && pnpm run build:check && git diff --check`

**Commit:** `fix(p03-t13): preserve gate failure stage`

---

### Task p03-t14: (review) Classify null-exit provider launch exceptions

**Dependencies:** p03-t13 and Medium finding M1 in
`reviews/archived/p03-t13-review-2026-09-02T133557Z.md`.

**Files:**

- Modify: `src/transcript/coding-session-handoff/behavior-gate.ts`
- Modify: `tests/coding-session-handoff/behavior-gate.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Add a bounded provider-result fixture with `exitCode: null`, no signal, and no
timeout. Prove the current default-adapter-compatible shape is mislabeled
`provider-nonzero-exit` instead of `provider-call-exception`, while raw error/output
data remains absent from the receipt and safe result.

Run: `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts`

Expected: the null-exit case reports the wrong stable failure stage before the repair.

**GREEN:** Classify only numeric nonzero exits as `provider-nonzero-exit`. After the
existing timeout/signal and output-bound checks, map a null exit with no stronger
signal to `provider-call-exception`. Preserve every other p03-t13 stage, receipt
status/reason, cleanup, retry, provider invocation, authentication, and bound.
Regenerate the development bundle through `pnpm run build`.

**Refactor:** Keep the change at the existing bounded result-classification seam. Do
not export the default adapter, retain subprocess error objects or text, add a retry,
or run a live provider operation.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/behavior-gate.ts tests/coding-session-handoff/behavior-gate.test.ts`; regenerate the generated runtime with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/types.test.ts tests/coding-session-handoff/cli.test.ts && pnpm run type-check && pnpm run build:check && git diff --check`

**Commit:** `fix(p03-t14): classify provider launch exceptions`

**Review disposition:** The user explicitly waived a p03-t14 re-review. After the fix
and root verification pass, advance the p03-t13 review event only to
`fixes_completed`; do not mark it `passed` without a new review artifact.

---

### Task p03-t15: (gate) Disambiguate native identity failures

**Dependencies:** p03-t14 and the bounded Luna xhigh diagnosis of the third p04-t01
`native-identity-unresolved` receipt.

**Files:**

- Modify: `src/transcript/coding-session-handoff/behavior-gate.ts`
- Modify: `src/transcript/coding-session-handoff/types.ts`
- Modify: `tests/coding-session-handoff/behavior-gate.test.ts`
- Modify: `tests/coding-session-handoff/types.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Add synthetic bounded-result fixtures proving the current
`native-identity-unresolved` stage cannot distinguish zero recognized Codex IDs,
an invalid ID, or multiple distinct valid IDs. Cover malformed-only stdout and a
stderr-only `thread.started` event as the zero-recognized case, and preserve acceptance
of duplicate occurrences of one valid UUID.

Run: `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/types.test.ts`

Expected: the new cases collapse to the same generic stage before the repair.

**GREEN:** Emit three stable redacted stages for missing, invalid, and multiple native
identities without persisting IDs, raw output, parser text, or counts. Continue to
accept the legacy `native-identity-unresolved` stage when parsing preserved receipts,
but do not emit it for new executions. Preserve all provider invocation, cleanup,
retry, authentication, receipt, and bound behavior. Regenerate the development bundle
through `pnpm run build`.

**Refactor:** Keep the split at the existing identity parser boundary. Do not inspect
provider state, add a provider call or retry, infer a cleanup target, or run a live
behavior gate from the implementer.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/behavior-gate.ts src/transcript/coding-session-handoff/types.ts tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/types.test.ts`; regenerate the generated runtime with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/types.test.ts tests/coding-session-handoff/cli.test.ts && pnpm run type-check && pnpm run build:check && git diff --check`

**Commit:** `fix(p03-t15): disambiguate native identity failures`

**Review disposition:** This task authorizes implementation and verification only.
No independent review or live p04-t01 retry is authorized by this task.

---

### Task p03-t16: (gate) Hash pinned native executables within bounded resources

**Dependencies:** p03-t15, its passing independent review, and the p04-t02
`execution-context-unreadable` blocker recorded on 2026-09-08.

**Files:**

- Modify: `src/transcript/coding-session-handoff/providers.ts`
- Modify: `tests/coding-session-handoff/providers.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Add provider-probe coverage for a native executable larger than 128 MiB but
within the supported bound, plus an oversized executable beyond the new bound, read or
stream failure, and deterministic digest behavior. Prove the current whole-file
128-MiB guard rejects the pinned 197171680-byte Claude Code 2.1.251 executable as
`execution-context-unreadable`.

Run: `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts`

Expected: the within-bound native executable cannot produce an execution-context
fingerprint before the repair.

**GREEN:** Replace whole-file executable loading with incremental SHA-256 hashing under
an explicit byte bound that admits the pinned Claude binary. Keep memory use bounded,
reject files beyond the limit before or during hashing, preserve the exact
execution-context fingerprint projection, and fail closed on metadata, stream, or
digest errors. Regenerate the development bundle through `pnpm run build`.

**Refactor:** Keep the streaming/hash boundary injectable and provider-neutral. Do not
alter version, help, authentication, safety argv, confirmation, provider invocation,
cleanup, retry, or receipt behavior, and do not run a live provider operation from the
implementer.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/providers.ts tests/coding-session-handoff/providers.test.ts`; regenerate the generated runtime with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts tests/coding-session-handoff/behavior-gate.test.ts tests/coding-session-handoff/cli.test.ts && pnpm run type-check && pnpm run build:check && git diff --check`

**Commit:** `fix(p03-t16): hash native executables within bounds`

**Review disposition:** Run one fresh independent targeted p03-t16 review before
resuming p04-t02. The review must confirm bounded resource use and unchanged provider
mutation, cleanup, and privacy contracts.

---

### Task p03-t17: (gate) Corroborate the observed Claude successor identity

**Dependencies:** p03-t16 and the p04-t02 Run 23 `evidence-validation` result showing
the exact Claude Code 2.1.251 successor ignores the requested `--session-id`.

**Files:**

- Modify: `src/transcript/coding-session-handoff/behavior-contracts.ts`, `behavior-gate.ts`, `handoff.ts`, `types.ts`
- Modify: `tests/coding-session-handoff/behavior-gate.test.ts`, `handoff.test.ts`, `providers.test.ts`, `types.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**Change:** Remove the pre-generated child UUID from the Claude successor argv and
handoff plan. Accept the provider-returned child ID only when it occurs exactly once,
differs from the parent, and is corroborated by exact transcript, target cwd, and parent
lineage. The disposable gate additionally proves source resume leaves the child
unchanged; production reconciliation does not resume the source. Missing, ambiguous,
duplicate, invalid, or parent-equal IDs fail closed.

**Commit:** `fix(p03-t17): corroborate observed Claude successor` (landed `2c3a835`; task recorded retroactively)

**Review disposition:** One fresh independent targeted review before the next p04-t02
plan check. Design/spec and Claude execution/receipt-review instructions aligned on
2026-09-12 under the user's authorization to proceed with the stocktake recommendation.

---

### Task p03-t18: (gate) Canonicalize disposable gate fixture paths

**Dependencies:** p03-t17.

**Files:**

- Modify: `src/transcript/coding-session-handoff/behavior-gate.ts`
- Modify: `tests/coding-session-handoff/behavior-gate.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**Change:** `realpath` the `mkdtemp` fixture root so fixture paths, invocation cwd, and
provider-recorded cwd are identical strings on symlinked temp roots. Export
`createDefaultFixture` and assert canonical paths match a spawned child's cwd.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff && pnpm run type-check && pnpm run build:check && git diff --check`

**Commit:** `fix(p03-t18): canonicalize disposable gate fixture paths` (landed `42803fc`; task recorded retroactively)

**Review disposition:** Review together with p03-t17 before the next p04-t02 plan check.

---

### Task p03-t19: (review) Reject noncanonical UUID identity evidence

**Dependencies:** p03-t18.

**Files:**

- Modify: `src/transcript/coding-session-handoff/types.ts`
- Modify: `tests/coding-session-handoff/types.test.ts`
- Modify: `tests/coding-session-handoff/handoff.test.ts`
- Modify: `tests/coding-session-handoff/behavior-gate.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**Step 1: Understand:** I1 in `reviews/archived/p03-t17-t18-review-2026-09-12T212400Z.md`: case-insensitive UUID validation plus case-sensitive identity comparisons admits equivalent parent/child identities. The existing same-parent fixture is not a valid UUID.

**Step 2: Implement:** Require canonical lowercase UUID evidence at the existing shared validation boundary, without rewriting provider IDs or introducing another identity abstraction. Replace the invalid equality fixture with a valid UUID. Add mixed-case production, disposable-gate, and receipt/schema regressions proving fail-closed behavior and no false mapping/passing receipt. Preserve valid lowercase distinct-successor coverage, current version policy, and inherited deferrals. No live provider calls.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/types.ts tests/coding-session-handoff/types.test.ts tests/coding-session-handoff/handoff.test.ts tests/coding-session-handoff/behavior-gate.test.ts`; do not format generated output. This also resolves m1's existing callback-layout issue in the same test file; both findings are grouped into this single bounded task.

**Verify:** Demonstrate new behavioral regressions fail before the fix, then run `pnpm exec vitest run tests/coding-session-handoff && pnpm run type-check && pnpm run build && pnpm run build:check && git diff --check` and changed-authored-file lint/format checks.

**Commit:** `fix(p03-t19): require canonical UUID identity evidence` (`12cf6edffb12e2e201d1586aa7a049bbd666e633`)

## Root-owned entry gates between p03 and p05

These four gates are mandatory lifecycle boundaries, not implementation tasks. Their
stable IDs remain reserved for traceability and are never reused or renumbered. They
produce no root-repository code commit. Root-owned project bookkeeping remains separate
from phase task commits.

Root-authorized execution proves real Codex and Claude successors in fresh disposable
worktrees. Raw receipts remain untracked and mode 0600. Before either gate, the root
creates `.oat/projects/local/coding-session-handoff-gate-evidence/` mode 0700 and a
mode-0600 local-only receipt locator there. The directory is already ignored by the
repository. The locator stores only provider, exact receipt path, SHA-256 digest, and
lifecycle status; it contains no provider IDs, fixture paths, transcript content, or
credentials. It survives a Claude-auth pause/restart, is never consulted by the shipped
runtime, and is never committed to the root branch or synced project ref.

**Root-inline authority:** Provider-session creation/deletion and irreversible quota use
are executed by the root orchestrator. The p03 implementer may verify harness code but
must not run a gate, authenticate, or clean provider state on the root's behalf. Root
must not dispatch the p05 implementation tasks beginning with p05-t03 until all four
entry-gate dispositions pass.

### Entry gate p04-t01: Run the Codex 0.151.0 successor gate

**Gate dependency:** p03 complete, committed, and independently phase-reviewed with an
unverified Codex contract.

**Files:**

- Modify: project `implementation.md` with redacted receipt digest/status only
- Create local-only: fresh mode-0600 Codex receipt at the exact root-selected path
- Create/update local-only: mode-0600 receipt locator with exact path and digest

**Plan check:** Run `behavior-plan --provider codex --json`; verify exact version,
hook-disable/context fingerprint, three bounded calls, cleanup argv, and confirmation
digest without mutation.

**Execute:** Root runs the development bundle's digest-confirmed `behavior-verify` once
with the unused stable local receipt path. It must prove exact
parent/child IDs, target cwd, `forked_from_id`, source resumability, cleanup of exact
session IDs, and final receipt hash. No bypass or real project session is allowed.

**Verify:** Independent read-only checks confirm receipt mode 0600, `status: passed`,
all evidence booleans, cleanup `removed`, exact version/fingerprints, and absence of
credentials/raw output. Root atomically records the exact path/digest in the local
locator and passes that locator path directly to p05-t01; reviewers never scan for a
receipt. If failed/inconclusive, record a product blocker; do not retry the native
parent operation automatically.

**Bookkeeping:** Root records only the redacted digest/status in project artifacts and
commits that lifecycle bookkeeping separately; no phase task or root-repository code
commit is created.

---

### Entry gate p04-t02: Run the Claude Code 2.1.251 successor gate

**Gate dependency:** p03 complete, committed, and independently phase-reviewed with an
unverified Claude contract; supported local Claude authentication is required only at
this gate.

**Files:**

- Modify: project `implementation.md` with redacted receipt digest/status only
- Create local-only: fresh mode-0600 Claude receipt at the exact root-selected path
- Update local-only: mode-0600 receipt locator with exact path and digest

**Preflight:** Run `claude auth status --json`. If unauthenticated, stop at this exact
task and ask the user to complete `claude auth login`; never request or record a token.
Keep the Codex receipt and locator intact across this pause.

**Plan check:** Run `behavior-plan --provider claude --json`; verify exact version,
safe-mode/plan/no-tools context fingerprint, three calls, $0.15-per-call cap,
project-scoped purge cleanup, and digest without mutation.

**Execute:** Root runs digest-confirmed `behavior-verify` once. It must prove the
single valid, parent-distinct child UUID in machine output/transcript, target cwd,
inherited parent UUID prefix, source-only resume leaving the child unchanged, both
fresh project purges, and final receipt hash. The successor does not request a child ID.

**Verify:** Apply the same mode/status/evidence/cleanup/privacy checks as p04-t01. Any
negative, unauthenticated, or unobservable result is a product blocker, not permission
to ship plan-only behavior. Root atomically updates the locator and passes its exact
path directly to p05-t02; no reviewer auto-discovers local evidence.

**Bookkeeping:** Root records only the redacted digest/status in project artifacts and
commits that lifecycle bookkeeping separately; no phase task or root-repository code
commit is created.

---

## Root-owned independent receipt review gates

These reviews are root-dispatched lifecycle gates, not phase tasks. Each reviewer is
distinct from the p03 implementer and root gate executor, remains read-only, validates
locator and receipt mode/digest before reading, and never scans local state. A `fail` or
`inconclusive` disposition blocks p05 without activation, plan-only fallback, or an
automatic provider retry.

### Entry gate p05-t01: Independently review the Codex receipt

**Gate dependency:** p04-t01 passed.

**Files:**

- Create: redacted project review artifact under `reviews/`
- Read only: exact Codex receipt path/digest passed directly by root from the local-only locator and relevant gate/contract source

**Review:** A reviewer distinct from the implementer and gate executor checks receipt
locator mode, receipt mode/digest, schema, exact version, syntax/context fingerprints,
confirmation, parent/child/
cwd/lineage/resumability evidence, bounds, cleanup, and credential/raw-output absence.

**Verify:** Review disposition is `pass`; `fail` or `inconclusive` blocks activation.
The reviewer must not edit behavior contracts, generated output, or the raw receipt.

**Bookkeeping:** Root receives and archives the redacted review artifact in the synced
project ref; no phase task or root-repository code commit is created.

---

### Entry gate p05-t02: Independently review the Claude receipt

**Gate dependency:** p04-t02 passed; peer to p05-t01.

**Files:**

- Create: redacted project review artifact under `reviews/`
- Read only: exact Claude receipt path/digest passed directly by root from the local-only locator and relevant gate/contract source

**Review:** A distinct reviewer checks all common evidence plus exactly one valid,
parent-distinct output UUID, output/transcript match, inherited UUID prefix,
source-only resume leaving the child unchanged, spend bounds, exact
project-purge cleanup, and credential absence. It validates locator/receipt mode and
digest before reading and never searches local state.

**Verify:** Review disposition is `pass`; `fail` or `inconclusive` blocks activation.
The reviewer must not edit source or receipts.

**Bookkeeping:** Root receives and archives the redacted review artifact in the synced
project ref; no phase task or root-repository code commit is created.

---

## Phase p05: Reviewed behavior activation

**Disposition (2026-09-12): Superseded for guidance; retained unimplemented.**
Do not activate experimental execution as part of p-rev1.

**Goal:** Activate only independently reviewed exact contracts and prove
executable/native/reporting behavior without weakening drift rules.

### Task p05-t03: Activate both reviewed exact-version contracts

**Dependencies:** all four entry gates p04-t01, p04-t02, p05-t01, and p05-t02 pass and
their redacted dispositions are validated by root.

**Files:**

- Modify: `src/transcript/coding-session-handoff/behavior-contracts.ts`
- Modify: `tests/coding-session-handoff/providers.test.ts`
- Modify (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`

**RED:** Add exact expected receipt digest, version, syntax/context fingerprints, review
date/status, and tests proving no raw ID/path/body enters source. Exact versions should
remain deferred before activation.

Run: `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts`

Expected: exact contracts are still unverified.

**GREEN:** Store only reviewed redacted bindings for both successors and regenerate the
pre-public development bundle through `pnpm run build`.

**Refactor:** Keep resume unverified and remove no drift/auth/context checks.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/behavior-contracts.ts tests/coding-session-handoff/providers.test.ts`; regenerate the generated tool runtime with `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/providers.test.ts && pnpm run build:check`

**Commit:** `feat(p05-t03): activate reviewed successor contracts`

---

### Task p05-t04: Verify exact executable and partial-outcome behavior

**Dependencies:** p05-t03.

**Files:**

- Modify: `tests/coding-session-handoff/handoff.test.ts`
- Modify: `tests/coding-session-handoff/reconcile.test.ts`
- Modify: `tests/coding-session-handoff/cli.test.ts`

**RED:** Add activated exact-version execution cases plus version/help/context drift,
missing auth, mixed batches, mapped and observed-unverified success, indeterminate
creation, failed-before-child proof, no-repeat retries, and exact reconcile.

Run: `pnpm exec vitest run tests/coding-session-handoff/handoff.test.ts tests/coding-session-handoff/reconcile.test.ts tests/coding-session-handoff/cli.test.ts`

Expected: activation integration gaps fail.

**GREEN:** Make only bounded orchestration/schema corrections required by the activated
contract tests.

**Refactor:** Preserve strict cross-discrimination and one-result-per-selected-parent.

**Format:** `pnpm exec oxfmt --write tests/coding-session-handoff/handoff.test.ts tests/coding-session-handoff/reconcile.test.ts tests/coding-session-handoff/cli.test.ts`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff && pnpm run type-check && pnpm run build:check`

**Commit:** `test(p05-t04): verify activated handoff behavior`

---

## Phase p06: Public skill, documentation, and repository completion

**Disposition (2026-09-12): Superseded by p-rev1 guidance packaging/closeout.**
Preserve these original IDs without running their automation-dependent steps.

**Goal:** Ship the public 1.0.0 workflow and document exact support/safety boundaries.
Repository-wide verification, independent final review, and the implementation exit
gate run first in root-owned lifecycle closeout after the phase's two code-producing
tasks and standard phase review. The root-owned documentation step runs afterward in
the stored completion-and-closeout sequence.

### Task p06-t01: Author the public 1.0.0 skill

**Dependencies:** p05 complete.

**Files:**

- Create: `skills/coding-session-handoff/SKILL.md`
- Create (generated): `skills/coding-session-handoff/scripts/coding-session-handoff.mjs`
- Delete (generated): `tools/coding-session-handoff/coding-session-handoff.mjs`
- Create: `tests/coding-session-handoff/install-contract.test.ts`
- Modify: `scripts/build-generated.mjs`
- Modify: `.oxfmtrc.json`
- Modify: `.oxlintrc.json`
- Modify: `tests/tooling/generated-output-sync.test.ts`
- Modify: `tests/repo/layout.test.ts`
- Modify: `tests/repo/skill-frontmatter.test.ts`
- Modify: `tests/release/versioning.test.ts`
- Modify: `README.md`

**RED:** Add frontmatter/version/public-discovery/invocation tests, explicit public
layout/release inventory, generated-output destination, and README expectations before
creating the directory.

Run: `pnpm exec vitest run tests/coding-session-handoff/install-contract.test.ts tests/repo/layout.test.ts tests/repo/skill-frontmatter.test.ts tests/release/versioning.test.ts tests/tooling/generated-output-sync.test.ts`

Expected: the public skill is absent.

**GREEN:** Author one provider-neutral skill with matching version `1.0.0` fields,
explicit discover/preview/select/plan/confirm/execute/reconcile flow, mapped versus
observed-unverified guidance, exact Codex/Claude support floor, and clear Cursor,
cross-host, Git-sync, registry, and same-ID limitations. In this same atomic task,
retarget the generated mapping from the development `tools/` output to the public skill
script, update static generated-output exclusions and explicit public/version
inventories, run `pnpm run build`, and delete the development output. The public skill
directory must never exist in a committed state without its `SKILL.md`, generated
runtime, and layout/version contracts.

**Refactor:** Keep the skill concise and route mechanics through the bundled script.

**Format:** `pnpm exec oxfmt --write skills/coding-session-handoff/SKILL.md tests/coding-session-handoff/install-contract.test.ts scripts/build-generated.mjs .oxfmtrc.json .oxlintrc.json tests/tooling/generated-output-sync.test.ts tests/repo/layout.test.ts tests/repo/skill-frontmatter.test.ts tests/release/versioning.test.ts README.md`; generate and delete runtime outputs through `pnpm run build`, never hand-format generated files.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/install-contract.test.ts tests/repo/layout.test.ts tests/repo/skill-frontmatter.test.ts tests/release/versioning.test.ts tests/tooling/generated-output-sync.test.ts && pnpm run build:check && pnpm run validate`

**Commit:** `feat(p06-t01): add coding session handoff skill`

---

### Reserved closeout documentation gate p06-t02: Document user and engineering contracts

This stable ID is retired from the implementation-task set and will never be reused or
renumbered. The standard `oat-project-implement` completion-and-closeout `document`
step invokes `oat-project-document` after implementation behavior is frozen; that
root-owned lifecycle skill owns its own documentation and project-state commits. This
gate runs only after p06-t04 has completed aggregate verification, final review, and the
implementation exit gate; it is not a prerequisite for p06-t04.

**Closeout workflow:** Follow `documentation/AGENTS.md` and carry this exact declared
scope and verification into the root-owned document-step brief.

**Files:**

- Create: `documentation/docs/user-guide/skills/coding-session-handoff.md`
- Modify: `documentation/docs/user-guide/skills/index.md`
- Modify: `documentation/docs/user-guide/skills/meta.json`
- Modify: `documentation/docs/user-guide/index.md`
- Modify: `documentation/docs/engineering/architecture/transcript-core.md`
- Modify (generated): `documentation/index.md`

**Draft:** Document commands, exact workflow, output state machine, disposable gate
provenance, preview privacy warning, cleanup limits, exact-version drift, auth flow, and
unsupported v1 surfaces. Add authored `## Contents` and `.md` links.

**Documentation formatting:** `pnpm --dir documentation exec oxfmt --write docs/user-guide/skills/coding-session-handoff.md docs/user-guide/skills/index.md docs/user-guide/skills/meta.json docs/user-guide/index.md docs/engineering/architecture/transcript-core.md`; regenerate `documentation/index.md` with `pnpm --dir documentation run build` and never hand-edit it.

**Verify:** `pnpm --dir documentation run docs:format:check && pnpm --dir documentation run build`

Expected: Fumadocs navigation and generated index build cleanly.

**Closeout commits:** Let `oat-project-document` create only its documented bounded
documentation commit(s) and separate synced-project bookkeeping commit; do not create a
phase task commit for this gate.

---

### Task p06-t03: Synchronize project-only provider views

**Dependencies:** p06-t01.

**Files:**

- Modify only as generated by `oat sync`: provider skill mirrors/symlinks

**Preview:** Snapshot the user-level canonical skill versions/targets read-only, then
run `oat sync --scope project --dry-run`. Confirm the preview is confined to repository
provider views and does not name any user-scope destination.

**GREEN:** Run exactly `oat sync --scope project` and accept only tool-generated
repository mirrors/symlinks. Do not run bare `oat sync` and do not use `--scope user` or
`--scope all`.

**Refactor:** Keep public and internal skill lists distinct; never stamp the public skill
internal and never hand-edit a provider mirror.

**Format:** Do not run a formatter; every changed file in this task is generated or
OAT-synced and excluded by root `AGENTS.md`.

**Verify:** Re-check the user-level versions/targets are byte/version-identical to the
pre-sync snapshot, inspect repository-only generated changes, then run
`pnpm run validate:internal-flags && pnpm run validate:skill-versions --base-ref origin/main && pnpm run validate`.

**Commit:** `chore(p06-t03): sync project handoff views`

---

### Reserved closeout gate p06-t04: Aggregate verification and final review

This stable ID is retired from the implementation-task set and will never be reused or
renumbered. It names the standard root-owned lifecycle closeout that runs after p06-t01
and p06-t03 have each produced exactly one verified commit and p06 has passed its
built-in root phase review. It completes aggregate verification, independent final
review, and the implementation exit gate before the stored p06-t02 document step may
run.

**Files:**

- Modify only files required by bounded review fixes in their owning module
- Create/archive project review artifacts through OAT bookkeeping

**Verify:** Run, in order:

1. `pnpm exec vitest run tests/coding-session-handoff`
2. `pnpm exec vitest run tests/transcript-core tests/session-observer tests/export-session-transcript`
3. `pnpm run type-check`
4. `pnpm run build:check`
5. `pnpm run validate`
6. `pnpm run test`
7. `pnpm run smoke`
8. `pnpm --dir documentation run build`
9. `git diff --check`

Then use the standard `oat-project-implement` completion-and-closeout route for the
independent final code review over the complete implementation range. Apply bounded
Critical/Important fixes through their owning phase recovery path and re-run affected
plus aggregate gates until clean within the configured review budget. Root commits only
the resulting lifecycle bookkeeping; no empty root-repository task commit is created.

---

## Reviews

| Scope | Type | Status | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| p01 | code | passed | 2026-08-31 | reviews/archived/p01-review-2026-08-31T044051Z.md | 3b60b06623e8ca533f7ae4298f751fddb8d95ebf | manual | - |
| p02 | code | fixes_completed | 2026-08-31 | reviews/archived/p02-review-2026-08-31T063722Z.md | e488dfbd2ee9769fd7cff95b1dd9cb10c4390cb6 | manual | - |
| p02 | code | fixes_completed | 2026-08-31 | reviews/archived/p02-review-2026-08-31T074327Z.md | ab975ff7ec18a21c5059aa8800091475cf4f4442 | manual | - |
| p02-t13 | code | passed | 2026-08-31 | reviews/archived/p02-t13-review-2026-08-31T145043Z.md | 63d27033ae049f925e475246a4da2724a03756ab | manual | - |
| p03 | code | fixes_completed | 2026-08-31 | reviews/archived/p03-review-2026-08-31T163214Z.md | ed28bec732892a5c12f99300dcd558cb09a26124 | manual | - |
| p03 | code | fixes_completed | 2026-08-31 | reviews/archived/p03-review-2026-08-31T223047Z.md | 304ec8618b8dd9377c06f226d19ffbf8473c85c4 | manual | - |
| p03 | code | fixes_completed | 2026-09-01 | reviews/archived/p03-review-2026-08-31T235826Z.md | a20c138b349e2afbfb4251b51edf1c338cca2783 | manual | - |
| p03-t09 | code | passed | 2026-09-01 | reviews/archived/p03-t09-review-2026-09-01T211658Z.md | 459abf31c1c160895d2498d545095f1d5276e77d | manual | - |
| p03-t10 | code | passed | 2026-09-01 | reviews/archived/p03-t10-review-2026-09-01T221652Z.md | 7693c044db7aaf5357d3cd6e7a6000dd02bfb464 | manual | - |
| p03-t11 | code | fixes_completed | 2026-09-01 | reviews/archived/p03-t11-review-2026-09-01T224710Z.md | 4162366f70760d65b9aef9dfa162eedb37391b54 | manual | - |
| p03-t12 | code | passed | 2026-09-01 | reviews/archived/p03-t12-review-2026-09-01T234310Z.md | 07d0165157ffd468c5603cab1b3c5674e3500aeb | manual | - |
| p03-t13 | code | fixes_completed | 2026-09-02 | reviews/archived/p03-t13-review-2026-09-02T133557Z.md | 0e5bc879a7f68c50d69b5207ce07efd631462fb5 | manual | - |
| p03-t16 | code | passed | 2026-09-08 | reviews/archived/p03-t16-review-2026-09-08T220043Z.md | d15fd662d1baf5ff26cc6ccd09925212a8f9ff46 | manual | - |
| p03 | code | fixes_completed | 2026-09-05 | reviews/p03-review-2026-09-05T202836Z.md | 9db197fe765e18c4c925a9792097c473437f2e84 | manual | - |
| p03 | code | passed | 2026-09-05 | reviews/p03-review-2026-09-05T204213Z.md | 238f0513e41b35ecc4293268f7bcbeb5c1308d2b | manual | - |
| p03-t17-t18 | code | passed | 2026-09-12 | reviews/archived/p03-t17-t18-review-2026-09-12T212400Z.md | 42803fc7076ca9019522a935818c0107e976ced7 | manual | - |
| p03-t19 | code | passed | 2026-09-12 | reviews/archived/p03-t19-review-2026-09-12T215700Z.md | 12cf6edffb12e2e201d1586aa7a049bbd666e633 | manual | - |
| p04 | code | pending | - | - | - | - | - |
| p05 | code | pending | - | - | - | - | - |
| p06 | code | pending | - | - | - | - | - |
| final | code | fixes_completed | 2026-09-13 | reviews/archived/final-review-2026-09-13T023957Z.md | 3fdfc2a17b0b94171871a5bf6460beac1a333bea | manual | - |
| final | code | passed | 2026-09-13 | reviews/archived/final-review-2026-09-13T031000Z.md | 20e86a100832b114a8aa3a20469b849de7ec7f45 | manual | - |
| spec | artifact | pending | - | - | - | - | - |
| design | artifact | passed | 2026-08-31 | reviews/archived/artifact-design-review-2026-08-31T023100Z.md | 0bf20952b972420fc99e8cdc850debc54fb7dd7a | auto | - |
| plan | artifact | passed | 2026-08-31 | reviews/archived/artifact-plan-review-2026-08-31T024000Z.md | 0fbec1aa4d93ae86c64c5a11897708c79bc3df2f | manual | - |
| plan | artifact | passed | 2026-08-31 | reviews/archived/artifact-plan-review-2026-08-31T034519Z.md | - | gate | claude-fable-skip-permissions |
| p-rev1 | code | fixes_completed | 2026-09-13 | reviews/p-rev1-review-2026-09-13T015500Z.md | 0df47b79d55493bd213c4680752e4df45e8cc848 | manual | - |
| p-rev1 | code | passed | 2026-09-13 | reviews/p-rev1-review-2026-09-13T022511Z.md | 3fdfc2a17b0b94171871a5bf6460beac1a333bea | manual | - |
| plan | artifact | received | 2026-09-13 | - | - | auto | oat-reviewer-gpt-5-6-sol-max |
| final | code | fixes_completed | 2026-09-13 | reviews/archived/final-review-2026-09-13T042209Z.md | 20e86a100832b114a8aa3a20469b849de7ec7f45 | gate | cursor-fable-5-1-high |
| final | code | passed | 2026-09-13 | reviews/archived/final-review-2026-09-13T044900Z.md | b7a8d35f06acb0a850795e54ad40ea729caac8e5 | auto | - |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

**Revision artifact review (2026-09-13 UTC):** Independent structured review of p-rev1
and its discovery/spec/design/state/decision alignment returned 0 Critical, 0 Important,
1 Medium, 0 Minor. No review file was created (structured in-memory mode). This new
event is `received`, not a zero-finding pass. M1: explicitly include and format/run
`tests/repo/layout.test.ts` and `tests/release/versioning.test.ts` in prev1-t04, instead
of relying on prev1-t05's full suite to verify its required inventory edits. Offered
to the user; not applied without direction. The full-suite requirement and existing
inventory-edit scope remain. See `revision-handoff.md` for the exact suggestion.
This nonblocking residual does not reopen or reset prior code review cycles.

The t17/t18 review was received in Run 28: I1 and m1 were fixed by t19, and the
independent t19 review passed with zero findings. Its explicit I1/m1 resolution
advances the original event to passed without replacing its historical reviewed head.
The user's one bounded fix/re-review authorization is consumed; it authorized no live
provider operation. Existing review-cap usage and inherited deferrals are preserved.

Reviewers receive bounded scope and do not edit source. Raw provider receipts never
enter this table or Git; redacted review artifacts may record their SHA-256 digests.
The preserved p04 code placeholder predates the refreshed implementation contract and
does not identify an executable phase. The stable p04-t01/p04-t02 and p05-t01/p05-t02
IDs are mandatory root-owned entry gates, while p06-t02 and p06-t04 are reserved
lifecycle closeout gates; none is counted as an implementation task or
root-repository task commit.

## Phase p-rev1: Destination-tab fork guidance

Source: inline user feedback (2026-09-12), accepted three-entry-point workflow.
Dependencies: reusable completed p01–p03 code only; no paused live/activation gates.
All tasks are sequential; one task commit plus scoped synced-project bookkeeping per
task. No implementation runs in this planning turn. See `revision-handoff.md` first.

### Task prev1-t01: (revision) Establish provider/surface instruction capabilities

**Files:**

- Create: `src/transcript/coding-session-handoff/guidance-capabilities.ts`
- Create: `tools/coding-session-handoff/guidance-capabilities.md`
- Create: `tests/coding-session-handoff/guidance-capabilities.test.ts`

**Step 1 — RED/GREEN:** Define guidance-only provider/surface capability data for
Codex, Claude, Cursor CLI, and Cursor IDE-origin sessions. Inspect official docs and
available provider source, recording URLs, retrieval date, syntax/version context,
fork-vs-resume semantics, interactive launch, cross-worktree caveats, and in-provider
switch support independently. Seed synthetic contract tests before the data model.
Unknown fork/switch syntax stays unverified/unsupported with no executable template.
Do not infer CLI launchability from IDE transcripts, probe provider executables,
install versions, or alter the old exact-version executor matrix. Documentation-backed
guidance is allowed with explicit lack of live proof; it is not production verification.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/guidance-capabilities.ts tools/coding-session-handoff/guidance-capabilities.md tests/coding-session-handoff/guidance-capabilities.test.ts`

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/guidance-capabilities.test.ts && pnpm run type-check`
Expected: every provider/surface has explicit evidence/limits; missing capabilities
fail closed. Escalate if requested behavior needs undocumented store mutation.

**Commit:** `feat(prev1-t01): define evidence-backed fork guidance capabilities`

### Task prev1-t02: (revision) Extend read-only discovery and current-session selection

**Dependencies:** prev1-t01.
**Files:**

- Create: `src/transcript/coding-session-handoff/guidance-discovery.ts`
- Modify: `src/transcript/coding-session-handoff/discovery.ts`, `preview.ts` (extract/reuse helpers without widening executor mutation types)
- Modify: `src/transcript/session-observer/lib/locate.ts`, `types.ts`
- Create: `tests/coding-session-handoff/guidance-discovery.test.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Modify: `skills/session-observer/SKILL.md` (bump existing version when canonical shipped content changes)
- Regenerate: affected outputs via `pnpm run build`; any additionally changed canonical skill directory receives its own matching version bump.

**Step 1 — RED/GREEN:** Reuse exact-source discovery/preview for all three providers.
Add Cursor bounded exact-all/persistence-forbid support instead of merely passing
ignored options. Preserve observer defaults and return incomplete on bounds/errors.
Test direct current identity corroboration, absent/ambiguous current identity selection,
explicit source from destination, old sessions, ID collisions, Cursor origin/surface
ambiguity, no cache writes, and sanitized previews. Selection uses exact parent
identity; no child-ID capture, current-writer proof, or legacy auth probe is needed.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/guidance-discovery.ts src/transcript/coding-session-handoff/discovery.ts src/transcript/coding-session-handoff/preview.ts src/transcript/session-observer/lib/locate.ts src/transcript/session-observer/lib/types.ts tests/coding-session-handoff/guidance-discovery.test.ts tests/session-observer/locate.test.ts skills/session-observer/SKILL.md`; `pnpm run build` (never format generated files).

**Verify:** `pnpm exec vitest run tests/coding-session-handoff tests/session-observer/locate.test.ts && pnpm run type-check && pnpm run build:check && pnpm run validate:skill-versions -- --base-ref origin/main`
Expected: bounded/non-mutating discovery for all providers and no observer/executor regressions.

**Commit:** `feat(prev1-t02): support three-provider read-only handoff discovery`

### Task prev1-t03: (revision) Prepare destination-only interactive fork instructions

**Dependencies:** prev1-t02.
**Files:**

- Create: `src/transcript/coding-session-handoff/guidance.ts`
- Modify: `src/transcript/coding-session-handoff/git-target.ts` (only reusable read-only seams if needed)
- Create: `tests/coding-session-handoff/guidance.test.ts`

**Step 1 — RED/GREEN:** Build typed, pure guidance output with separate terminal,
slash-command, and manual/UI instruction kinds. Validate existing same-repository
destination, preserve dirty-source refusal for preparation, and show destination dirty
state. Render correctly quoted commands with an explicit canonical-cwd guard so they
refuse execution from another worktree rather than silently launching there. Cover
spaces, quotes, shell metacharacters, path aliases, invalid IDs, and wrong cwd using
mock provider executables only. Interactive commands must not contain readiness
prompts or automation-only print/JSON/disabled-tool settings. Unknown syntax yields
an explanation, not guessed flags. For fresh destination sessions, supported native
switch steps must target the selected source's fork; otherwise exit then fork-and-open
in the same tab. Never resume the original as a silent fallback, merge histories, or
launch a nested TUI. Existing executor remains unchanged and unverified.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/guidance.ts src/transcript/coding-session-handoff/git-target.ts tests/coding-session-handoff/guidance.test.ts`

**Verify:** `pnpm exec vitest run tests/coding-session-handoff/guidance.test.ts && pnpm run type-check && pnpm run build:check`
Expected: correct destination-side instruction kinds and zero real provider calls.
If a shared executor dependency changed, run `pnpm run build` and include its generated output before parity verification.

**Commit:** `feat(prev1-t03): prepare safe destination-side fork instructions`

### Task prev1-t04: (revision) Package an experimental guidance-only skill

**Dependencies:** prev1-t03.
**Files:**

- Create: `src/transcript/coding-session-handoff/guidance-cli.ts`
- Create: `skills/coding-session-handoff/SKILL.md`, `references/provider-guidance.md`
- Create (generated): `skills/coding-session-handoff/scripts/coding-session-handoff.mjs`
- Create: `tests/coding-session-handoff/guidance-cli.test.ts`
- Modify: `scripts/build-generated.mjs`, `scripts/validate.mjs`, `.oxfmtrc.json`, `.oxlintrc.json`
- Modify: `tests/tooling/generated-output-sync.test.ts` and existing exact skill inventory assertions affected by the new on-disk skill.

**Step 1 — RED/GREEN:** Add a dedicated guidance CLI (discover, preview, prepare) and
skill routing for the three entry points. Test current session not guessed, explicit
source selection, no provider processes or provider/auth probes, no session mutation,
no persisted preview, and no execution/reconcile/gate commands exposed by public help,
exports, or bundle imports. Keep the old tool bundle separate. New skill starts at
matching top-level/metadata version 0.1.0; changes in later tasks increment both.
Label experimental/not released in SKILL, help, JSON status, and human output. Explain
that the user must act in the destination tab and that no fork has yet been created.
Use canonical TS and dependency-free generated output; no global installation/sync.
Inspect current inventory assertions mechanically and update only those naming the
new skill, preserving unrelated manifests and main-installed user skills.

**Format:** `pnpm exec oxfmt --write src/transcript/coding-session-handoff/guidance-cli.ts skills/coding-session-handoff/SKILL.md skills/coding-session-handoff/references/provider-guidance.md tests/coding-session-handoff/guidance-cli.test.ts scripts/build-generated.mjs scripts/validate.mjs .oxfmtrc.json .oxlintrc.json tests/tooling/generated-output-sync.test.ts`; `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/coding-session-handoff tests/tooling && pnpm run type-check && pnpm run build:check && pnpm run validate && pnpm run validate:skill-versions -- --base-ref origin/main`
Expected: standalone guidance bundle works with synthetic fixtures, generated mappings
and inventories agree, no old execution path is reachable through the public skill.

**Commit:** `feat(prev1-t04): package experimental destination-tab guidance skill`

### Task prev1-t05: (revision) Document status and verify the revised workflow

**Dependencies:** prev1-t04.
**Files:**

- Create: `tools/coding-session-handoff/README.md`
- Create: `documentation/docs/user-guide/skills/coding-session-handoff.md`
- Modify: `documentation/docs/user-guide/skills/index.md`, `meta.json`
- Modify: `documentation/docs/engineering/architecture/transcript-core.md`
- Modify: `README.md`, `RELEASING.md` (experimental status and release checks only)
- Modify: `tests/coding-session-handoff/guidance-cli.test.ts` (three-entry-point regression matrix)
- Regenerate: `documentation/index.md` using the documented docs build; never hand-edit.

**Step 1 — RED/GREEN:** Pin end-to-end fixture scenarios for each entry point and
provider/surface, including unsupported Cursor transitions and fresh-session exit/
relaunch fallback. Load `oat-project-document` and `documentation/AGENTS.md` for the
declared project-docs scope; retain its provenance/approval workflow, with any new
targets outside this explicit scope requiring user approval. Write practical
source-tab/destination-tab examples with synthetic
IDs and paths, no claims that preparing instructions created/opened a session. Mark
the retained executor experimental/incomplete/paused and its old gates unpassed; mark
the new guidance implemented only as evidence warrants and unreleased until release
checks/user approval. Explain fork vs resume and IDE visibility limits. Preserve
portable `session-handoff` separation. Do not import the old automation gate as a
guidance release prerequisite; require honest per-capability evidence instead.

**Format:** `pnpm exec oxfmt --write tools/coding-session-handoff/README.md README.md RELEASING.md tests/coding-session-handoff/guidance-cli.test.ts`; `pnpm --dir documentation exec oxfmt --write docs/user-guide/skills/coding-session-handoff.md docs/user-guide/skills/index.md docs/user-guide/skills/meta.json docs/engineering/architecture/transcript-core.md`; `pnpm --dir documentation run build`.

**Verify:** `pnpm run test && pnpm run type-check && pnpm run build:check && pnpm run validate && pnpm run smoke && pnpm run validate:skill-versions -- --base-ref origin/main && pnpm --dir documentation run docs:format:check && pnpm --dir documentation run build && git diff --check`
Expected: complete synthetic/shared regression suite and docs/build consistency; no
live provider invocation. Human/ADE checks remain explicitly unverified unless the
user separately approves bounded checks. Do not claim a release or publish anything.

**Commit:** `docs(prev1-t05): document experimental guidance and paused automation`

### Task prev1-t06: (review) Require exact Cursor source-worktree association

**Dependencies:** prev1-t05, p-rev1 phase re-review at `3fdfc2a1`, and final review
`reviews/archived/final-review-2026-09-13T023957Z.md`.

**Files:**

- Modify: `src/transcript/session-observer/lib/locate.ts`, `types.ts` as required to
  preserve Cursor cwd-evidence quality instead of promoting the requested cwd to
  independently recorded evidence.
- Modify: `src/transcript/coding-session-handoff/guidance-discovery.ts` and the public
  CLI/preview seam only as required to prevent selection or preview without exact
  source-worktree corroboration.
- Modify: focused Cursor locator and guidance discovery/CLI tests.
- Regenerate affected outputs via `pnpm run build`; bump every changed canonical
  shipped skill version in both top-level and `metadata.version` fields.

**Step 1 — RED/GREEN:** Reproduce two distinct canonical worktrees whose paths encode
to the same Cursor project slug. Prove the existing guidance path can attribute and
preview the wrong transcript, then carry explicit cwd-evidence quality through the
shared locator. Public Cursor discovery must require independent exact cwd
corroboration; without it, return path-free `discovery-incomplete` or a distinct
source-association-ambiguous result that cannot be selected or previewed. Do not infer
exact cwd from the requested source, recent timestamps, IDE/CLI origin, or a unique
transcript under the lossy slug. Preserve zero persistence, bounded enumeration, the
prev1 review fix's fail-on-incomplete behavior, and the paused executor boundary.

**Format:** Use file-scoped `pnpm exec oxfmt --write` for changed authored TypeScript,
tests, and skill Markdown; never format generated output. Run `pnpm run build`.

**Verify:** `pnpm exec vitest run tests/session-observer/locate.test.ts tests/coding-session-handoff/guidance-discovery.test.ts tests/coding-session-handoff/guidance-cli.test.ts && pnpm run type-check && pnpm run build:check && pnpm run validate && pnpm run validate:skill-versions --base-ref 0042b84937076f875380892b87a39120eeefad9e && git diff --check`

Expected: colliding Cursor slugs cannot cross the requested canonical source boundary
or expose preview content; Codex/Claude and fail-closed exact-all behavior remain green.

**Commit:** `fix(prev1-t06): require exact Cursor source association`

### Task prev1-t07: (review) Preserve attributable candidates when unrelated transcripts are unreadable

**Dependencies:** prev1-t06 and gate review
`reviews/archived/final-review-2026-09-13T042209Z.md`.

**Files:**

- Modify: `src/transcript/session-observer/lib/locate.ts` and shared types only
  through a guidance-specific, opt-in read policy; preserve existing fail-closed
  defaults for the paused executor and other consumers.
- Modify: `src/transcript/coding-session-handoff/guidance-discovery.ts` and
  `guidance-cli.ts`, plus focused locator and guidance tests.
- Modify: the p-rev1 revision sections in `design.md` and `spec.md` to record the
  guidance-only granularity.
- Regenerate affected outputs with `pnpm run build`; bump every changed canonical
  shipped skill version.

**Step 1 — RED/GREEN:** Add realistic fixture stores where an unrelated Claude
transcript lacks cwd metadata and an unrelated Codex transcript contains an oversized
record. The guidance product must retain fully attributed source candidates while
returning a path-free summary of unattributable inputs grouped by provider and stable
reason code. It must never select by recency or expose transcript paths/content. Keep
the paused executor's strict exact-all semantics unchanged and keep zero persistence.

**Format:** File-scoped `pnpm exec oxfmt --write` for changed authored TypeScript,
tests, and skill Markdown; never format generated output. Run `pnpm run build`.

**Verify:** Focused locator and guidance discovery/CLI tests; type-check; generated
parity; repository and skill-version validation; diff hygiene.

Expected: unrelated unreadable records cannot make attributable Codex or Claude
guidance candidates unavailable; diagnostics remain bounded, stable, and path-free.

**Commit:** `fix(prev1-t07): isolate unrelated transcript discovery failures`

### Task prev1-t08: (review) State the current Cursor discovery limitation

**Dependencies:** prev1-t07.

**Files:**

- Modify: `skills/coding-session-handoff/SKILL.md` and
  `skills/coding-session-handoff/references/provider-guidance.md`.
- Modify: `documentation/docs/user-guide/skills/coding-session-handoff.md`.
- Modify: focused guidance or docs contract tests; bump the changed skill version.

**Step 1 — RED/GREEN:** State plainly that current Cursor transcript discovery has no
independent exact cwd evidence and therefore reports incomplete rather than returning
selectable candidates. Remove or qualify prose that describes an ambiguous Cursor
candidate as reachable. Preserve Cursor capability records as future-facing evidence
without claiming current availability.

**Format:** File-scoped `pnpm exec oxfmt --write` for changed Markdown/tests; run
`pnpm run build` if generated skill content changes.

**Verify:** Focused guidance tests, generated parity, repository and skill-version
validation, docs format check/build, and diff hygiene.

Expected: every public surface reports the same honest per-provider discovery status.

**Commit:** `docs(prev1-t08): clarify Cursor discovery availability`

### Task prev1-t09: (review) Refuse wrong-cwd launches without closing the shell

**Dependencies:** prev1-t08.

**Files:**

- Modify: `src/transcript/coding-session-handoff/guidance.ts`.
- Modify: `tests/coding-session-handoff/guidance.test.ts`.
- Regenerate affected output with `pnpm run build`; bump the changed shipped skill
  version.

**Step 1 — RED/GREEN:** Render an interactive conditional that executes the provider
only when `pwd -P` matches the canonical destination and otherwise prints the refusal
message without top-level `exit`. Prove a wrong cwd never invokes the mock provider
and leaves the calling shell able to continue; preserve `exec` on the matching branch
and shell-safe quoting.

**Format:** File-scoped `pnpm exec oxfmt --write` for authored source/tests; never
format generated output. Run `pnpm run build`.

**Verify:** Focused guidance tests, type-check, generated parity, skill-version
validation, and diff hygiene.

Expected: cwd mismatch refuses the launch and preserves the interactive destination
shell.

**Commit:** `fix(prev1-t09): preserve shell on cwd mismatch`

### Task prev1-t10: (review) Report entry-level preview truncation

**Dependencies:** prev1-t09.

**Files:**

- Modify: `src/transcript/coding-session-handoff/guidance-cli.ts`.
- Modify: `tests/coding-session-handoff/guidance-cli.test.ts`.
- Regenerate affected output with `pnpm run build`; bump the changed shipped skill
  version.

**Step 1 — RED/GREEN:** Track whether the preview budget trims any retained entry text
and include that condition in the public `truncated` flag. Cover both entry-count
truncation and mid-entry text truncation.

**Format:** File-scoped `pnpm exec oxfmt --write` for authored source/tests; never
format generated output. Run `pnpm run build`.

**Verify:** Focused guidance CLI tests, type-check, generated parity, skill-version
validation, and diff hygiene.

Expected: every lossy preview reports `truncated: true`.

**Commit:** `fix(prev1-t10): report trimmed preview entries`

### Task prev1-t11: (review) Use the installed skill-directory runtime path

**Dependencies:** prev1-t10.

**Files:**

- Modify: `skills/coding-session-handoff/SKILL.md` and focused skill contract tests.
- Bump the changed skill version.

**Step 1 — RED/GREEN:** Replace repository-relative runtime examples and allowed-tool
entries with the sibling `<skill-dir>/scripts/coding-session-handoff.mjs` convention
so an installed user-level copy resolves its own runtime. Add a test that rejects
repository-relative examples.

**Format:** File-scoped `pnpm exec oxfmt --write` for changed skill Markdown/tests.

**Verify:** Focused skill/guidance tests, repository validation, skill-version
validation, and diff hygiene.

Expected: documented commands resolve from an installed canonical skill directory.

**Commit:** `fix(prev1-t11): resolve installed guidance runtime`

### Revision closeout (root-owned, not an implementation task)

Receive independent p-rev1 code review; preserve all historical review events/caps.
Run final configured lifecycle review under current authorization (ask before any
external live provider route), record actual verification and residual limitations,
and update summary/state. Confirm the applicable HiLL checkpoint before execution.
Do not dispatch paused p04/p05 gates or original p06 tasks. No automatic feature push,
PR update, merge, installation, or release. A finished revision returns to PR review;
it does not mark the experimental executor verified or its skipped work complete.

## References

- Current revision handoff: `revision-handoff.md`
- Design: `design.md` (revision section governs)
- Spec: `spec.md` (R1–R8 govern)
- Discovery: `discovery.md` (accepted revision governs)
- Historical clean design review: `reviews/archived/artifact-design-review-2026-08-31T023100Z.md`

## Implementation Complete

**Summary:**

- p01: 3 tasks — bounded mutation-free transcript substrate
- p02: 13 tasks — exact candidate/preview/Git evidence plus nine review repairs
- p03: 19 tasks — the existing 18 tasks plus canonical UUID evidence and fixture-test formatting review fixes
- p05: 2 tasks — superseded/unimplemented automation activation
- p06: 2 tasks — superseded/unimplemented original packaging
- p-rev1: 11 tasks — five destination-tab guidance tasks, one completed final-review fix, and five gate-review fixes

**Historical + active total: 50 tasks = 46 completed + 4 superseded/unimplemented.**
Four historical live/receipt gates are paused, and two original reserved closeout gates
are superseded by the revision closeout. No paused/superseded work is counted as passed.

The active guidance revision's eleven tasks are complete. The configured implementation
gate's one Important, two Medium, and two Minor findings were repaired in five ordered
commits; a fresh final review of the changed basis is pending. Unsupported provider
paths and unverified live behavior stay explicit. The old executor remains
paused and unverified regardless of the guidance result. Release/merge/push are
separate user-authorized boundaries, not consequences of completing these tasks.
