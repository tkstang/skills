---
oat_generated: true
oat_generated_at: 2026-06-17
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-evaluate
---

# Code Review: final

**Reviewed:** 2026-06-17
**Scope:** final (f548ebe383ee7af566fe27817043aba56f4d83bf..HEAD) — all implementation tasks p01-t01..p04-t03
**Files reviewed:** 38 changed files; focused on `src/consensus/`, `plugins/consensus/skills/evaluate/`, generated-output sync, and security-hardened paths
**Commits:** f548ebe..d7378a5

## Summary

`consensus-evaluate` ships as a thin, dependency-free TypeScript-first wrapper over the shared consensus loop, matching the discovery/design contract (prompt-profile seam, free-form markdown evaluation, `verdict-parallel` reused verbatim, generated-runtime substrate per DR-020/DR-021). This independent re-run verified the three prior final-review fixes (prompt-data escaping, provider-preflight docs accuracy, evaluate path-confinement coverage) are genuinely closed, confirmed refine is byte-for-byte behavior-identical, and ran the full gate suite green. No Critical, Important, or Medium findings; the deferred ledger is confirmed empty.

## Findings

### Critical

None

### Important

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md` (quick-mode requirement source), `plan.md`, `design.md` (optional context), `implementation.md`; verified directly against `src/consensus/core/consensus-loop.ts`, `src/consensus/evaluate/consensus-evaluate.ts`, generated `.mjs` runtimes, schemas, `SKILL.md`, READMEs, and test files.

### Requirements Coverage

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| Invokable with artifact + `--rubric`, produces evaluation doc with unified findings + per-peer reasoning + dissent in deliberation log | implemented | `runConsensusEvaluate` (`src/consensus/evaluate/consensus-evaluate.ts:986`); `renderEvaluationArtifact` embeds canonical `consensus-verdict` blocks (`:826`, `:934`). Covered by `tests/consensus-evaluate-output.test.ts`. |
| v3 defaults (`shared_input` / `parallel_revision` / `minimal`), all overridable | implemented | `parseEvaluateArgs` defaults (`:226-230`); override + rejection coverage in `tests/consensus-evaluate-wrapper.test.ts`. |
| `--cold-start independent_draft` rejected with clear message | implemented | `parseColdStart` throws `UNSUPPORTED_COLD_START` (`:195-210`); tested `tests/consensus-evaluate-wrapper.test.ts:84`. |
| Engine seam narrow + default-preserving (refine behavior-identical) | implemented | `resolvePromptProfile` uses `profile?.X ?? defaultBuilder` (`consensus-loop.ts:1835`); refine passes no profile; generated refine/evaluate loop runtimes are byte-identical (diff clean). |
| Plugin manifests, SKILL.md, READMEs updated; family shipped | implemented | All three provider manifests register evaluate; READMEs list shipped invocation (`README.md:131`, `plugins/consensus/README.md:105`); `pnpm run validate` passes. |
| Tests: defaults, output contract, impasse under minimal agency, engine seam, schema drift guard | implemented | `consensus-evaluate-{wrapper,output,prompt-profile,schema-parity}.test.ts`, `generated-consensus-evaluate-import.test.ts`, `generated-output-sync.test.mjs`. |
| Shipped runtime dependency-free, Node stdlib only | implemented | Source imports only `node:fs/promises`, `node:path`, `node:url` + internal loop; no runtime deps. |
| Generated `.mjs` matches `src/` (no hand-edit drift) | implemented | `pnpm run build:check` reports all 8 mappings "in sync"; escaping logic present verbatim in generated wrapper. |
| Input-size cap (p02 hardening) | implemented | `readInputFile` enforces `INPUT_SIZE_CAP_BYTES` via stat + byte-length recheck (`:315-330`); tested for both artifact and rubric. |
| Path confinement + symlink rejection (p04-t03) | implemented | `confineWrite` rejects outside-root, symlink targets, and symlink-parent escapes (`:535-581`); parameterized over refine + evaluate runtimes in `tests/path-safety.test.ts`. |
| Prompt-data escaping (p04-t01) | implemented | `encodePromptBlockData` neutralizes `<`/`>` for all embedded data (artifact, rubric, evaluation draft, own/peer revisions, synthesis drafts); delimiter-injection regression tested (`tests/consensus-evaluate-wrapper.test.ts:178`). |
| Provider-preflight docs accuracy (p04-t02) | implemented | `SKILL.md:20` correctly frames provider inventory as host/operator setup; wrapper has no `provider ls`/`PEER_UNAVAILABLE` (grep confirms absence in source). |

### Extra Work (not in declared requirements)

None. All changed code maps to plan tasks. The regeneration of `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` is a required consequence of the shared canonical-source change (documented as an accepted delta in `implementation.md`), not scope creep.

## Security Review Notes

- **Prompt injection / delimiter escape:** Sound. Legitimate block markers (`<ARTIFACT_UNDER_EVALUATION>`, `<RUBRIC>`, `<EVALUATION_DRAFT>`) are the only literal `<...>` the peer is told to honor; every embedded untrusted value has `<`/`>` escaped, so injected content cannot forge a closing delimiter. Tests assert raw delimiters are absent and the escaped form is present.
- **Input-size caps:** Enforced before evaluation via both `stat().size` and a post-read `Buffer.byteLength` recheck, closing the symlink/sparse-file bypass window.
- **Path confinement:** `confineWrite` resolves the nearest existing ancestor's realpath and rejects symlink targets and symlink-parent escapes; all three state files plus output go through it. Negative coverage now exercises the shipped evaluate runtime directly.

## Verification Commands

All run during this review against HEAD (d7378a5); all PASS.

```bash
pnpm run build:check   # all 8 generated mappings in sync
pnpm run type-check    # tsc --noEmit clean
pnpm test              # Node: 205 pass / 0 fail; Vitest: 363 pass / 0 fail
pnpm run validate      # validation passed
pnpm run smoke         # smoke passed
git diff --check f548ebe..HEAD   # no whitespace errors
diff plugins/consensus/skills/refine/scripts/consensus-loop.mjs \
     plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs  # identical
```

## Deferred Findings Ledger Disposition

Confirmed empty. Prior final reviews (final-review-2026-06-17, final-review-2026-06-18) recorded 0 deferred Medium and 0 deferred Minor. Independent re-verification found no carry-forward debt and no new Medium/Minor to defer.

## Recommended Next Step

No fix tasks required. The implementation is complete and all gates are green; proceed to PR handoff. (The `oat-project-review-receive` skill may be run to formally record this passing review, but there are no findings to convert.)
