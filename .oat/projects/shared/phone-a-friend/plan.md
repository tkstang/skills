---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-28
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

# Implementation Plan: phone-a-friend

> Execute this plan using `oat-project-implement` — sequential by default, parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Ship a new `phone-a-friend` consensus skill for one-shot advisory peer
consultation — the host asks a single other provider-backed peer for a structured
take, with no deliberation loop, and dispositions the take itself.

**Architecture:** Instruction-only skill under `plugins/consensus/skills/phone-a-friend/`
— a `SKILL.md` plus one shipped JSON contract (`schemas/advisory.schema.json`),
no `src/` TypeScript and no generated `.mjs`. All execution goes through the
existing `consensus run` command (single schema-validated provider turn, with the
host-guard recursion safety already built in).

**Tech Stack:** Node.js 22+ (stdlib only), JSON Schema draft-07, the generated
`consensus` provider CLI, Vitest (contract test), Fumadocs (docs site).

**Commit Convention:** `{type}({scope}): {description}` — e.g.,
`feat(p01-t01): add phone-a-friend advisory schema`.

## Planning Checklist

- [x] Confirmed HiLL checkpoints with user (quick mode — none configured)
- [x] Set `oat_plan_hill_phases` in frontmatter
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter

---

## Parallelism

This plan is **sequential** (`oat_plan_parallel_groups: []`).

- **Phase 1** creates the skill (`plugins/consensus/skills/phone-a-friend/`) and
  its contract test. Phases 2 and 3 both depend on the skill existing.
- **Phase 2** (registration: `scripts/bump-version.mjs`, the three plugin.json
  descriptions) and **Phase 3** (docs under `documentation/`) are file-disjoint
  from each other, so they *could* in principle run concurrently. They are kept
  sequential because **Phase 3's final verification** (`npm run validate`,
  `npm test`, `oat sync`) is the project's single clean-state gate and must
  observe Phase 2's registration to be meaningful. The phases are small; the
  parallel coordination/worktree overhead would exceed any wall-clock gain.

---

## Phase 1: Skill core (schema + SKILL.md + reference)

### Task p01-t01: Advisory schema + contract test

**Files:**

- Create: `plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json`
- Create: `tests/consensus/phone-a-friend/advisory-schema.test.ts`

**Step 1: Write test (RED)**

Create `tests/consensus/phone-a-friend/advisory-schema.test.ts`. Load the schema
file and exercise the **real** repo validator (`validateSchemaSubset` from
`src/consensus/provider-cli/schema-validate.ts`) plus structural assertions:

```typescript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateSchemaSubset } from '../../../src/consensus/provider-cli/schema-validate.js';

const schema = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        '../../../plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json',
        import.meta.url,
      ),
    ),
    'utf8',
  ),
);

const valid = {
  schema_version: 'v1',
  understood_question: 'Should we cache the registry lookup?',
  take: 'Caching is reasonable but invalidation is the risk.',
  recommendation: 'Cache with a short TTL and a manual bust.',
  risks: ['stale entries after a provider change'],
  follow_up_questions: ['How often does the registry change?'],
  confidence: 'medium',
  assumptions: ['the registry is read-mostly'],
};

describe('advisory.schema.json', () => {
  it('accepts a well-formed advisory payload', () => {
    expect(validateSchemaSubset(valid, schema).ok).toBe(true);
  });
  it('rejects a payload missing a required field', () => {
    const { confidence, ...missing } = valid;
    expect(validateSchemaSubset(missing, schema).ok).toBe(false);
  });
  it('rejects a payload with a wrong-typed field', () => {
    expect(validateSchemaSubset({ ...valid, risks: 'oops' }, schema).ok).toBe(false);
  });
  it('declares the full contract for provider-native enforcement', () => {
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual([
      'schema_version', 'understood_question', 'take',
      'recommendation', 'risks', 'follow_up_questions', 'confidence',
    ]);
    expect(schema.properties.confidence.enum).toEqual(['low', 'medium', 'high']);
  });
});
```

Run: `node scripts/run-vitest.mjs tests/consensus/phone-a-friend/advisory-schema.test.ts`
Expected: Test fails (RED) — schema file does not exist yet.

**Step 2: Implement (GREEN)**

