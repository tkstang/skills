---
oat_generated: true
oat_review_scope: bounded
oat_review_type: code
oat_review_run_id: "446cd7d0-bd2c-4b53-b1f4-6b62e1bdd9c4"
---

# Consensus Review

**Verdict:** pass
**Worktree:** `/Users/tstang/orca/workspaces/skills/session-fidelity`
**Scope token:** `017b37eb77319396c1c3f0d1bc7b2bddf6f49fbb5a49151a9ec7b5a8e56552a7`
**Reviewer:** claude (model unobserved, effort unobserved)
**Findings:** 0 critical, 0 high, 2 medium, 1 low

## Request

Perform the independent p01 CODE review specified in this immutable external packet\. It contains the exact authored before/after Git diff, immutable base/head, changed\-file hashes and verification report\. Review the changes against the p01 plan requirements, consulting repository context and immutable git revisions as needed, read\-only\. Do not modify files, run providers, or rerun stress tests\. Generated copies are covered by hashes and passing build:check; inspect meaningful propagation, not unchanged bundles broadly\. The base\-branch selector would exceed the2MiB cap on duplicate generated before/after files, so this packet retains diff/deletion context without that duplication\.<br><br>Response contract: findings must use \`anchor\` for the captured EXTERNAL PACKET, with the packet's exact SHA256 source\_version from evidence\.json and a precise heading/line range\. Name the affected repository file and line in claim/evidence, not as an uncaptured location\. Do not invent repository snapshot hashes\. Verdict pass if no Critical/High \(Medium/Low findings still allowed\); changes\_requested requires at least one Critical/High\. Inconclusive only for actual missing necessary evidence\. Report substantive defects and honestly state checks not run\. This is independent implementation review, not only a prose\-plan review\.<br>

## Summary

p01 delivers both tasks as specified\. p01\-t01 replaces the 120 ms subprocess lifetime assumption with a condition\-based \`waitFor\` on the exact delivered delta plus a durable checkpoint, then asserts a clean SIGTERM exit \(\`signal === null\`, \`code === 0\`\) with a SIGKILL fallback in \`finally\`; the retained harness and log show 50/50 consecutive passes with a real busy\-loop child over iterations 11–40 and clean teardown, and the implementation record honestly states that three CI \`validate\` successes remain outstanding\. p01\-t02's new \`src/shared/transcript/terminal\-events\.ts\` matches the plan's native semantics closely: Codex \`task\_complete\`\-with\-error and \`turn\_aborted\` only \(success and \`task\_started\` excluded\), \`usage\_limit\_exceeded\`\-gated retry extraction with an anchored \`try again at …\` grammar that validates hour/minute, calendar date and ordinal agreement and emits only the fragment with \`inferred\-from\-error\-message\` provenance; Claude's three explicit assistant flags with API\-error \> abort \> truncation precedence and \`apiErrorStatus\` admitted only alongside \`isApiErrorMessage\`; exact\-session pointer joins with orphan/cross\-session rejection; Cursor \`turn\_ended\` error/aborted/cancelled with faithful frame locators \(\`cursor\-frames\.ts\` emits one frame per newline, so \`physicalLine = frameIndex \+ 1\` holds\)\. Range gating, checkpoint reuse, \`\-\-quiet\-empty\` visibility, metadata\-only event logs, body omission and the collaboration non\-authority assertion are all covered by tests, and the Codex activity path now shares \`decodeCodexLifecycleRecord\` so the two projections cannot diverge\. Three defects remain, none Critical/High: watch deltas now silently withhold the underlying record that produced a terminal event with no accounting bucket for it; the Claude interruption\-dedup map is keyed on a \`message\.id\` the repo's own schema documents as spanning multiple records; and the stop/heartbeat \`deltaEvents\` counter now includes terminal events\.

## Scope and provenance

- Selector: `document=/tmp/evidence-p01-review-packet.md`
- Requested paths: none
- External documents: `/private/tmp/evidence-p01-review-packet.md`
- Captured evidence: 150408 bytes
- Reviewer claim: \{"provider":"anthropic","model":"claude\-opus\-5","effort":"high"\}
- Observed reviewer evidence: The provider envelope identifies the provider only; model and effort were not independently observed\.
- Diversity: unknown — Provider selection alone does not establish a different model family\.
- Drift comparison: stable within stated coverage
- Detection limit: Content changes outside the selected set may go undetected when Git status is unchanged; ignored, unselected, external, and transient write\-then\-revert activity are not fully monitored\.

### Authorship evidence

- unknown — unknown, unknown coverage; No bounded author evidence was supplied\.

### Reviewer-reported inspected context

- External review packet /private/tmp/evidence\-p01\-review\-packet\.md \(150408 bytes, 3829 lines\): request, scope adaptation, changed\-file manifest, full authored before/after diff (`465a369170673c235b4f99923648479223b6db86c7600965bf96fa948d9ef8ec`)
- Immutable repository revision read via git show for context only: plan\.md p01 tasks, terminal\-events\.ts, digest\.ts, watch\.ts, types\.ts, cursor\-frames\.ts, cursor\-analysis\.ts, runtimes\.ts, activity/codex\.ts, claude\-code\.md schema doc, p01 stress log and harness (`0e0843fe8cac61cda4b0c609ca9fba4f9a310261`)
- Immutable captured phase base referenced by the packet (`73e1752b57e03878a908f506622142a5115b41e2`)

## Findings

### Critical

None

### High

None

### Medium

- **M1: Terminal records are removed from watch digest entries and from every accounting bucket** (``anchor: ## Authored before/after diff → `diff --git a/src/skills/session-observer/src/lib/digest.ts` hunks `@@ -1264,16 +1282,32 @@` and `@@ -1284,20 +1318,24 @@` (packet lines 2824-2876)``)
  - Claim: \`src/skills/session\-observer/src/lib/digest\.ts:1301\-1334\` drops every record index that produced a terminal event from both \`allEntriesWithTools\` and \`allEntries\`\. Because \`src/skills/session\-observer/src/lib/watch\.ts:1806\` forces \`includeTerminalEvents: true\` for the whole watch pipeline, a Claude assistant record flagged \`truncatedAfterOutput === true\` or \`isAbortedMidStream === true\` — which carries the real output produced before the failure — no longer appears in the rendered delta at all, and no accounting bucket reports the omission\. The plan required only that terminal events not be \*added\* to transcript entries; it did not ask for existing entries to be withheld, and neither \`src/skills/session\-observer/SKILL\.md:330\` nor \`documentation/docs/user\-guide/skills/session\-observer\.md:165\-192\` documents the withholding\.
  - Evidence: \`digest\.ts:1301\-1307\` builds \`terminalRecordIndexes\` from the emitted events; \`digest\.ts:1326\-1334\` filters both entry views on it\. The accounting block at \`digest\.ts:1399\-1450\` then leaves the record unexplained: \`filtered\.toolCalls/toolResults/commandMessages\` derive from \`fullEntriesInRawRange\`, which comes from the already\-filtered \`allEntriesWithTools\`; \`filtered\.bootstrap\*\` derive from \`bootstrapRecordIndexes\`; and \`filtered\.metadataRecords\` counts only raw indexes absent from \`rawRecordIndexesWithAnyEntry\`, which is built from the \*unfiltered\* \`allEntriesWithToolsBeforeBootstrap\` — so a suppressed assistant record does have an entry there and is not counted as metadata either, while \`accounting\.raw\.count\` still includes it\. \`renderMarkdown\` has no terminal rendering \(grep for \`terminalEvents\` in \`digest\.ts\` at HEAD returns only lines 1127, 1162, 1290, 1301\-1302, 1328, 1333, 1566\), so nothing replaces the dropped text\. The new watch test in \`src/skills/session\-observer/src/watch\.test\.ts\` asserts \`expect\(events\.some\(\(event\) =\> event\.type === 'delta'\)\)\.toBe\(false\)\` for a range whose \`isApiErrorMessage\` assistant record carries a text content block, locking the suppression in\. Concrete failure: a pinned peer's Claude turn ends with \`truncatedAfterOutput === true\` after emitting substantive assistant text — the watcher prints only \`\[session\-observer\] terminal runtime=claude\-code … status=truncated\-after\-output record=N\`, the assistant text never reaches the observing agent, and \`accounting\.raw\.count\` exceeds \`rendered\.count\` plus every \`filtered\.\*\` bucket with nothing explaining the difference, which is the exact reconciliation the user guide tells readers to rely on when judging whether a quiet digest means the peer was idle\.
  - Suggestion: Narrow the suppression to what the terminal event genuinely replaces \(for example only \`isApiErrorMessage\` records, whose body is the provider error string\), or keep the entry and redact its body\. Whichever is chosen, add the withheld records to a dedicated \`accounting\.filtered\` bucket so the range still reconciles, state the behavior in \`SKILL\.md\` and the user guide, and add a regression asserting that a \`truncatedAfterOutput\` assistant's output still reaches the delta \(or is explicitly accounted for\)\.
  - Confidence: 0.85

- **M2: Claude interruption dedup keys on a message\.id that the repo's own schema says spans multiple records** (``anchor: ## Authored before/after diff → `diff --git a/src/shared/transcript/terminal-events.ts` new-file hunk `@@ -0,0 +1,385 @@`, function `claudeTerminalEvents` (packet lines 2420-2493)``)
  - Claim: \`src/shared/transcript/terminal\-events\.ts:281\` stores one map entry per \`message\.id\` with last\-write\-wins, and \`src/shared/transcript/terminal\-events\.ts:322\-323\` suppresses a user interruption only when \*that\* single stored record carries \`isAbortedMidStream\`\. The repository's own native evidence, \`documentation/docs/engineering/architecture/session\-schemas/claude\-code\.md:303\-306\`, records that Claude writes one assistant record per content block, repeating the same \`message\.id\`, and that 17,027 of 23,715 \`\(file, message\.id\)\` groups hold more than one record\. The dedup the plan explicitly mandated therefore rests on a key that is not per\-record unique, and nothing folds the flag across the group\.
  - Evidence: \`terminal\-events\.ts:267\-285\` builds \`assistants\` with \`assistants\.set\(messageId, \{ detailed, status: claudeAssistantStatus\(record\) \}\)\` inside the record loop, so each later record for the same \`message\.id\` overwrites the earlier status\. \`terminal\-events\.ts:322\-323\` reads back only that one value: \`const target = assistants\.get\(interruptedMessageId\); if \(\!target \|\| target\.status === 'aborted\-mid\-stream'\) return \[\];\`\. The suppression fixture in \`src/shared/transcript/terminal\-events\.test\.ts\` \('suppresses explicit\-abort duplicates and orphan or cross\-session pointers'\) and the watch integration fixture both use single\-record assistant messages, so no test exercises a \`message\.id\` group larger than one\. Concrete failure: an aborted Claude turn written as two assistant records sharing \`message\.id: 'assistant\-1'\` — \`apiBlockIndex: 0\` carrying \`isAbortedMidStream: true\`, \`apiBlockIndex: 1\` written without it — leaves the map holding block 1 with \`status: null\`, so the following user record with \`interruptedMessageId: 'assistant\-1'\` is not suppressed and the watcher emits both an \`aborted\-mid\-stream\` and an \`interrupted\` terminal event for one failure, the duplicate the plan required suppressed\.
  - Suggestion: Fold status across every record sharing a \`message\.id\` \(keep the first non\-null status, preferring an explicit abort\) rather than overwriting, and add a fixture with a multi\-record \`message\.id\` group whose abort flag sits on a non\-final block\. Severity is bounded by real uncertainty about which record carries the flag in the 3 observed occurrences; the fold is cheap and removes the dependence on that unverified placement\.
  - Confidence: 0.5

### Low

- **L1: stop and heartbeat report terminal events as deltaEvents** (``anchor: ## Authored before/after diff → `diff --git a/src/skills/session-observer/src/lib/watch.ts` hunks `@@ -1093,47 +1126,58 @@` and `@@ -1147,16 +1191,72 @@` (packet lines 3169-3170 and 3232)``)
  - Claim: \`src/skills/session\-observer/src/lib/watch\.ts:1174\` and \`src/skills/session\-observer/src/lib/watch\.ts:1243\` add \`terminalEvents\.length\` to \`eventState\.eventCount\`, but that counter is surfaced to users as delta delivery: \`src/skills/session\-observer/src/lib/watch\.ts:575\` prints \`deltaEvents=$\{eventState\.eventCount\}\`, and \`watch\.ts:570\` and \`watch\.ts:736\` expose it as \`eventCount\` on the \`stopped\` and \`heartbeat\` events, whose documented meaning is emitted digests\.
  - Evidence: Before this change \`eventCount\` was incremented once per rendered delta \(\`eventState\.eventCount\+\+\` in the removed \`emitObservedDelta\`/\`emitPending\` bodies, packet lines 3288 and 3335\)\. The new \`emitLegacyWatchEvents\` and \`emitCursorDelta\` increment by \`terminalEvents\.length \+ \(shouldRenderDelta ? 1 : 0\)\`, and the new watch tests confirm the mixed counting: the Codex terminal\-only test asserts \`result\.eventCount\` is 1 with zero deltas, and the Claude test asserts \`result\.eventCount\` is 2 with zero deltas\. \`stoppedLine\` at \`watch\.ts:575\` was not updated\. Concrete failure: a watch that emits three terminal events and no digests stops with \`\[session\-observer\] watch stopped reason=signal deltaEvents=3\` and reports \`eventCount: 3\` in its \`stopped\` JSON, so an operator or collaborating agent reconciling delivered digests against the peer transcript concludes three digests were delivered when none were\.
  - Suggestion: Either rename the printed field \(for example \`events=\` with a separate \`deltaEvents=\`/\`terminalEvents=\` split\) or track terminal emissions in a distinct counter, and update the \`watch\` event\-type documentation in \`src/skills/session\-observer/SKILL\.md\` accordingly\.
  - Confidence: 0.9

## Questions

- Was withholding the source record from the watch delta \(digest\.ts:1326\-1334\) a deliberate body\-safety decision for \`isApiErrorMessage\` records that was then applied uniformly, or an unintended side effect for \`truncatedAfterOutput\` / \`isAbortedMidStream\` records that carry genuine assistant output?
- Cursor's v2 digest adds \`terminalEvents\` at digest\.ts:1162 but does not exclude the terminal frame from its own entry pipeline, while the schema\-v1 path at digest\.ts:1326\-1334 does exclude the record\. Is that runtime asymmetry intended, given the plan's instruction not to silently omit a supported runtime?
- \`RETRY\_SUFFIX\` anchors on \`\\\.$\` with no trimming, so a \`usage\_limit\_exceeded\` message whose native text ends with a trailing newline or space after the period yields no retry evidence\. Is that intended strictness, or should the message be trimmed before matching?

## Limitations

- Read\-only review: no tests, builds, formatters, package managers, providers or network calls were run, per the request\. All pass/fail claims about the suite, \`build:check\`, \`validate\` and skill\-version validation are taken from the packet's implementation record, not independently reproduced\.
- Generated payloads under \`skills/\*\*\` and \`plugins/\*/skills/\*\*\` were not diffed\. They are covered by the packet's changed\-file hashes and the reported \`build:check\` pass; I inspected canonical sources and version/changelog consistency instead\.
- The Claude multi\-record \`message\.id\` finding depends on which record of an aborted message carries \`isAbortedMidStream\`\. The repo's schema sample records only 3 occurrences of that flag and does not state its placement within a \`message\.id\` group, and no private transcript bodies were consulted \(out of scope\), so the finding is stated conditionally rather than as a reproduced failure\.
- The stress evidence was read as captured text; the 50 iterations were not re\-run, and the three fixing\-PR CI \`validate\` successes are acknowledged by the packet as a later acceptance boundary outside this review\.
- Content changes outside the selected set may go undetected when Git status is unchanged; ignored, unselected, external, and transient write\-then\-revert activity are not fully monitored\.
- Provider read\-only controls are not universal filesystem or network isolation\.
- Retention is operator\-managed; the external run directory has no automatic cleanup or replay policy\.

## Checks reported

- Packet SHA256 matches the evidence manifest — passed: shasum \-a 256 of /private/tmp/evidence\-p01\-review\-packet\.md returned 465a369170673c235b4f99923648479223b6db86c7600965bf96fa948d9ef8ec, matching evidence\_manifest\.
- Full authored diff inspected — passed: All 40 changed paths in the manifest were enumerated; every authored \(non\-generated\) hunk was read in full, including the two new files \(terminal\-events\.ts 385 lines, terminal\-events\.test\.ts 388 lines\)\.
- Stress evidence consistency \(50 runs, CPU\-load interval, cleanup\) — passed: Log shows iteration=01\.\.50 all status=pass, \`cpu\-load start pid=30499 iteration=11\`, 60 lines carrying cpu\_load=\<pid\> \(30 loaded iterations\), and a summary line matching the per\-iteration record\. Runs were not reproduced\.
- Plan requirement trace for p01\-t01 and p01\-t02 — passed: Each plan clause was matched to diff content or to an explicit test; the only gaps found are reported as findings and questions\.
- Version, changelog and doc coherence — passed: Canonical skill versions, CHANGELOG Unreleased entries and the two instruction/doc surfaces agree on 1\.0\.72 \(re\-arm\) and 1\.0\.73 \(terminal events\) plus the transitive closure bumps\.

## Suggested verification

- Vitest suites \(watch\.test\.ts, terminal\-events\.test\.ts, collaboration suite\) — not\_run: Prohibited by the read\-only review contract; results taken from the packet's implementation record \(watcher 60/60, shared terminal/activity 32/32, collaboration 199/199\)\.
- pnpm run build:check / validate / validate:skill\-versions / type\-check — not\_run: Prohibited by the read\-only review contract; generated payload parity accepted on the packet's declared hashes plus the reported build:check pass\.
- Generated payload diff inspection — not\_run: Per the scope adaptation, generated bundles were not diffed; canonical sources and version propagation were inspected instead\.
- Three consecutive CI validate runs on the fixing PR — not\_run: Acknowledged by the packet as a later acceptance boundary; no PR exists yet\.
- Live provider or installation acceptance — not\_run: Out of scope for this review and for the project per plan\.

## Artifact paths

- Run directory: `/Users/tstang/.local/state/consensus/d43c2739a174d5c14978abd503dd1c07b810241e7d4a5214ccd077c30348dcb7/reviews/446cd7d0-bd2c-4b53-b1f4-6b62e1bdd9c4`
- Captured request: `/Users/tstang/.local/state/consensus/d43c2739a174d5c14978abd503dd1c07b810241e7d4a5214ccd077c30348dcb7/reviews/446cd7d0-bd2c-4b53-b1f4-6b62e1bdd9c4/request.txt`
- Captured evidence: `/Users/tstang/.local/state/consensus/d43c2739a174d5c14978abd503dd1c07b810241e7d4a5214ccd077c30348dcb7/reviews/446cd7d0-bd2c-4b53-b1f4-6b62e1bdd9c4/evidence.json`
- Host result JSON: `/Users/tstang/.local/state/consensus/d43c2739a174d5c14978abd503dd1c07b810241e7d4a5214ccd077c30348dcb7/reviews/446cd7d0-bd2c-4b53-b1f4-6b62e1bdd9c4/result.json`
