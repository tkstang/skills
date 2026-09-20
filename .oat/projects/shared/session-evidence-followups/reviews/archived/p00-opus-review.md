---
oat_generated: true
oat_review_scope: bounded
oat_review_type: code
oat_review_run_id: "8c84e955-3f2e-4817-afd8-a7d08531875b"
---

# Consensus Review

**Verdict:** pass
**Worktree:** `/Users/tstang/orca/workspaces/skills/session-fidelity`
**Scope token:** `bba2cb73421712163ea9f2ef4b5f4f2f6bf1e22da9632e9f27fbd636457ab3ea`
**Reviewer:** claude (model unobserved, effort unobserved)
**Findings:** 0 critical, 0 high, 1 medium, 1 low

## Request

Review ONLY the p00\-t01 timeout change from the captured phase base through current HEAD\. Requirements: Consensus Review default max\_runtime\_sec is 900 seconds; explicit internal maxRuntimeSec override preserved; no unrelated timeout or CLI/schema change; focused provider\-boundary tests; canonical skill version/changelog/docs and generated outputs agree\. Plan: \.oat/projects/shared/session\-evidence\-followups/plan\.md task p00\-t01\. Sol implemented and self\-reviewed commit 852be12c\. Inspect the canonical diff and confirm generated default propagation, not the unchanged bundled runtime broadly\. Do not modify files or run a provider\. Report substantive findings only\.<br><br>Response rules: repository findings require location with exact captured path, lines and SHA\-256 source\_version from evidence packet, never anchor\. No Critical/High means verdict pass \(Medium/Low findings may still be reported\)\. changes\_requested requires at least one Critical/High; inconclusive is for actual missing necessary evidence\. Do not inflate severity\. Keep checks/coverage proportional to this small bounded change\.<br>

## Summary