Create `plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json`
exactly as approved in design (`schema_version` const, seven required fields,
optional `assumptions`, `confidence` enum `low|medium|high`,
`additionalProperties: false`, `$id: consensus-plugin/v1/advisory.schema.json`).

Run: `node scripts/run-vitest.mjs tests/consensus/phone-a-friend/advisory-schema.test.ts`
Expected: Test passes (GREEN).

**Step 3: Refactor**

Confirm the schema matches the `verdict-*.schema.json` style of refine/evaluate
(draft-07 `$schema`, `$id`, `additionalProperties: false`). No behavior change.

**Step 4: Verify**

Run: `node scripts/run-vitest.mjs tests/consensus/phone-a-friend/advisory-schema.test.ts`
Expected: All four cases pass.

Run: `pnpm run type-check`
Expected: No errors. This gates the new TypeScript test file — the `src/` import
must use a `.js` specifier (NodeNext resolution; a `.ts` specifier fails `tsc`,
which vitest alone would not catch).

**Step 5: Commit**

```bash
git add plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json tests/consensus/phone-a-friend/advisory-schema.test.ts
git commit -m "feat(p01-t01): add phone-a-friend advisory schema and contract test"
```

---

### Task p01-t02: Author SKILL.md

**Files:**

- Create: `plugins/consensus/skills/phone-a-friend/SKILL.md`

**Step 1: Author the skill instructions**

Write `SKILL.md` with frontmatter matching the consensus convention (validated by
`scripts/validate.mjs`):

- `name: phone-a-friend` (must equal the folder name)
- `description:` one-shot advisory peer consultation, host dispositions the take
- `version: '0.1.0'` and `metadata.version: '0.1.0'` (must match)
- `license: MIT`
- `compatibility: Agent Skills baseline; requires Node.js 22+ and the generated consensus CLI.`
- `allowed-tools: Bash(node:*), Bash(consensus:*), Read, Write`
- `argument-hint: ["<question or topic>"] [--peer <provider-id>]`
- `metadata.author: thomas.stang`

Body sections (host-facing instructions):

1. **When to use / When NOT to use** — use for a single advisory second opinion;
   do not use for converging an artifact (refine), judging against a rubric
   (evaluate), or a multi-peer panel (future consensus-panel).
2. **Prerequisites** — Node 22+, the `consensus` CLI (installed name `consensus`,
   or `node plugins/consensus/scripts/consensus.mjs` from a checkout);
   `consensus provider ls --json` / `consensus preflight --json`.
3. **Workflow** — infer the question → compact only relevant context into a
   prompt file → **ask the user** when the topic is ambiguous or would include
   sensitive/private material → select a peer (prefer a provider different from
   the host; honor an explicit `--peer`/named override) → invoke `consensus run`
   → read the advisory envelope → **disposition** (agree / disagree / apply /
   ignore / follow-up) and explain how it affected the next action.
4. **Invocation** — the exact `consensus run --provider <peer> --schema
   ./schemas/advisory.schema.json --prompt-file <prompt> --json` form, with
   optional `--model` / `--effort` and `--max-depth 1`.
5. **Peer selection** — prefer different provider; same-provider fallback only
   when no other is usable, relying on the host-guard recursion protection.
6. **Safety** — peer output is **advisory only**; the host never auto-applies it;
   self-spawn/recursion is guarded by `consensus run` (`HOST_RECURSION_BLOCKED`
   beyond `max_depth`).
7. **Output / disposition contract** — the advisory schema fields and how the
   host reports the disposition to the user.
8. **Examples** — at least one inferred-question example and one
   ambiguous/sensitive example that triggers the user-check gate.

**Step 2: Verify**

Run: `npm run validate`
Expected: No errors (required frontmatter fields present, `name` matches folder,
`version` == `metadata.version`, semver valid).

**Step 3: Commit**

```bash
git add plugins/consensus/skills/phone-a-friend/SKILL.md
git commit -m "feat(p01-t02): author phone-a-friend SKILL.md instructions"
```

---

### Task p01-t03: Operator reference + example

**Files:**

- Create: `plugins/consensus/skills/phone-a-friend/references/operator-qa.md`
- Create: `plugins/consensus/skills/phone-a-friend/references/examples/` (at least one example prompt/advisory pair)

