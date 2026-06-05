---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-05
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: [] # phases to pause AFTER completing (empty = every phase)
oat_plan_parallel_groups: [] # groups of phases that run concurrently in worktrees; [] = fully sequential
oat_plan_source: quick # spec-driven | quick | imported
oat_import_reference: null # e.g., references/imported-plan.md
oat_import_source_path: null # original source path provided by user
oat_import_provider: null # codex | cursor | claude | null
oat_generated: false
---

# Implementation Plan: export-session-transcript

> Execute this plan using `oat-project-implement` — sequential by default, parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Ship an `export-session-transcript` skill that exports the **current** agent session to a sanitized Markdown transcript (branch-named, default `~/Downloads`) for Claude Code, Codex, and Cursor — by extracting a minimal canonical `transcript-core` shared via a synced, drift-guarded copy, and layering an export-owned content sanitizer over structural normalization.

**Architecture:** Canonical `shared/transcript-core/runtimes.mjs` is synced (committed copy + banner) into each consuming skill's `scripts/lib/`; a `--check` drift guard runs in `npm test`. `session-observer` is migrated to consume the synced copy with no behavior change. The export CLI selects the current session via an announced session-marker content match (newest-for-cwd fallback), then runs structural `normalizeEntries` → export-owned `sanitize.mjs` (hidden-payload detectors) → marker-strip → Markdown render.

**Tech Stack:** Node ≥22 (stdlib only, dependency-free), `node:test`, npm scripts (`sync:transcript-core`, `test`, `validate`, `smoke`).

**Commit Convention:** `{type}({scope}): {description}` — e.g., `feat(p01-t02): add transcript-core sync + drift guard`

## Planning Checklist

- [x] Confirmed HiLL checkpoints with user (quick mode: checkpoint after each phase)
- [x] Set `oat_plan_hill_phases` in frontmatter
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter

---

## Parallelism

**Declared groups:** none — `oat_plan_parallel_groups: []` (fully sequential).

**Reasoning:** The phases are strictly dependency-ordered with overlapping write sets:

- Phase 2 cannot start until Phase 1 exists — it consumes the canonical
  `shared/transcript-core/runtimes.mjs` and the `scripts/sync-transcript-core.mjs`
  created in Phase 1, and it edits that sync script's `CONSUMERS` list.
- Phase 3 documents and adds repo-layout invariants for artifacts produced in
  Phases 1–2, and runs the full suite as the final gate.
- `package.json` and `scripts/sync-transcript-core.mjs` are touched across phases.

No phase pair is file-disjoint, so parallel worktrees would only create merge
conflicts. The plan is sequential by analysis, not by default.

---

## Phase 1: Extract canonical transcript-core + migrate session-observer

### Task p01-t01: Establish canonical shared core and relocate runtimes tests

**Files:**

- Create: `shared/transcript-core/runtimes.mjs` (canonical; byte-content copied from `skills/session-observer/scripts/lib/runtimes.mjs`, no banner)
- Create: `shared/transcript-core/README.md` (ownership note: this is the single source of truth; edit here then run `npm run sync:transcript-core`; lists consumers)
- Create: `tests/transcript-core/runtimes.test.mjs` (relocated from `tests/session-observer/runtimes.test.mjs`, import path repointed to `../../shared/transcript-core/runtimes.mjs`)
- Delete: `tests/session-observer/runtimes.test.mjs`

**Step 1: Create canonical source**

Copy the current `skills/session-observer/scripts/lib/runtimes.mjs` verbatim to `shared/transcript-core/runtimes.mjs` (it is already a leaf module — Node stdlib imports only). Add `shared/transcript-core/README.md` documenting the canonical/sync contract.

**Step 2: Relocate the unit test (RED→GREEN)**

Move `tests/session-observer/runtimes.test.mjs` → `tests/transcript-core/runtimes.test.mjs` and repoint its import to the canonical path. The relocated suite is the authoritative runtimes test.

**Step 3: Verify**

