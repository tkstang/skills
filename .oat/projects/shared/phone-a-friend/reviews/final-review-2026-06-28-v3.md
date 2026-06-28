---
oat_generated: true
oat_generated_at: 2026-06-28
oat_review_scope: final
oat_review_type: code
oat_project: .oat/projects/shared/phone-a-friend
---

# Code Review: final

**Reviewed:** 2026-06-28
**Scope:** final — full project surface for the `phone-a-friend` consensus skill (`98c6fd5..HEAD`)
**Files reviewed:** 16 product/test/docs files (of 40 changed; `.oat/` bookkeeping sanity-checked, not graded)
**Commits:** 31 commits in range (6 task commits + bookkeeping/review/PR commits)

## Summary

This is an independent final pass on the `phone-a-friend` instruction-only consensus skill. All six plan
tasks are delivered faithfully, the design's instruction-only contract is honored (no `src/` TypeScript,
no generated `.mjs`, execution leans entirely on the existing `consensus run` boundary), and the advisory
schema matches the approved shape exactly. All five required verification commands pass on the current HEAD
(type-check, build:check, full Vitest suite of 880 tests, validate, smoke). No Critical or Important findings;
three Minor items, all artifact/bookkeeping drift rather than product defects.

## Findings

### Critical

None.

### Important

None.

### Minor

- **Temporary OAT dogfood-feedback file present at HEAD, marked for deletion** (`.oat/projects/shared/phone-a-friend/references/oat-gate-feedback.md:8`)
  - Issue: The file header says "Temporary file — hand to the OAT agent, then delete." It was re-added by the
    HEAD commit `3c1f9d6` ("stash OAT gate dogfood feedback … (temporary)"). Separately, `implementation.md`
    (lines 461 and 469) records that the final-review fix "removed the temporary OAT gate feedback handoff file
    from the shipping range" — which is true for the *product* surface (repo root), but is now stale relative to
    HEAD, where the file lives under `.oat/.../references/`. This is project bookkeeping, not a shipped product
    file, so it does not affect the plugin, but a file explicitly slated for deletion is sitting in the tree.
  - Fix: Either delete `oat-gate-feedback.md` before merge (its stated intent) or, if it is being intentionally
    retained as a durable project reference, drop the "then delete"/"temporary" framing and reconcile
    `implementation.md` so the two records agree.

- **Plan documents an invalid `validate:skill-versions` command form** (`.oat/projects/shared/phone-a-friend/plan.md:311`)
  - Issue: The plan instructs `pnpm run validate:skill-versions -- --base-ref main`. I ran it: pnpm forwards the
    `--` as a literal argument and the script fails with `unexpected argument: --`. The working form is
    `pnpm run validate:skill-versions --base-ref main` (confirmed against `package.json:15` →
    `node scripts/validate-skill-versions.mjs`). The implementer already noted this in `implementation.md`
    (p02 Outstanding Items / follow-ups) and used the correct form, so the implementation is fine — only the
    plan text is stale.
  - Fix: Update the plan command (and any sibling docs that copy the `-- --base-ref` form) to drop the `--`.
    This is artifact alignment, not a code change.

