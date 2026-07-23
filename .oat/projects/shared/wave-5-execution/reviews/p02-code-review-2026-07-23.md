# p02 Code Review — Split consensus-refine module

- Phase: p02 (wave-5-execution)
- Branch: `wave-5/p02` (8 commits `f28a1f9..211591f`)
- Base: `4ba92cff7ca455d631f41d09e8a93bc5e7bd40dc`
- Worktree: `/Users/tstang/Code/repo-improve-2/.worktrees/wave-5/p02`
- Contract: `.oat/repo/reference/external-plans/2026-07-18-split-consensus-refine-module.md`
- Reviewer mode: read-only, disposition-verification over one Codex round (single Low: 6 oxfmt-forced reflows, dispositioned WON'T-FIX)
- Date: 2026-07-23

## Verdict: APPROVE

Behavior-preserving mechanical split verified. All gates green in the worktree; the facade preserves every previously-exported symbol from its original import path; the module DAG is acyclic and `refine-types` is type-only; build wiring, ignore lists, SKILL bump, and guard tests are correct. The single dispositioned Low (6 oxfmt-forced reflows) is legitimate WON'T-FIX.

## 1. Purity bar (color-moved)

`git diff --color-moved=zebra --color-moved-ws=allow-indentation-change 4ba92cf..wave-5/p02 -- src/consensus/refine/` classified: 357 plain-added / 95 plain-deleted lines. After filtering wiring (named import/re-export members, `import`/`export`/`from` lines), only 16 genuine non-wiring added lines remain — all part of reflowed signatures/type-aliases plus one git move-detection seam (`return writePath;`, present verbatim in both base and `refine-shared.ts`).

Sampled 3+ clusters (refine-shared, refine-args, refine-render, refine-types) — extractions are pure verbatim moves. Spot-verified byte-identical bodies: `confineWrite` (base 2111-2140 vs refine-shared 170-199), `readJsonFile`, `atomicWriteFile` signature. No logic/signature/behavior edits found. Only in-scope changes: import wiring + export-prefix re-exports + the flagged reflows.

## 2. WON'T-FIX ruling — 6 oxfmt-forced reflows: UPHELD

Picked 2 of the reflowed declarations and confirmed token-identical whitespace-only reflows:

- `readJsonIfPresent<T>(filePath: string, fallback: T): Promise<T>` — base one-liner (2200) -> new wraps to one-param-per-line. Same tokens, only line breaks differ.
- `type LoopRunOptions = NonNullable<Parameters<typeof runConsensusLoop>[1]>;` — base one-liner (44) -> new wraps the `NonNullable<...>` across 3 lines. Same tokens.

Empirical justification confirmed: `pnpm exec oxfmt --check src/consensus/refine/refine-types.ts refine-shared.ts refine-args.ts` -> exit 0 ("All matched files use the correct format"). The mandatory `export ` prefix widens these declarations past oxfmt's print-width, so the verbatim single-line form would fail the formatter; the wrap is the format-required equivalent. Behavior-preserving. WON'T-FIX is correct.

## 3. Facade completeness

Base `consensus-refine.ts` had 24 runtime `export` declarations. All 24 still resolve from the original path `src/consensus/refine/consensus-refine.ts`:
- Re-exported via `export { ... } from './refine-*.js'`: INPUT_SIZE_CAP_BYTES, createJsonlEvent, renderHumanError, readInputFile, confineWrite, atomicWriteFile, resolveRunDir, resolveOutputPath, resolveResumePath (refine-shared); PROVIDER_ID_PATTERN, parseWrapperArgs, resolvePeers, resolveSynthesizer (refine-args); slugSectionId, parseSections (refine-sections); renderDeliberationArtifact (refine-render); parseDeliberationArtifactForResume (refine-resume); buildEscalationEvent (refine-escalation).
- Still defined in the facade: detectHost, runSequential, prepareParallelRun, fanInParallelRun, preflightConsensusProviderCli, runWrapperCli.

Verified: `npx vitest run tests/consensus/refine/wrapper-options.test.ts tests/consensus/provider-cli/missing-cli-message.test.ts` (unchanged imports) — passed (part of a 39-test green run incl. sync test).

## 4. Per-cluster green claim

Verified by construction. Commit bodies for `633507a4` (refine-args) and `3ae3cc91` (refine-render) both record "gate green" and document the DAG-driven ordering (args extracted before sections because `normalizeSequentialOptions` calls `parseWrapperArgs`). This matches the empirically-derived import graph. Leaf-first order + acyclic DAG + recorded per-cluster gates support the claim. Did not run a historical detached-checkout gate (optional per contract; HEAD gates all green and the DAG argument is sound).

## 5. Module DAG

Import graph among `refine-*.ts` (sibling imports):
- refine-types: none (leaf, type-only)
- refine-shared -> types
- refine-args -> shared, types
- refine-manifest -> shared, types
- refine-render -> shared, types
- refine-sections -> args, types
- refine-resume -> render, shared, types
- refine-escalation -> types

No cycles. `refine-types` is imported everywhere only via `import type` (grep for a non-type runtime import of refine-types returned zero hits) — confirmed type-only, no generatedOutputs entry needed.

## 6. Build wiring

- `scripts/build-generated.mjs`: exactly 7 new refine `generatedOutputs` entries (shared, manifest, args, sections, render, resume, escalation) — refine-types correctly omitted.
- `.oxfmtrc.json` + `.oxlintrc.json` ignore lists: 7 new `.mjs` entries each, inserted mid-array (before the pre-existing session-observer block, lines ~9-15/27-33), not end-appended.
- `tests/tooling/generated-output-sync.test.ts`: green (guards ignore-list == generatedOutputs).
- `plugins/consensus/skills/refine/SKILL.md`: 0.1.8 -> 0.1.9 in both top-level `version` and `metadata.version`.
- Guard tests `tests/consensus/generated-config-import.test.ts` and `generated-refine-import.test.ts`: both pass.

## 7. Full check (worktree)

- `pnpm run type-check` -> exit 0
- `pnpm run build:check` -> exit 0 (all outputs "in sync")
- `npx vitest run tests/consensus/refine/` -> 142 passed (19 files)
- `pnpm run smoke` -> exit 0
- `git status --short` -> clean

## Findings requiring action

None.