Run: `node --test tests/transcript-core/runtimes.test.mjs`
Expected: all relocated runtimes unit tests pass against the canonical module.

**Step 4: Commit**

```bash
git add shared/transcript-core/ tests/transcript-core/runtimes.test.mjs
git rm tests/session-observer/runtimes.test.mjs
git commit -m "refactor(p01-t01): extract canonical transcript-core runtimes + relocate tests"
```

---

### Task p01-t02: Add sync script + drift guard; migrate session-observer to synced copy

**Files:**

- Create: `scripts/sync-transcript-core.mjs` (CONSUMERS array — initially `skills/session-observer/scripts/lib/runtimes.mjs`; write mode prepends a generated banner; `--check` mode diffs without writing and exits non-zero on drift; creates parent dirs)
- Modify: `package.json` (add `"sync:transcript-core": "node scripts/sync-transcript-core.mjs"`)
- Modify: `skills/session-observer/scripts/lib/runtimes.mjs` (becomes the generated synced copy: banner + canonical content)
- Create: `tests/transcript-core/sync.test.mjs` (asserts `--check` reports in-sync for every consumer)

**Step 1: Implement the sync script**

`sync-transcript-core.mjs` reads `shared/transcript-core/runtimes.mjs`, prepends the banner (`// GENERATED — do not edit. Source: shared/transcript-core/runtimes.mjs` / `// Run: npm run sync:transcript-core`), and writes each consumer path. `--check` recomputes expected content and compares byte-for-byte, exiting 1 on any mismatch.

**Step 2: Materialize the synced copy (migration)**

Run `npm run sync:transcript-core` to overwrite `skills/session-observer/scripts/lib/runtimes.mjs` with banner + canonical content. `locate.mjs`/`digest.mjs` keep importing `./runtimes.mjs` unchanged.

**Step 3: Add the drift-guard test (RED→GREEN)**

`tests/transcript-core/sync.test.mjs` invokes the `--check` path (or its compare function) and asserts every consumer is in sync.

**Step 4: Verify**

Run: `node scripts/sync-transcript-core.mjs --check && npm test`
Expected: `--check` exits 0; full suite green — the entire `session-observer` suite still passes consuming the synced copy (regression gate).

**Step 5: Commit**

```bash
git add scripts/sync-transcript-core.mjs package.json skills/session-observer/scripts/lib/runtimes.mjs tests/transcript-core/sync.test.mjs
git commit -m "feat(p01-t02): add transcript-core sync + drift guard; migrate session-observer"
```

---

## Phase 2: Build the export-session-transcript skill

### Task p02-t01: Scaffold skill + SKILL.md + sync runtimes into it

**Files:**

- Create: `skills/export-session-transcript/SKILL.md` (frontmatter: `name: export-session-transcript`, `description`, `license: MIT`, `compatibility` (Agent Skills baseline; Node 22+; no third-party deps), `argument-hint`, `metadata.author`, `metadata.version: "1.0.0"`, `allowed-tools: Bash, Read`; body: triggers, the marker-announce workflow, per-provider store locations, `--session`/`--all`/`--runtime`/`--out` modes, exit-code handling)
- Create: `skills/export-session-transcript/references/transcript-formats.md` (per-provider store locations + record shapes for export; condensed from the canonical knowledge)
- Modify: `scripts/sync-transcript-core.mjs` (add `skills/export-session-transcript/scripts/lib/runtimes.mjs` to CONSUMERS)
- Create (generated by sync): `skills/export-session-transcript/scripts/lib/runtimes.mjs`

**Step 1: Author SKILL.md and references**

Write SKILL.md satisfying `npm run validate` invariants (required fields present, `name` matches folder, semver `metadata.version`). Document that the agent must announce a random-hex session marker and pass `--runtime <self> --match <marker>`.

**Step 2: Add export as a sync consumer and materialize**

Add the export lib path to CONSUMERS; run `npm run sync:transcript-core` to create `skills/export-session-transcript/scripts/lib/runtimes.mjs`.

