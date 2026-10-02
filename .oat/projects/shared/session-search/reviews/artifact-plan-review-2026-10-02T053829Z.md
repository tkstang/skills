---
oat_generated: true
oat_generated_at: 2026-10-02T05:38:29Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/session-search
oat_gate_headless: true
oat_gate_run_id: cd2b64af-97ab-437c-821a-d12b96d76e21
oat_gate_target: codex-6-sol-xhigh
oat_gate_runtime: codex
oat_invocation_model: gpt-6.1-sol
oat_invocation_reasoning_effort: xhigh
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-10-02T05:38:29Z
**Scope:** Current session-search plan and its quick-mode requirements/design alignment.
**Files reviewed:** 5 project artifacts, plus the source and repository contracts cited below.
**Baseline:** `5438e08bceb51fdf4c4a1f31aad9540d37052ecd`, branch `feat/session-search`; core artifacts were committed and clean before review.
**Workflow mode:** quick. Discovery, design, plan, implementation, and state were available and read. A spec is optional and absent.
**Dispatch audit (policy view):** `Dispatch: scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:gpt-6.1-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-reviewer-gpt-6-1-sol-high`
**Gate route:** inline (runtime=codex, cliRoot=/Users/thomas.stang/Code/vox/open-agent-toolkit). The branch-local helper selected this route; its reason reports that model evidence is unavailable. Gate frontmatter records the supplied invocation configuration, separately from the project policy audit.

## Review Scope

This is a pre-implementation plan review. `state.md` still identifies design as complete, and `plan.md` is in progress while the quick-start exit gate runs. The explicit requested plan scope takes precedence. Scaffolded implementation content and pending readiness bookkeeping are not implementation defects.

The Dispatch Profile advisory was applied. A missing section is normal; no explicit phase ceiling rows exist to assess. The sequential phase dependencies are consistent with the generated-output ownership boundaries.

The final fixes from the three prior structured review attempts were read directly, including the raw deep-tier allowlist, explicit version-check base, and prefilter wildcard restrictions. Prior review claims were not treated as acceptance evidence.

## Summary

The plan covers the requested local, stateless search workflow and its standalone/plugin distribution, but it needs corrections before implementation. Three High findings affect secret handling and successful session discovery; one Medium finding leaves the large-scan confirmation rule incomplete.

Blocking findings remain.

Findings by severity: 0 critical, 3 high, 1 medium, 0 low

## Findings

### Critical

None

### High

- **H1: Cover quoted credential keys and values in redaction** (`.oat/projects/shared/session-search/plan.md:147`).

  The specified credential regex requires `:` or `=` immediately after the key or whitespace. It does not match the closing quote in JSON such as `{"password":"synthetic-only"}` or `{"API_KEY":"synthetic-only"}`. These short values also evade every named-prefix and long-run rule. Tool-output units can contain JSON, and the deep oversize fallback explicitly matches raw serialized records, so redacting before windowing still permits credential values in output. Quoted values containing spaces can also be only partly masked by the specified `\S+` value rule. This conflicts with discovery's output-privacy constraint (`discovery.md:178`). A synthetic reproduction masked `password=synthetic-only` but left both quoted-key examples unchanged.

  Fix: Revise p01-t04 and the corresponding design to handle quoted JSON keys, complete quoted values, and the escaped representation used by raw deep-tier records. Make the representation boundary explicit so every emitted snippet/title/first prompt receives effective redaction. Add focused synthetic regressions for short JSON credentials, a quoted value with spaces, and an escaped raw-record credential near a snippet edge; retain the ordinary-path negatives.

- **H2: Reject character classes that can consume JSON-escaped characters from the raw prefilter** (`.oat/projects/shared/session-search/plan.md:346`).

  Non-negated classes are allowed without restricting what their ranges can match. The admitted ASCII pattern `foo[ -~]bar` matches decoded `foo"bar` and `foo\bar` in Node. Raw JSON stores those characters as two bytes, so the same single-character class fails in rg. The synthetic reproduction returned a Node match and rg exit 1 for both cases. Exit 1 is treated as a valid empty prefilter result, which drops the only matching file before verification. Rejecting bare `.` fixed one route to this false negative but leaves the class-range route open. This violates the plan's provable-superset contract and design's identical-results guarantee (`design.md:33`).

  Fix: Revise p02-t04's eligibility rules to exclude classes/ranges that can match characters whose JSON representation expands, or translate them to a proven raw-JSON superset. Fall back to Node whenever safety cannot be established. Add equivalence regressions for `[ -~]` against quoted and backslash-containing decoded text; do not limit the regression to the already rejected `foo.bar` case.

- **H3: Match Claude tool content before the shared digest truncates it** (`.oat/projects/shared/session-search/plan.md:225`).

  The planned Claude adapter sends each record through `normalizeEntries` before matching. That normalizer caps tool results at 500 characters and tool inputs at 200 (`src/shared/transcript/runtimes.ts:220`, `src/shared/transcript/runtimes.ts:1761`). A valid tool-result line below the 64 KiB line cap with the only target phrase after character 600 therefore loses the phrase before the deep-tier matcher sees it. The raw fallback applies only to oversize lines and cannot recover this ordinary-sized record. Direct execution of the shared production normalizer confirmed that the synthetic original contained the target while its normalized output did not. The motivating tool-output discovery requirement is therefore not met for Claude.

  Fix: In p02-t01, keep shared normalization for ordinary messages/provenance but extract tool-result string/array content and tool input directly for search, analogous to the Codex adapter. Match the bounded full content before any display truncation, label it `tool`, and redact/window only when building output. Add a Claude adapter regression with the target past character 500 and a serialized line below `maxLineBytes`, with `includeTools` off/on controlling discovery.

