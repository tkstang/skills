---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-09-01
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ["p06"]
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: spec-driven
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: coding-session-handoff

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
pre-generated child UUID in machine output/transcript, target cwd, inherited parent UUID
prefix, source-only resume, both fresh project purges, and final receipt hash.

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

**Review:** A distinct reviewer checks all common evidence plus pre-generated UUID,
output/transcript match, inherited UUID prefix, source-only resume, spend bounds, exact
project-purge cleanup, and credential absence. It validates locator/receipt mode and
digest before reading and never searches local state.

**Verify:** Review disposition is `pass`; `fail` or `inconclusive` blocks activation.
The reviewer must not edit source or receipts.

**Bookkeeping:** Root receives and archives the redacted review artifact in the synced
project ref; no phase task or root-repository code commit is created.

---

## Phase p05: Reviewed behavior activation

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
| p04 | code | pending | - | - | - | - | - |
| p05 | code | pending | - | - | - | - | - |
| p06 | code | pending | - | - | - | - | - |
| final | code | pending | - | - | - | - | - |
| spec | artifact | pending | - | - | - | - | - |
| design | artifact | passed | 2026-08-31 | reviews/archived/artifact-design-review-2026-08-31T023100Z.md | 0bf20952b972420fc99e8cdc850debc54fb7dd7a | auto | - |
| plan | artifact | passed | 2026-08-31 | reviews/archived/artifact-plan-review-2026-08-31T024000Z.md | 0fbec1aa4d93ae86c64c5a11897708c79bc3df2f | manual | - |
| plan | artifact | passed | 2026-08-31 | reviews/archived/artifact-plan-review-2026-08-31T034519Z.md | - | gate | claude-fable-skip-permissions |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

Reviewers receive bounded scope and do not edit source. Raw provider receipts never
enter this table or Git; redacted review artifacts may record their SHA-256 digests.
The preserved p04 code placeholder predates the refreshed implementation contract and
does not identify an executable phase. The stable p04-t01/p04-t02 and p05-t01/p05-t02
IDs are mandatory root-owned entry gates, while p06-t02 and p06-t04 are reserved
lifecycle closeout gates; none is counted as an implementation task or
root-repository task commit.

## Implementation Complete

**Summary:**

- p01: 3 tasks — bounded mutation-free transcript substrate
- p02: 13 tasks — exact candidate/preview/Git evidence plus nine review repairs
- p03: 9 tasks — provider contracts, orchestration, gate harness, CLI, development runtime, and three final-review repairs
- p05: 2 tasks — reviewed behavior activation and exact outcome coverage
- p06: 2 tasks — atomic public skill/runtime/inventories and project-only sync

**Total: 29 implementation tasks, 4 mandatory entry gates, and 2 reserved closeout gates**

Implementation is complete only when all 29 tasks have exactly one verified commit,
both live gates and receipt reviews pass, exact contracts are activated, aggregate
verification and the root-owned documentation gate succeed, and final independent
review has no Critical or Important findings. Claude authentication remains a
gate-local external precondition for p04-t02; failure there is a product blocker.

## References

- Design: `design.md`
- Spec: `spec.md`
- Discovery: `discovery.md`
- Clean design review: `reviews/archived/artifact-design-review-2026-08-31T023100Z.md`