**Step 3: Verify**

Run: `npm run validate && node scripts/sync-transcript-core.mjs --check`
Expected: validate passes (skill frontmatter valid, name matches folder); `--check` exits 0 for both consumers.

**Step 4: Commit**

```bash
git add skills/export-session-transcript/SKILL.md skills/export-session-transcript/references/ skills/export-session-transcript/scripts/lib/runtimes.mjs scripts/sync-transcript-core.mjs
git commit -m "feat(p02-t01): scaffold export-session-transcript skill + sync runtimes"
```

---

### Task p02-t02: Implement the export-owned content sanitizer (TDD)

**Files:**

- Create: `skills/export-session-transcript/scripts/lib/sanitize.mjs` (`export function sanitizeEntries(entries, { runtime })` + `export const HIDDEN_PAYLOAD_MATCHERS`)
- Create: `tests/export-session-transcript/sanitize.test.mjs`
- Create: `tests/export-session-transcript/fixtures/` (per-runtime fixtures embedding hidden payloads as ordinary user/assistant text messages)

**Step 1: Write tests (RED)**

For Claude Code, Codex, and Cursor fixtures, assert each hidden-payload class recorded as a normal **text** message is dropped: environment-context wrappers (`<environment_context>`), AGENTS.md / SKILL.md / pasted skill-body payloads (`# AGENTS.md instructions`, skill frontmatter / `<command-message>`-style text), system/developer instruction records, subagent notifications (`<subagent_notification>`), and `<turn_aborted>`. Add **negative** tests: genuine messages that merely mention these tokens mid-text are NOT dropped. This explicitly covers the Codex/Cursor path where `normalizeEntries` would pass the text through.

Run: `node --test tests/export-session-transcript/sanitize.test.mjs`
Expected: fails (RED) — `sanitize.mjs` not yet implemented.

**Step 2: Implement (GREEN)**

Implement `sanitizeEntries` + a data-driven `HIDDEN_PAYLOAD_MATCHERS` table (content/role based, drop-on-leading-match, conservative). Operates on normalized entries, before marker-strip/render.

Run: `node --test tests/export-session-transcript/sanitize.test.mjs`
Expected: passes (GREEN).

**Step 3: Refactor**

Keep the matcher table declarative and commented; ensure runtime is only consulted for genuinely provider-specific cases.

**Step 4: Verify**

Run: `node --test tests/export-session-transcript/sanitize.test.mjs`
Expected: all sanitizer tests (positive drops + negative keeps, all three runtimes) pass.

**Step 5: Commit**

```bash
git add skills/export-session-transcript/scripts/lib/sanitize.mjs tests/export-session-transcript/sanitize.test.mjs tests/export-session-transcript/fixtures/
git commit -m "feat(p02-t02): add export content sanitizer with per-runtime fixtures"
```

---

### Task p02-t03: Implement the export CLI (TDD)

**Files:**

- Create: `skills/export-session-transcript/scripts/export-session-transcript.mjs` (CLI entry)
- Create: `tests/export-session-transcript/cli.test.mjs` (+ any additional fixtures)

**Step 1: Write tests (RED)**

Cover, with per-runtime fixtures:

- Session selection: `--match <marker>` hit → exact transcript; marker miss → newest-for-cwd + warning; `--session <id>` → that session; `--all` → one output per cwd session.
- Output-path resolution: default `~/Downloads/<branch>.md` (`/`→`-`); `--out`/positional dir → `<dir>/<branch>.md`; file path → verbatim; not-a-git-repo/detached → `<cwd-basename>-<UTCstamp>.md`; `--all` → `<branch>-<sessionId>.md` per session.
- End-to-end sanitization: output contains no tool calls/results, system/developer text, environment/AGENTS.md/skill payloads, subagent notifications, or the marker line.
- Exit codes: `0` ok, `1` hard error, `2` no candidates, `3` ambiguous (no `--match`/`--session`).

Run: `node --test tests/export-session-transcript/cli.test.mjs`
Expected: fails (RED).