**Step 1: Author the reference**

Mirror the refine/evaluate `references/operator-qa.md` style: a hands-on
walkthrough of a one-shot advisory call to a different provider, the expected
JSON advisory envelope, a sample disposition, and a note that live cross-provider
invocation is manual (depends on locally authenticated provider CLIs). Add at
least one example advisory prompt + expected advisory payload under
`references/examples/`.

**Step 2: Verify**

Run: `npm run validate`
Expected: No errors. Confirm relative links in `SKILL.md` to `references/` resolve.

**Step 3: Commit**

```bash
git add plugins/consensus/skills/phone-a-friend/references
git commit -m "docs(p01-t03): add phone-a-friend operator reference and example"
```

---

## Phase 2: Registration + version invariants

### Task p02-t01: Register skill in version tooling + plugin descriptions

**Files:**

- Modify: `scripts/bump-version.mjs` (add SKILL.md to `SKILL_FILES`)
- Modify: `plugins/consensus/.claude-plugin/plugin.json` (description prose)
- Modify: `plugins/consensus/.cursor-plugin/plugin.json` (description prose)
- Modify: `plugins/consensus/.codex-plugin/plugin.json` (description prose)

**Step 1: Add the new skill to the version-bump set**

Add `'plugins/consensus/skills/phone-a-friend/SKILL.md'` to the `SKILL_FILES`
array in `scripts/bump-version.mjs` so release version-bumping keeps the new
skill's `version`/`metadata.version` in sync.

**Step 2: Refresh plugin descriptions for accuracy**