### Medium

- **M1: Apply a byte bound after restricting the large scan to history/meta hits** (`.oat/projects/shared/session-search/plan.md:441`).

  The pipeline detects an over-threshold corpus, sets `needsConfirmation`, then still scans every file with a T1/T2 hit. That subset has no byte or time bound. For example, two matching 1.5 GiB sessions remain a 3 GiB scan under the default 2 GiB threshold. The CLI cannot return its confirmation request until that scan finishes, so a broad history pattern can still reproduce the long scan that the guard was intended to prevent. The same gap carries into the deep tier through the instruction to use the same guard. Discovery requires the estimated-size question before an unbounded large scan (`discovery.md:157`).

  Fix: Revise p02-t06 and the pipeline design to recompute the restricted set's bytes and enforce the threshold or another explicit bounded budget before content/deep execution. If the narrowed set is still too large, return cheap-tier results and confirmation without scanning it. Add a focused pipeline case where T1/T2-hit files alone exceed the threshold and verify that content/deep scanning waits for `allowLargeScan`.

### Low

None

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md`, `design.md`, `plan.md`, `implementation.md`, and `state.md`; canonical transcript normalization/sanitization; provider session-schema docs; distribution/packaging/version tooling; source and documentation instructions; current package and formatter configuration. Execution learnings were used only for gate environment context.

| Requirement                                                              | Plan coverage | Notes                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Local, stateless search across Claude Code, Codex, and Cursor            | Covered       | p01-p02 define internal adapters and streaming search without a persistent index.                                                         |
| Ranked, redacted results with resume/open hints                          | Partial       | Ranker/output tasks exist; H1 blocks the privacy contract.                                                                                |
| Optional rg acceleration with equivalent Node-only results               | Partial       | H2 identifies an admitted prefilter false negative.                                                                                       |
| Final deep rung for tool-only discoveries                                | Partial       | Codex direct extraction is planned; H3 blocks complete ordinary-sized Claude tool matching.                                               |
| Time hints, cwd-first search, and automatic widening                     | Covered       | Options, adapters, pipeline, and generated CLI acceptance cases cover these behaviors. This is plan coverage, not implemented acceptance. |
| Confirmation before a large unbounded scan                               | Partial       | M1 requires an explicit bound for the T1/T2-hit subset.                                                                                   |
| Subagent roll-up and archived Codex sessions                             | Covered       | Adapters and ranking include parent attribution, inherited-record filtering, and archive labeling.                                        |
| Optional tools and internal-schema degradation                           | Covered       | Probes, sqlite schema checks, and deterministic fallback fixtures are planned.                                                            |
| Empty-result guidance, ChatGPT question, and opt-in other-machine search | Covered       | p03-t01 includes the agent ladder and remote reference.                                                                                   |
| Canonical ownership, standalone/plugin packaging, versions, and docs     | Covered       | p03-p04 use the declared build, manifest/version updates, user-guide docs, and full premerge verification.                                |

### Extra Work (not in declared requirements)

None. The stale Codex path correction was explicitly requested in discovery. No missing Dispatch Profile or missing optional spec finding is warranted.

## Verification Commands

Review-time synthetic checks completed successfully and demonstrated the failures described above. No product source or tests were changed, and no live provider or remote store operation was required.

The production-normalizer counterexample is reproducible from the repository root:

```bash
node --import tsx --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { normalizeEntries } from './src/shared/transcript/runtimes.ts';
const needle = 'SESSION_SEARCH_SYNTHETIC_TARGET';
const record = { type: 'user', message: { role: 'user', content: [
  { type: 'tool_result', tool_use_id: 'stub', content: 'x'.repeat(600) + needle }
] } };
const entries = normalizeEntries('claude-code', [record], {
  includeToolCalls: true, includeToolResults: true
});
assert(record.message.content[0].content.includes(needle));
assert(!entries.some(entry => entry.text.includes(needle)));
console.log('Shared digest truncates the searchable Claude target.');
NODE
```

After the plan is corrected and the implementation exists, verify the regressions at their owning boundaries:

```bash
pnpm run test:vitest src/skills/session-search/src/lib/redact.test.ts src/skills/session-search/src/lib/adapters/claude-code.test.ts src/skills/session-search/src/lib/scan.test.ts src/skills/session-search/src/lib/pipeline.test.ts
pnpm run build
pnpm run test:vitest src/skills/session-search/src/cli.test.ts
pnpm run build:check
```

These future commands are verification guidance, not claims that the unimplemented session-search suites passed.

## Recommended Next Step

Return this blocking review artifact to the invoking gate. Run `oat-project-review-receive` through the gate's eligible handoff, revise the affected plan/design contracts, and repeat the plan review before implementation readiness is marked complete.