**Step 2: Implement (GREEN)**

Arg parsing; runtime resolution (`--runtime` > env hint (`SESSION_OBSERVER_SELF`-style) > best-effort auto-detect); candidate enumeration via the synced `runtimes.mjs` primitives (`discoverPaths`, `encodeCwdVariants`, `extractMeta`, `readRecords`); selection per mode; pipeline `normalizeEntries` → `sanitizeEntries` → strip marker/empties → render Markdown (header: branch, exported UTC, source, runtime, sanitization note; `## User` / `## Assistant`); resolve output path and write; documented exit codes.

Run: `node --test tests/export-session-transcript/cli.test.mjs`
Expected: passes (GREEN).

**Step 3: Refactor**

Factor locate-current / output-path / render helpers for readability; keep the file dependency-free.

**Step 4: Verify**

Run: `node --test tests/export-session-transcript/cli.test.mjs`
Expected: all selection, output-path, sanitization, and exit-code tests pass.

**Step 5: Commit**

```bash
git add skills/export-session-transcript/scripts/export-session-transcript.mjs tests/export-session-transcript/cli.test.mjs
git commit -m "feat(p02-t03): implement export-session-transcript CLI"
```

---

## Phase 3: Docs, repo invariants, and full verification

### Task p03-t01: Document the skill + shared-core convention; add repo-layout invariants

**Files:**

- Modify: `README.md` (add an `export-session-transcript` skill section + a "Shared transcript-core" convention note describing canonical source, `npm run sync:transcript-core`, and the drift guard)
- Modify: `tests/repo-layout.test.mjs` (assert `shared/transcript-core` and `skills/export-session-transcript` directories exist)

**Step 1: Update documentation**

Document the new skill (purpose, triggers, modes, provider store locations) and the shared-core/sync/drift-guard convention so the canonical-vs-vendored relationship is discoverable.

**Step 2: Extend repo-layout invariants**

Add directory assertions for `shared/transcript-core` and `skills/export-session-transcript`.

**Step 3: Verify (full gate)**

Run: `npm test && npm run validate && npm run smoke`
Expected: entire suite green (including the drift guard and the new export tests), validate passes (all skill frontmatter + structure), smoke passes.

**Step 4: Commit**

```bash
git add README.md tests/repo-layout.test.mjs
git commit -m "docs(p03-t01): document export skill + shared-core sync; add repo-layout invariants"
```

---

## Reviews

| Scope  | Type     | Status   | Date       | Artifact                                               |
| ------ | -------- | -------- | ---------- | ------------------------------------------------------ |
| p01    | code     | pending  | -          | -                                                      |
| p02    | code     | pending  | -          | -                                                      |
| p03    | code     | pending  | -          | -                                                      |
| final  | code     | pending  | -          | -                                                      |
| spec   | artifact | pending  | -          | -                                                      |
| design | artifact | received | 2026-06-05 | reviews/archived/artifact-design-review-2026-06-05.md  |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

**Meaning:**

- `received`: review artifact exists (design review received; findings resolved directly in artifacts — see implementation/state notes)
- `fixes_added`: fix tasks were added to the plan (work queued)
- `fixes_completed`: fix tasks implemented, awaiting re-review
- `passed`: re-review run and recorded as passing (no Critical/Important)

---

## Implementation Complete

**Summary:**

- Phase 1: 2 tasks — extract canonical `transcript-core`, add sync + drift guard, migrate `session-observer`
- Phase 2: 3 tasks — scaffold export skill + SKILL.md, content sanitizer, export CLI
- Phase 3: 1 task — docs, shared-core convention, repo-layout invariants, full verification

**Total: 6 tasks**

Ready for code review and merge.

---

## References

- Design: `design.md` (lightweight design; reviewed + findings resolved)
- Spec: `spec.md` (N/A — quick mode)
- Discovery: `discovery.md`
- Review history: `reviews/archived/artifact-design-review-2026-06-05.md`