Update the prose `description` in all three plugin manifests to include
`phone-a-friend` (e.g., "Consensus create, decide, plan, refine, evaluate, and
phone-a-friend skills…"). Skills are auto-discovered from `skills/` — no skill
array exists, so this is the only manifest accuracy change. Keep the three
provider manifests consistent with each other.

**Step 3: Verify**

Run: `npm run validate`
Expected: No errors (manifest + marketplace consistency, skill discovery).

Run: `pnpm run validate:skill-versions -- --base-ref main`
Expected: No errors — the new skill is added (no pre-existing version to regress);
no existing skill changed without a bump.

**Step 4: Commit**

```bash
git add scripts/bump-version.mjs plugins/consensus/.claude-plugin/plugin.json plugins/consensus/.cursor-plugin/plugin.json plugins/consensus/.codex-plugin/plugin.json
git commit -m "chore(p02-t01): register phone-a-friend in version tooling and plugin descriptions"
```

---

## Phase 3: Docs + sync + full verification

### Task p03-t01: Document phone-a-friend in the User Guide

**Files:**

- Create: `documentation/docs/user-guide/consensus/phone-a-friend.md`
- Modify: `documentation/docs/user-guide/consensus/index.md` (`## Contents` entry + additive sub-family note)
- Modify: `documentation/index.md` (autogenerated app-root index — rewritten by `oat docs generate-index`; never hand-edit)

> Note: `documentation/docs/index.md` (the authored top-level map) does **not**
> change when adding a leaf page under the existing consensus section, so it is
> not in this change set. The file the generator rewrites is the app-root
> `documentation/index.md` (carries the AUTOGENERATED banner).

**Step 1: Read the docs authoring contract**

Read `documentation/AGENTS.md` first (the `## Contents` navigation rules, the
`.md`-link convention, and the generated-index discipline).

**Step 2: Author the page**

Create `phone-a-friend.md` with `title` + `description` frontmatter. Cover: what
the advisory skill does (one-shot, non-converging), how the host infers/compacts/
asks/selects/dispositions, the `consensus run` invocation, the advisory schema
fields, peer selection (prefer different provider), and the advisory-only/safety
boundary. Place it **within** the existing consensus User Guide section — do not
add a new top-level section.

**Step 3: Wire navigation**

Add a `[Phone-a-friend](phone-a-friend.md)` entry to the `## Contents` list in
`user-guide/consensus/index.md`, and reconcile **every** place the skill set is
enumerated so the page stays internally consistent: the intro count line ("v0.1
ships five skills"), the inline skill bullet list, the Limitations sentence
("ships the create, decide, plan, refine, and evaluate skills"), and the
`## Contents` entry. Use a minimal additive framing (introduce phone-a-friend as
the first "advisory" / non-converging entry) without restructuring the section.

**Step 4: Regenerate the index**

Run the docs index generator per `documentation/AGENTS.md` (e.g.,
`cd documentation && oat docs generate-index --docs-dir docs --output index.md`;
confirm the exact command against AGENTS.md before running).
Expected: Generated index reflects the new page; no hand-edits to generated
navigation.

**Step 5: Verify**

Run: `npm run validate`
Expected: No errors (docs invariants).

**Step 6: Commit**

```bash
git add documentation/docs/user-guide/consensus/phone-a-friend.md documentation/docs/user-guide/consensus/index.md documentation/index.md
git commit -m "docs(p03-t01): document phone-a-friend in the consensus user guide"
```

---

### Task p03-t02: Sync provider views + full verification

**Files:**

- Modify: provider mirror outputs refreshed by `oat sync` (e.g., `.claude/`, `.cursor/`), and `.oat/sync/manifest.json` as applicable

**Step 1: Refresh provider views**

Run: `oat sync`
Expected: Provider mirrors/manifest regenerated consistently. Note: the consensus
*plugin* skills install via the marketplace/plugin path, not the `.claude/skills`
/`.cursor/skills` tooling-mirror surface, so `oat sync` may legitimately produce
no skill-specific mirror changes (often just a `.oat/sync/manifest.json` bump).
Triage any pre-existing/unrelated drift before committing — do not sweep it in.

**Step 2: Full verification suite**

Run: `pnpm run type-check`
Expected: No errors across the full TypeScript surface (including the new
contract test).

Run: `pnpm run build:check`
Expected: Clean — proves the instruction-only claim (no generated runtime added).

Run: `npm test`
Expected: Full Vitest suite passes (including the new advisory-schema contract test).

Run: `npm run validate`
Expected: Repository structure, manifest, and docs invariants pass.

Run: `npm run smoke`
Expected: Mocked end-to-end consensus wrapper flow passes.

**Step 3: Commit**

Review `git status` and stage only the intended sync outputs explicitly (avoid
`git add -A`, which would sweep unrelated drift):

```bash
git add <paths oat sync reported as changed>   # e.g. .oat/sync/manifest.json and any provider-view files
git commit -m "chore(p03-t02): sync provider views for phone-a-friend"
```

---

## Reviews

{Track reviews here after running the oat-project-review-provide and oat-project-review-receive skills.}

{Keep both code + artifact rows below. Add additional code rows (p03, p04, etc.) as needed, but do not delete `spec`/`design`.}

| Scope  | Type     | Status  | Date       | Artifact |
| ------ | -------- | ------- | ---------- | -------- |
| p01    | code     | pending | -          | -        |
| p02    | code     | pending | -          | -        |
| p03    | code     | pending | -          | -        |
| final  | code     | pending | -          | -        |
| plan   | artifact | received | 2026-06-28 | reviews/artifact-plan-review-2026-06-28.md |
| design | artifact | pending | -          | -        |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

**Meaning:**

- `received`: review artifact exists (not yet converted into fix tasks)
- `fixes_added`: fix tasks were added to the plan (work queued)
- `fixes_completed`: fix tasks implemented, awaiting re-review
- `passed`: re-review run and recorded as passing (no Critical/Important)

---

## Implementation Complete

**Summary:**

- Phase 1: 3 tasks — advisory schema + contract test, SKILL.md instructions, operator reference
- Phase 2: 1 task — version-tooling registration + plugin description accuracy
- Phase 3: 2 tasks — User Guide documentation, provider sync + full verification

**Total: 6 tasks**

Ready for code review and merge.

---

## References

- Design: `design.md`
- Spec: N/A (quick mode)
- Discovery: `discovery.md`
- Backlog item: `.oat/repo/pjm/backlog/items/BL-260620-add-phone-a-friend-advisory.md`
- Execution boundary: `src/consensus/provider-cli/` (`commands.ts` `run`, `structured-output.ts` `runProviderTurn`, `host-guard.ts`)
- Sibling conventions: `plugins/consensus/skills/evaluate/SKILL.md`, `plugins/consensus/skills/refine/schemas/`
- Docs authoring contract: `documentation/AGENTS.md`