The p00\-t01 change does exactly what it claims and nothing more\. \`src/skills/consensus\-review/src/run\.ts:214\` moves the review dispatch default from \`600\` to \`900\` while keeping \`input\.maxRuntimeSec ??\` ahead of it, so internal callers still win; \`executeBoundedReview\`/\`runReviewCli\` never set \`maxRuntimeSec\`, so the SKILL\.md claim that the CLI exposes no timeout override is accurate\. I traced the value end\-to\-end: \`run\.ts\` → \`ConsensusCliRunRequest\.max\_runtime\_sec\` → \`structured\-output\.ts:216\` \(\`timeoutSec: request\.max\_runtime\_sec\`\) → \`subprocess\.ts:69/97\` kill timer, so 900 reaches a real wall clock and is not silently capped \(\`DEFAULT\_TIMEOUT\_SEC = 300\` only applies when the field is absent\)\. Both generated bundles \(\`skills/consensus\-review/scripts/review\.mjs\`, \`plugins/consensus/skills/review/scripts/review\.mjs\`\) carry the identical one\-line default change at their bundled \`runReview\`, share one sha256, and are otherwise byte\-identical to base; both generated \`SKILL\.md\` copies match canonical except the plugin's expected \`name: review\` rename\. Version moved 0\.1\.13 → 0\.1\.14 in all three SKILL\.md copies, the CHANGELOG entry sits under \`\#\# \[Unreleased\]\` → \`\#\#\# Changed\` naming the skill and version, and the user\-guide page carries the same sentence\. No other timeout, CLI flag, schema, or provider\-cli surface was touched\. Tests cover both sides of the provider boundary: the default 900 is asserted at dispatch and a new focused test asserts an explicit \`maxRuntimeSec: 321\` survives to the request; neither assertion can be swallowed, since the only try/catch in \`runReview\` wraps \`scanScopeState\`, well before dispatch\. Two non\-blocking observations follow: the newly documented 15\-minute default can exceed the host tool budget that actually launches \`review\.mjs\`, and the default\-900 guard rides inside an unrelated host\-context test rather than one of its own\.

## Scope and provenance

- Selector: `base_branch=f7298f35195ff305ec2d223f3873845444dc2317`
- Requested paths: `CHANGELOG.md`, `documentation/docs/user-guide/consensus/review.md`, `plugins/consensus/skills/review/SKILL.md`, `plugins/consensus/skills/review/scripts/review.mjs`, `skills/consensus-review/SKILL.md`, `skills/consensus-review/scripts/review.mjs`, `src/skills/consensus-review/SKILL.md`, `src/skills/consensus-review/src/run.test.ts`, `src/skills/consensus-review/src/run.ts`
- External documents: none
- Captured evidence: 896643 bytes
- Reviewer claim: \{"provider":"anthropic","model":"claude\-opus\-5","effort":"medium"\}
- Observed reviewer evidence: The provider envelope identifies the provider only; model and effort were not independently observed\.
- Diversity: unknown — Provider selection alone does not establish a different model family\.
- Drift comparison: stable within stated coverage
- Detection limit: Content changes outside the selected set may go undetected when Git status is unchanged; ignored, unselected, external, and transient write\-then\-revert activity are not fully monitored\.

### Authorship evidence

- unknown — unknown, unknown coverage; No bounded author evidence was supplied\.

### Reviewer-reported inspected context

- src/skills/consensus\-review/src/run\.ts \(canonical dispatch default\) (`0fb08b4b43fc30686d5dace74b9635956fcfe04a709ce185cd8131a6c9dd7425`)
- src/skills/consensus\-review/src/run\.test\.ts \(provider\-boundary tests\) (`c832c26dc69e348e5ac9138687f6b3a29f90aebeb67553ec61afb78c4becaf3f`)
- src/skills/consensus\-review/SKILL\.md \(canonical skill, version 0\.1\.14\) (`33a4269f835b21b8a33b3c8366c6d845d8552d3025d4f65ac4a1c21773291226`)
- skills/consensus\-review/scripts/review\.mjs \(generated standalone bundle\) (`5c8f8b8e2216f48798723ea9da9d52ee8079372f471649869a54a62c9993edb5`)
- plugins/consensus/skills/review/scripts/review\.mjs \(generated plugin bundle\) (`5c8f8b8e2216f48798723ea9da9d52ee8079372f471649869a54a62c9993edb5`)
- plugins/consensus/skills/review/SKILL\.md \(generated plugin skill\) (`4e46de14ca0f08fe3c8693896857a00cc0167069205739420af636313b7b440d`)
- skills/consensus\-review/SKILL\.md \(generated standalone skill\) (`33a4269f835b21b8a33b3c8366c6d845d8552d3025d4f65ac4a1c21773291226`)
- documentation/docs/user\-guide/consensus/review\.md \(user\-guide runtime note\) (`437068322c7f6e295db0a10c75769b17fb0972b4b688f2c0a162386572779210`)
- CHANGELOG\.md \(Unreleased / Changed entry\) (`dccb29ef3179dcdd03e6126ffa51d1449b92312964687e4cf5f2159ec983d4b9`)

## Findings

### Critical

None

### High

None

### Medium

- **M1: Documented 15\-minute default can exceed the host tool budget that launches review\.mjs** (`src/skills/consensus-review/SKILL.md:65-66 (33a4269f835b21b8a33b3c8366c6d845d8552d3025d4f65ac4a1c21773291226)`)
  - Claim: SKILL\.md and the user guide now state a 15\-minute default wall clock, but the skill is invoked through the host's shell tool \(\`allowed\-tools: Bash\(node:\*\)\`\), whose own command timeout is the binding constraint; where that budget is under 900s, the review is killed by the host before the runtime's own timeout can fire, and neither document warns the host to raise it\.
  - Evidence: src/skills/consensus\-review/SKILL\.md:6 declares \`allowed\-tools: Bash\(node:\*\)\` and lines 40\-42 instruct the host to run \`node \./scripts/review\.mjs \.\.\.\` as a shell command\. Lines 65\-66 then assert "Each provider invocation has a 15\-minute wall\-clock runtime by default\. The CLI does not expose a timeout override\." The runtime honors 900s for real \(src/skills/consensus\-review/src/run\.ts:214 \-\> src/plugins/consensus/provider\-cli/structured\-output\.ts:216 \-\> src/plugins/consensus/provider\-cli/subprocess\.ts:69,97\), so nothing internal truncates it, but the enclosing host command does\. This harness's own Bash tool documents a 600000 ms \(10 minute\) maximum, i\.e\. below the new default\. Grepping \`documentation/\` and \`src/skills/\` for \`600000\`, \`tool timeout\`, \`host timeout\`, and \`Bash timeout\` returns no mention anywhere in the repo, so the constraint is undocumented\. Before this change the two limits coincided at 600s; raising only the inner one opens a window \(600\-900s\) in which the failure is a host\-side command kill rather than the runtime's structured timeout diagnostic, losing the artifact/exit\-code contract described at SKILL\.md:61\-64\.
  - Suggestion: Add one sentence beside the new text telling the host to give the \`review\.mjs\` invocation at least the full runtime budget \(for shell tools that cap below 900s, raise the per\-command timeout to its maximum\), and note that a host\-side kill is not the runtime's own timeout and produces no review artifact\. If a host cannot be given more than 600s, that host's callers are the case for passing an explicit internal \`maxRuntimeSec\` — which this change correctly preserved\.
  - Confidence: 0.6

### Low

- **L1: New 900s default is asserted inside an unrelated host\-context test** (`src/skills/consensus-review/src/run.test.ts:62-66 (c832c26dc69e348e5ac9138687f6b3a29f90aebeb67553ec61afb78c4becaf3f)`)
  - Claim: The only guard on the new 900\-second default is a bare \`expect\` added inside a test named for explicit host\-context propagation, so the default's regression coverage is coupled to a test whose stated subject is unrelated, while the override path did get its own focused test\.
  - Evidence: src/skills/consensus\-review/src/run\.test\.ts:65 inserts \`expect\(request\.max\_runtime\_sec\)\.toBe\(900\);\` into the \`runTurn\` stub of the test \`uses the same explicit host context for scoped preflight and dispatch\` \(line 40\), whose remaining assertions concern \`request\.host\`, \`runtime\_policy\`, and \`dependencies\.transport\`\. By contrast, the override is covered by a dedicated case, \`preserves an explicit internal review timeout at provider dispatch\` \(line 105\), asserting \`toBe\(321\)\` at line 120\. Both assertions are genuinely load\-bearing — \`runReview\` wraps only \`scanScopeState\` in try/catch \(src/skills/consensus\-review/src/run\.ts:179\-185\), so a failing expectation inside \`runTurn\` propagates out of the awaited call rather than being swallowed — so this is placement, not effectiveness\.
  - Suggestion: Consider a sibling case to the override test \(e\.g\. \`applies the default review timeout at provider dispatch\`\) asserting \`toBe\(900\)\` with no \`maxRuntimeSec\` supplied, so the default and override guards sit together and neither is lost if the host\-context test is later renamed or restructured\. Keeping the inline assertion as well is harmless\.
  - Confidence: 0.45

## Questions

- Was 900s chosen against an observed p95/p99 review duration, or as a round multiple of the previous 600s? If the former, the number is well\-grounded; if the latter, it is worth confirming that hosts can actually wait that long before the documentation commits to it\.

## Limitations

- Read\-only review: no tests, builds, formatters, package managers, or provider invocations were run, per the task constraints\. \`pnpm test\` and \`pnpm run build:check\` are reported not\_run\.
- Generated\-output freshness was verified by inspection \(single\-line diff in both bundles, identical sha256 across the two targets, generated SKILL\.md matching canonical modulo the expected plugin \`name:\` rename\) rather than by executing the build, so an unrelated staleness elsewhere in those bundles would not have been detected\.
- The host\-tool timeout in the Medium finding is sourced from this harness's own documented Bash limits, not from repository evidence; other hosts \(for example a direct \`codex exec\` launch\) may impose no such cap, which is why the finding is scoped to hosts whose command budget is below 900s\.
- Provenance was reported as unknown by the host, so no author\-based weighting was applied\.
- Content changes outside the selected set may go undetected when Git status is unchanged; ignored, unselected, external, and transient write\-then\-revert activity are not fully monitored\.
- Provider read\-only controls are not universal filesystem or network isolation\.
- Retention is operator\-managed; the external run directory has no automatic cleanup or replay policy\.

## Checks reported

- Consensus Review default max\_runtime\_sec is 900 seconds — passed: src/skills/consensus\-review/src/run\.ts:214 reads \`max\_runtime\_sec: input\.maxRuntimeSec ?? 900\`; the base blob had 600\. Value reaches an effective kill timer via structured\-output\.ts:216 and subprocess\.ts:69,97 with no clamp\.
- Explicit internal maxRuntimeSec override preserved — passed: The \`??\` guard keeps any caller\-supplied value; the ReviewTransportRequest field \(run\.ts:62\) is unchanged, and run\.test\.ts:105\-130 asserts 321 survives to the request\.
- No unrelated timeout, CLI, or schema change — passed: \`git show \-\-stat 852be12c\` lists exactly nine in\-scope files\. provider\-cli args/types/probe/subprocess are untouched; \`\-\-timeout\-sec\` \(args\.ts:579\) and DEFAULT\_PROBE\_TIMEOUT\_SEC are unmodified\. The skill gained no new flag and the reply schema is unchanged\.
- Focused provider\-boundary tests — passed: Default asserted at dispatch \(run\.test\.ts:65\) and a new dedicated override test added \(run\.test\.ts:105\)\. The new test mirrors the established claude/codex\-host fixture shape used at run\.test\.ts:387, reaches runTurn, and its assertions cannot be swallowed — the sole try/catch in runReview wraps scanScopeState only\. See the Low finding on assertion placement\.
- Canonical skill version bumped — passed: metadata\.version 0\.1\.13 \-\> 0\.1\.14 in src/skills/consensus\-review/SKILL\.md and both generated copies, satisfying the repo's changed\-skill bump rule\.
- Changelog entry present and correctly placed — passed: CHANGELOG\.md adds a \`consensus\-review 0\.1\.14\` bullet under \`\#\# \[Unreleased\]\` \-\> \`\#\#\# Changed\`, naming the skill and new version as the convention requires\.
- Documentation agrees with runtime behavior — passed: documentation/docs/user\-guide/consensus/review\.md:68\-69 and SKILL\.md:65\-66 carry identical wording; the "CLI does not expose a timeout override" claim is verified — review\.ts/runReviewCli never set maxRuntimeSec\. See the Medium finding on the host\-budget caveat\.
- Generated outputs agree with canonical source — passed: Both bundles show the identical single\-line \`600 \-\> 900\` change at their bundled runReview and share sha256 5c8f8b8e\.\.\.; generated SKILL\.md files match canonical except the plugin's expected \`name: review\`\. No tracked \.claude/\.cursor/\.agents mirror exists for this skill, so no stale provider view\.

## Suggested verification

- Vitest suite \(pnpm test\) — not\_run: Read\-only review; running tests is outside the permitted actions\.
- Generated\-output freshness gate \(pnpm run build:check\) — not\_run: Read\-only review; builds are outside the permitted actions\. Propagation was verified by diff and sha256 comparison instead\.

## Artifact paths

- Run directory: `/Users/tstang/.local/state/consensus/d43c2739a174d5c14978abd503dd1c07b810241e7d4a5214ccd077c30348dcb7/reviews/8c84e955-3f2e-4817-afd8-a7d08531875b`
- Captured request: `/Users/tstang/.local/state/consensus/d43c2739a174d5c14978abd503dd1c07b810241e7d4a5214ccd077c30348dcb7/reviews/8c84e955-3f2e-4817-afd8-a7d08531875b/request.txt`
- Captured evidence: `/Users/tstang/.local/state/consensus/d43c2739a174d5c14978abd503dd1c07b810241e7d4a5214ccd077c30348dcb7/reviews/8c84e955-3f2e-4817-afd8-a7d08531875b/evidence.json`
- Host result JSON: `/Users/tstang/.local/state/consensus/d43c2739a174d5c14978abd503dd1c07b810241e7d4a5214ccd077c30348dcb7/reviews/8c84e955-3f2e-4817-afd8-a7d08531875b/result.json`
