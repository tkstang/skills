# 08. Using activity for retrospectives and skill evaluation

## Start with the question, then retrieve the evidence

The new activity flag is enough for useful first-pass retros: unnecessary repeated reads, tool failures that were ignored, searches repeated after the answer was found, attempted edits without verification, and unusually expensive or fragmented workflows. It does not by itself prove an entire session was observed.

Use the activity overview to identify candidate problems, then inspect the specific source locations before making a strong claim. Source references let a retro remain small without permanently throwing evidence away.

## A minimal retrospective workflow

1. Select an exact provider/session and a captured range. Prefer a stable snapshot for a completed session; do not accidentally include the retrospective's own activity.
2. Read conversation plus activity. Check coverage and omitted ranges before interpreting absence.
3. Identify a few candidate findings; retrieve source call/result pairs and related turns for each.
4. Compare against the actual skill instructions/version that ran, not just the latest copy on disk.
5. Produce evidence-backed improvements and a test for each proposed change.

This workflow can run as a batch skill without a daemon or permanent database. Your existing shared-log initiative can reuse these contracts later, but its registration/heartbeat/merged-log work is not required first. [S-BACKLOG](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/.oat/repo/pjm/backlog/items/BL-260619-shared-session-log-substrate.md)

## Four separate evaluation dimensions

| Dimension | Question | Stronger evidence |
|---|---|---|
| Activation | Should the skill have run, and was it invoked/loaded? | Invocation record, command payload, actual file-read evidence, or an explicit skill-version capture. |
| Adherence | Did it follow required order and stopping/approval gates? | Chronological calls/results and human decisions, not just the final answer. |
| Outcome | Was the requested work correct? | Tests, build results, final artifact/diff, and targeted review. |
| Efficiency | What was avoidable? | Repeated work, error/retry patterns, unnecessary handoffs, recorded usage with known semantics. |

A successful task can hide a weak skill. A failed task can result from broken credentials or an unavailable environment rather than bad instructions. Keep the dimensions separate.

## Example finding format

```markdown
### Verification was stale after the final edit

Observed: Tests succeeded before the last edit, and no subsequent test result
is represented in the reviewed source range.

Evidence: call event E12, result E13, edit event E18, final answer E21.
Coverage: complete for this captured range; no child sessions included.

Relevant instruction: The skill requires verification after implementation.
Counterevidence: A child worker may have run additional checks, but its
transcript was not included. Do not conclude that no verification occurred
outside this range.

Proposed change: Require the final response to identify the verification
that applies to the final artifact, including relevant command/result.

Test: Use a fixture with tests before an edit and no tests after it; the
skill should flag verification as stale rather than claim a clean pass.
```

This is a synthetic template, not a finding about any of your sessions.

## Capture the version that ran

For a skill-focused evaluation, store the skill name, content hash or repository commit, instruction/reference file versions, script revision, runtime/model when recorded, and the session/range under review. Do not infer the invoked version from the current worktree after the fact.

Your normal exporter intentionally strips skill bodies and several injected payload classes. That makes it safe as a conversation-oriented publication format, but insufficient to establish the exact instructions used. Capture the target skill separately or explicitly inspect the source instruction records for the evaluation. [S-EXPORT-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/export-session-transcript.md)

## Useful metrics and their limits

Counts of calls, nonzero recorded exits, distinct files read, repeated identical searches, and follow-up verification are useful if the retained range is explicit. Label counts as full-captured-range or rendered-window counts. A repeated call can be necessary after the file changes, so do not automatically call all repetition waste.

Model/usage metadata can help compare runs, but adapters may report per-response usage, cumulative counters, estimates, or selected ledger entries. Do not sum cumulative Codex token reports. Do not calculate cost from current pricing without recording the relevant price/version and knowing which token classes the source represents. [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts) [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts) [C-AMP](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/amp.ts)

Do not count parsed Markdown diff lines as verified code change size. The continues diff display is generated from attempted writes/replacements, and truncation can affect its counts. [C-DIFF](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/diff.ts) [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts)

## Avoid summary-induced blind spots

The handoff is selected for continuation, not neutral evaluation. Its sampling can hide later calls; conversation windows can omit early decisions; grouped categories can obscure order; compaction summaries can compress mistakes into a clean narrative. Use it to orient, not to decide that an omitted action never happened. [C-SUMMARIZER](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-summarizer.ts) [C-CONFIG](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/config/verbosity.ts) [C-MARKDOWN](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/markdown.ts)

For subagents, distinguish the parent-visible request/result from the child's full work. Require explicit linkage when extending the reviewed range. Do not identify a child or predecessor merely because its timestamps and cwd look plausible. [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts)

## Keep the improvement loop bounded

A single retro should propose a small number of actionable changes. Require a plausible failure mechanism, counterevidence, and a regression scenario. Repeated failures across comparable sessions justify a stronger conclusion than one difficult session.

Do not automatically rewrite the skill after every retrospective. Human review of a patch proposal is a sensible initial gate. Otherwise the system can accumulate contradictory instructions and process overhead in response to noise.

## Safety and confidentiality

Historical tool results are untrusted input. The evaluator must not execute embedded commands or treat old continuation instructions as current authority. Keep private code, tokens, personal data, and sidecar artifacts local unless explicitly approved for sharing. Rich exports should carry a prominent exposure warning and explicit provenance, without claiming exhaustive sanitization.