- **Example advisory payload is not exercised by an automated test** (`plugins/consensus/skills/phone-a-friend/references/examples/registry-cache.advisory.json:1`)
  - Issue: The contract test (`tests/consensus/phone-a-friend/advisory-schema.test.ts`) validates an inline
    `valid` object, not the shipped example file. I manually confirmed the example conforms (7 required fields +
    optional `assumptions`, no extra props, `confidence: "medium"`), but nothing guards it from drifting out of
    sync with the schema later. The design only required the schema-contract test, so this is optional hardening.
  - Suggestion: Add one assertion that parses `references/examples/registry-cache.advisory.json` and runs it
    through `validateSchemaSubset(example, schema)` so the documented example cannot silently break.

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md`, `plan.md`, `design.md` (present for this quick project),
`implementation.md`, plus the changed product/test/docs files and the canonical execution boundary under
`src/consensus/provider-cli/`.

### Requirements Coverage

| Requirement (discovery success criteria / plan tasks) | Status | Notes |
| ----------------------------------------------------- | ------ | ----- |
| New shipped one-shot advisory skill over the provider CLI + structured schema | implemented | `SKILL.md` + `schemas/advisory.schema.json`; no new CLI surface, uses `consensus run`. |
| SKILL.md: infer question, compact context, ask user on ambiguity/sensitivity | implemented | Workflow steps 1–3 (`SKILL.md:53-55`); reinforced in "When NOT to Use" and Safety. |
| Peer selection prefers a different provider, honors explicit override | implemented | `SKILL.md:56` + Peer Selection section (`:83-91`). |
| Advisory response captures understood question, take, recommendation, risks, follow-up, confidence | implemented | Schema 7 required fields + optional `assumptions` (`advisory.schema.json:6-51`). |
| Disposition step (agree/disagree/apply/ignore/follow-up) with host explaining effect | implemented | `SKILL.md:59,114-122`. |
| Recursion/safety + advisory-only boundary specified | implemented | Safety section (`SKILL.md:94-99`); `--max-depth 1` + `HOST_RECURSION_BLOCKED` aligns with `host-guard`/`structured-output`. |
| Naming consistent across metadata/docs/examples/scripts/manifests | implemented | Folder, frontmatter, 3 plugin manifests, codex interface, README, docs, examples all say `phone-a-friend`. |
| Instruction-only: no `src/` TS, no generated `.mjs`, no loop copy | implemented | Diff adds no `src/`/`.mjs` files; `build:check` reports all generated targets "in sync". |
| Advisory schema matches approved shape (const v1, 7 required, optional assumptions, enum low/medium/high, additionalProperties:false, $id) | implemented | Exact match to `design.md:193-219`. |
| Codex interface block enumerates phone-a-friend (folded-in plan finding p02-t01) | implemented | `shortDescription`, `longDescription`, `defaultPrompt` all name it (`.codex-plugin/plugin.json:12-20`); 3 prose `description` fields identical across claude/cursor/codex. |
| SKILL_FILES registration + version fields in sync | implemented | `scripts/bump-version.mjs:24`; `version` == `metadata.version` == `0.1.0`; `validate` passes. |
| Contract test imports real validator with `.js` specifier (NodeNext), accept/reject + structural | implemented | `advisory-schema.test.ts:4` uses `schema-validate.js`; `type-check` passes (proves specifier). |
| Docs in Fumadocs site, index regenerated not hand-edited | implemented | New `phone-a-friend.md`; `index.md` nav updated; app-root `documentation/index.md` regenerated (alphabetical insertion, generator-consistent). |
| Plugin-facing README accurate to shipped skill set | implemented | README description/scope/permissions/limitations/layout all updated for the sixth skill. |
| `npm test`, `build:check`, `validate`, `smoke` pass; `oat sync` consistent | verified | All pass on HEAD (see Verification Commands); `oat sync` was a no-op per implementation log + clean `npm run validate`. |

### Extra Work (not in declared requirements)

- `tests/release/versioning.test.ts` and `tests/repo/plugin-manifests.test.ts` were updated beyond the literal
  p03-t02 file list. This is justified and documented: the full-verification gate exposed stale fixtures left by
  the p02 manifest/version-tooling changes. Recorded in `implementation.md` Run 3 Artifact/Design Deltas. Not scope creep.
- `plugins/consensus/README.md` was updated (folded in during final review). Required by the repo convention to
  keep plugin-facing docs accurate to source/manifests. Recorded in `implementation.md` Run 4 deltas. Not scope creep.

### Deferred-findings ledger (final-scope disposition)

No deferred-Medium findings are recorded. `implementation.md` "Deviations from Plan / Design" is empty (all `-`),
and every orchestration-run "Outstanding Items" reads "None" except the p02 Minor note about the stale
`validate:skill-versions -- --base-ref` command form — re-surfaced independently here as a Minor and the only
open carry-over. Nothing requires deferral; address the three Minors at convenience.

### Design fidelity (instruction-only boundary)

Confirmed independently from the diff: the change set adds no file under `src/` and no `.mjs` runtime for this
skill. `pnpm run build:check` reports every generated target "in sync", which proves no generated runtime was
introduced. Execution is delegated to the already-shipped `consensus run` path; the operator-qa "Expected JSON
envelope" (`operator-qa.md:69-91`) accurately reflects the real `successEnvelope` contract (`schema_version`,
`ok`, `provider`, advisory payload under `json`) in `src/consensus/provider-cli/envelope.ts:33-50`.

## Verification Commands

All run on HEAD during this review; results recorded inline.

```bash
pnpm run type-check    # PASS — tsc --noEmit, no errors (gates the .js specifier in the new test)
pnpm run build:check   # PASS — all generated targets report "in sync" (no generated runtime added)
npm test               # PASS — 92 files passed / 1 skipped; 880 tests passed / 1 skipped; 0 failed
npm run validate       # PASS — "validation passed"
npm run smoke          # PASS — "smoke passed"
```

Optional re-checks used during review:

```bash
# Confirms the plan's documented form is invalid; the form below (no `--`) is the working one:
pnpm run validate:skill-versions --base-ref main
# Confirms no skill-enumerating manifest field omits phone-a-friend:
grep -rn "phone-a-friend" plugins/consensus/.codex-plugin/plugin.json
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks. All three findings are Minor
(temporary-file cleanup, plan command-form alignment, optional example-file test hardening); none block merge.
