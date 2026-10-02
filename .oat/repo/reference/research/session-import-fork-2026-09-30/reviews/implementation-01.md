---
oat_generated: true
oat_review_scope: bounded
oat_review_type: code
oat_review_run_id: "64766b16-e51f-4d2d-afa7-aeb02e7af428"
---

# Consensus Review

**Verdict:** changes\_requested
**Worktree:** `/Users/tstang/.t3/worktrees/skills/t3code-0a05071c`
**Scope token:** `fb812b45dd995689c362715ceb5e141dc3d849fe6f0f37d18d0c00da3392048b`
**Reviewer:** claude (model unobserved, effort unobserved)
**Findings:** 0 critical, 1 high, 2 medium, 3 low

## Request

Review the implementation of import\-before\-native\-fork for correctness and accepted\-design adherence\. The user explicitly requested Opus high design review BEFORE GPT\-6\.1 Sol implementation; both design reviews are recorded under \.oat/repo/reference/research/session\-import\-fork\-2026\-09\-30/, and design\-02 passed\. Read design\.md, design\-review\.md and verification\.md there as supporting context\. Review current selected canonical source/tests/skill/docs; generated distributions were built and passed parity\. Existing same\-provider guidance must remain intact\. This is an alpha bounded subset: inactive completed Claude/Codex CLI sources, distinct registered worktrees, plan then digest\-guarded apply of a reconstructed seed, caller\-run native fork command\. Focus on data fidelity/refusal versus silent loss, active native chains and tools/compaction/context wrappers, source immutability, stale\-plan/idempotence, no\-clobber/containment/cleanup, provider home routing and shell command guards\. Confirm tests protect actual boundaries and docs accurately state raw payload privacy and proof limits\. Evidence: 2474 full tests pass, 3 intentional skips; two non\-skipped isolated generated\-client loops passed against populated homes, Codex0\.159\.2 RPC \+ Claude2\.1\.284 CLI print/resume\. Exact interactive terminal acceptance remains unverified, explicitly documented; do not treat RPC proof as terminal proof\. A real Codex PTY was blocked by sandbox daemon ps startup\. No broad support claim\. Seek concrete material issues; distinguish code evidence from client assumptions\. Read\-only review, no edits or provider/client execution or personal\-history inspection\. Do not run full tests: one existing suite intentionally mutates/restores a tracked generated file\. No external messages\. Report requested/configured effort separately from any model/effort you cannot independently observe\. Output the required review schema\.

## Summary

The import\-before\-native\-fork implementation mostly follows the accepted design\-02\. Planning is read\-only, and discovery runs with persistence 'forbid'\. Source reads are strict and bounded, with O\_NOFOLLOW, fatal UTF\-8 decoding, and before/after identity checks\. The digest excludes occupancy, and apply recomputes the plan and compares digests\. Publication is no\-clobber: exclusive 0600 staging, revalidation, parent dev/ino rechecks, then link with EEXIST handling\. Target homes inside either worktree are refused\. Shell guards reuse quoteShellWord and pwd \-P, and default routing requires the variable to stay unset\. Existing same\-provider \`prepare\`/\`discover\`/\`preview\` paths are unchanged apart from help text and a test assertion that is looser but equivalent\. Docs state clearly that raw payloads are not sanitized and that RPC evidence does not prove terminal acceptance\.<br><br>One material fidelity defect was found\. The Claude reader treats \`attachment\` and \`queue\-operation\` records as runtime metadata, but the repo's own shared normalizer shows these carry human\-authored queued prompts\. Those prompts are dropped and counted as \`runtime\-context\` \(on the active chain\) or ignored with no count \(off chain\)\. This contradicts "preserve supported text" and the refuse\-rather\-than\-lose goal\.<br><br>Slash\-command arguments are also removed along with their isMeta expansion\. This matches the design text, but it still loses user intent under a generic label\.<br><br>Test protection is thin for several of the boundaries this review focuses on:<br>\- the revalidation between staging and link<br>\- target\-home drift<br>\- the store\-write\-denied replay command and environment\-sourced routing<br>\- Claude chain refusals: cycle, missing parent, sidechain, compaction boundary<br>\- isMeta and command envelopes, media placeholders, the synthetic preface, and the project\-key limit<br><br>Removing the pre\-link revalidation, for example, would leave every in\-repo test passing\. Lower\-severity items: synthetic or API\-error Claude assistant rows can satisfy the completed\-turn check; cleanup\-failure errors mask the original refusal; and one doc sentence slightly overstates evidence for same\-provider commands\.

## Scope and provenance

- Selector: `files=src/skills/session-fork-to-destination/SKILL.md,src/skills/session-fork-to-destination/references/provider-guidance.md,src/skills/session-fork-to-destination/references/teleporter-license.txt,src/skills/session-fork-to-destination/src/guidance-cli.ts,src/skills/session-fork-to-destination/src/guidance-cli.test.ts,src/skills/session-fork-to-destination/src/session-import.ts,src/skills/session-fork-to-destination/src/session-import.test.ts,src/skills/session-fork-to-destination/src/native-history.ts,src/skills/session-fork-to-destination/src/import-errors.ts,src/skills/session-fork-to-destination/src/import-store.ts,src/skills/session-fork-to-destination/src/import-native-clients.test.ts,src/skills/session-fork-to-destination/src/helpers/import-native-clients-support.ts,documentation/docs/user-guide/skills/session-fork-to-destination.md,documentation/docs/user-guide/skills/index.md,CHANGELOG.md,.oat/repo/reference/research/session-import-fork-2026-09-30/verification.md`
- Requested paths: `src/skills/session-fork-to-destination/SKILL.md`, `src/skills/session-fork-to-destination/references/provider-guidance.md`, `src/skills/session-fork-to-destination/references/teleporter-license.txt`, `src/skills/session-fork-to-destination/src/guidance-cli.ts`, `src/skills/session-fork-to-destination/src/guidance-cli.test.ts`, `src/skills/session-fork-to-destination/src/session-import.ts`, `src/skills/session-fork-to-destination/src/session-import.test.ts`, `src/skills/session-fork-to-destination/src/native-history.ts`, `src/skills/session-fork-to-destination/src/import-errors.ts`, `src/skills/session-fork-to-destination/src/import-store.ts`, `src/skills/session-fork-to-destination/src/import-native-clients.test.ts`, `src/skills/session-fork-to-destination/src/helpers/import-native-clients-support.ts`, `documentation/docs/user-guide/skills/session-fork-to-destination.md`, `documentation/docs/user-guide/skills/index.md`, `CHANGELOG.md`, `.oat/repo/reference/research/session-import-fork-2026-09-30/verification.md`
- External documents: none
- Captured evidence: 239168 bytes
- Reviewer claim: \{"provider":"anthropic","model":"claude\-opus\-5\-5 \(self\-reported\)","effort":"requested high; effective effort not independently observable"\}
- Observed reviewer evidence: The provider envelope identifies the provider only; model and effort were not independently observed\.
- Diversity: unknown — Provider selection alone does not establish a different model family\.
- Drift comparison: stable within stated coverage
- Detection limit: Content changes outside the selected set may go undetected when Git status is unchanged; ignored, unselected, external, and transient write\-then\-revert activity are not fully monitored\.

### Authorship evidence

- unknown — unknown, unknown coverage; No bounded author evidence was supplied\.

### Reviewer-reported inspected context

- src/skills/session\-fork\-to\-destination/src/session\-import\.ts (`6974c7dfdb4dd95f3347d61e640893c1bd6c528ad85bd1ae638fa5bf61679b26`)
- src/skills/session\-fork\-to\-destination/src/native\-history\.ts (`1b67e2f30cd7b5f014e941bd4ed02d414bd0c58c074d1050b777d94d3325aad8`)
- src/skills/session\-fork\-to\-destination/src/import\-store\.ts (`745b09974806c5ad9646df380c7d4f045e8ffc7615c50643c8d08ddca55b1e63`)
- src/skills/session\-fork\-to\-destination/src/session\-import\.test\.ts (`669151d8b193a4713b977df71420fe86307cf289ddb8b45629b1dd0a12d4cee5`)
- documentation/docs/user\-guide/skills/session\-fork\-to\-destination\.md (`bb79f48f03e402c92867054806ba12a6e2598d03a197e9d9c22885bad0c04040`)
- src/skills/session\-fork\-to\-destination/src/guidance\-cli\.ts (`4641f200edf158d80c24a6e7ca84c100b85a9c65dfbcdd855970318d73c6843e`)
- src/skills/session\-fork\-to\-destination/SKILL\.md (`a6b7a68dc9432d82cab18454a7eab4fb7135048f3410458049a9c87f39d272b1`)

## Findings

### Critical

None

### High

- **H1: Claude queued human prompts are dropped as runtime metadata** (`src/skills/session-fork-to-destination/src/native-history.ts:451-462 (1b67e2f30cd7b5f014e941bd4ed02d414bd0c58c074d1050b777d94d3325aad8)`)
  - Claim: The Claude reader loses human\-authored mid\-turn prompts\. \`attachment\` records on the active chain are counted as \`runtime\-context\` and skipped\. \`queue\-operation\` records off the chain are ignored with no count\. In both cases user\-authored conversation text disappears from the seed without a refusal, and the count label misdescribes it\.
  - Evidence: native\-history\.ts:281\-297 puts 'attachment' and 'queue\-operation' in CLAUDE\_META\. Lines 451\-462 skip any non\-user/assistant chain node other than disallowed system subtypes and count it as 'runtime\-context'\. Off\-chain records are never processed \(only sibling tool\_result user rows are recovered, lines 405\-436\)\. The repo's shared normalizer \(src/shared/transcript/runtimes\.ts:1835\-1879\) documents that Claude 'repeats a delivered queue item in a queued\_command attachment' and emits it as a human user message\. Session\-observer fixtures show \`\{"type":"attachment","attachment":\{"type":"queued\_command","prompt":\.\.\.,"origin":\{"kind":"human"\}\}\}\`\. Those fixtures lack uuid/parentUuid, so whether real attachments sit on the parent chain is a client\-format assumption\. Either placement loses the text\. Docs and SKILL\.md say supported user text is preserved and only reasoning/recognized runtime envelopes are omitted\.
  - Suggestion: Treat \`attachment\` records whose type is \`queued\_command\` with human origin as user text in chain order, or refuse with a specific code such as \`unsupported\-queued\-input\`\. Do not count them as runtime\-context\. Refuse unknown attachment subtypes on the active chain instead of allowlisting the whole record type\. Add a fixture with an on\-chain queued\_command attachment and assert that it is preserved or refused\.
  - Confidence: 0.75

### Medium

- **M1: Slash\-command arguments and their isMeta expansion are both removed** (`src/skills/session-fork-to-destination/src/native-history.ts:66-79 (1b67e2f30cd7b5f014e941bd4ed02d414bd0c58c074d1050b777d94d3325aad8)`)
  - Claim: A Claude user turn such as \`/skill do X\` loses the user's request entirely\. The \`\<command\-args\>\` envelope is stripped as runtime context, and the isMeta expanded prompt is skipped\. The imported history can then show assistant work with no prompting request, or trigger the synthetic assistant\-first preface\. The only trace is a generic 'runtime\-context' count\.
  - Evidence: native\-history\.ts:66\-79 includes 'command\-message', 'command\-name' and 'command\-args' in the stripped envelope list\. userText \(lines 107\-118\) removes each whole envelope\. Lines 465\-468 skip \`isMeta === true\` records as runtime\-context\. The design lists 'fully recognized command/local\-caveat/system\-reminder envelopes' as omissions, so this follows the accepted text\. However, command arguments are user\-authored, which conflicts with the design's own principle of keeping user text that can be safely separated from a known prefix\.
  - Suggestion: Keep \`\<command\-args\>\` content \(or a rendered \`/name args\` line\) as user text and only strip the command\-message/name wrappers\. Alternatively, report a distinct omission key such as 'command\-invocation' so the plan shows that user instructions were removed\. Add a fixture covering it\.
  - Confidence: 0.6

- **M2: Key safety boundaries have no test protection** (`src/skills/session-fork-to-destination/src/session-import.test.ts:192-204 (669151d8b193a4713b977df71420fe86307cf289ddb8b45629b1dd0a12d4cee5)`)
  - Claim: Several boundaries the design says tests must protect are never exercised\. Removing them would leave the in\-repo suite passing\.<br>\- Revalidation of Git, source, and home between staging and link\.<br>\- \`target\-home\-drift\`\.<br>\- \`store\-write\-denied\` and its replay command, including the environment\-prefix and default\-unset guards\.<br>\- Environment\-sourced target routing in the printed command\.<br>\- Claude chain refusals: \`native\-parent\-cycle\`, \`native\-parent\-missing\`, \`invalid\-active\-chain\`/sidechain, \`duplicate\-native\-id\`, and the compact\_boundary stop\.<br>\- isMeta and command\-envelope omission\.<br>\- Media placeholders, the synthetic preface, \`unsupported\-claude\-project\-key\`, and \`interleaved\-tool\-exchange\`/orphan results\.
  - Evidence: A grep of every session\-fork\-to\-destination test and helper file finds no occurrences of: media, synthetic\-assistant, compact\_boundary, native\-parent, duplicate\-native, invalid\-active\-chain, store\-write\-denied, replayCommand, target\-home\-drift, unsupported\-claude\-project\-key, interleaved, orphan, isMeta, command\-args\. The 'refuses stale source and changed Git evidence' test \(session\-import\.test\.ts:192\-204\) only reaches the digest mismatch in makePlan, not the \`revalidate\` callback inside publishImportSeed \(import\-store\.ts:335\)\. guidance\-cli\.test\.ts mocks \`import\`, so generated\-CLI home/cwd routing is covered only by the opt\-in native test, which always passes \`\-\-target\-home\` \(explicit route\)\.
  - Suggestion: Inject a revalidate failure between staging and link \(for example, mutate the source or dirty the target inside a wrapped revalidate\)\. Assert the refusal, no seed, and removal of the temp file\. Add a store\-write\-denied case using a read\-only store directory and assert the replay string's cwd guard and env prefix or unset guard\. Add a small table of Claude chain fixtures for cycle, missing parent, sidechain, compaction, isMeta and command envelopes, plus one media/preface fidelity case\.
  - Confidence: 0.8

### Low

- **L1: Synthetic or API\-error Claude assistant rows count as a completed turn** (`src/skills/session-fork-to-destination/src/native-history.ts:264-271 (1b67e2f30cd7b5f014e941bd4ed02d414bd0c58c074d1050b777d94d3325aad8)`)
  - Claim: The completed\-turn gate only checks that the last portable item is non\-empty assistant text\. Claude\-generated synthetic assistant rows are imported as genuine model replies, such as API\-error text or interruption placeholders\. Such a row can satisfy \`incomplete\-source\-turn\` even though the source turn did not actually finish\.
  - Evidence: native\-history\.ts:264\-271 accepts any non\-empty assistant text as the last item\. The Claude branch \(lines 463\-507\) does not inspect message\.model or error markers, and there is no refusal or omission for synthetic assistant content\. This depends on the client format \(Claude Code's '\<synthetic\>' model and API\-error rows\); I did not verify it against a live store\.
  - Suggestion: Refuse or count synthetic/API\-error assistant rows, for example by message\.model === '\<synthetic\>' or an explicit error flag\. Require the final assistant text to come from a non\-synthetic row\.
  - Confidence: 0.45

- **L2: Publication error mapping and cleanup can mislabel or mask failures** (`src/skills/session-fork-to-destination/src/import-store.ts:376-408 (745b09974806c5ad9646df380c7d4f045e8ffc7615c50643c8d08ddca55b1e63)`)
  - Claim: Any EACCES/EPERM raised inside publish is reported as \`store\-write\-denied\` with a terminal replay command, including errors from the source or Git reads inside \`revalidate\`\. A temp\-file unlink failure replaces the original refusal \(for example seed\-diverged or git\-evidence\-drift\) with \`store\-cleanup\-failed\`\. Store directories created with mkdir are left behind when apply later refuses\.
  - Evidence: import\-store\.ts:376\-388 maps error\.code EACCES/EPERM to store\-write\-denied regardless of which operation raised it\. Lines 397\-408 throw the cleanup error before \`failure\` is rethrown\. inspectParents\(create=true\) at line 318 creates directories before revalidation, and nothing removes them\.
  - Suggestion: Map only store\-path write errors to store\-write\-denied\. When cleanup fails after an earlier failure, keep the original code and attach the cleanup failure as secondary detail\. Document that empty store directories may remain, or remove directories this run created when it refuses before linking\.
  - Confidence: 0.7

- **L3: The fork/resume doc sentence overstates evidence for same\-provider CLI commands** (`documentation/docs/user-guide/skills/session-fork-to-destination.md:186-187 (bb79f48f03e402c92867054806ba12a6e2598d03a197e9d9c22885bad0c04040)`)
  - Claim: The 'Fork and resume are different' section now says the documented \`claude \-\-resume ID \-\-fork\-session\` and \`codex fork ID\` capabilities come 'with later isolated import experiments'\. Those experiments forked imported seeds: through app\-server RPC for Codex, and with extra noninteractive flags for Claude\. They did not exercise the printed \`codex fork ID\` terminal command or same\-provider native sessions\.
  - Evidence: documentation/docs/user\-guide/skills/session\-fork\-to\-destination\.md:186\-187\. verification\.md and the Current limitations section of the same page state that the exact printed terminal commands remain unverified\.
  - Suggestion: Reword to keep the same\-provider commands documentation\-backed\. Point to the import evidence as separate RPC and noninteractive\-CLI checks of imported seeds only\.
  - Confidence: 0.65

## Questions

- Do real Claude Code 2\.1\.x \`attachment\` records \(queued\_command, file mentions\) carry uuid/parentUuid and sit on the active parent chain? The answer decides whether the queued\-prompt loss is counted \(on chain\) or completely uncounted \(off chain\)\.
- Was dropping \`\<command\-args\>\` user text a deliberate design choice, or should slash\-command arguments be kept as user text?

## Limitations

- Read\-only static review\. I ran no tests, type\-check, build, provider clients or PTY, as instructed\.
- Claims about provider transcript formats come partly from the repo's own shared normalizer and fixtures \(queued\_command attachments\), and partly from client\-format assumptions that I flag in individual findings\. I inspected no personal history\.
- Generated distributions \(skills/, plugins/\) were not diffed against canonical source; parity is taken from the host's reported build:check\.
- I did not review import\-native\-clients\-support\.ts in depth \(network\-isolation profile, RPC harness\)\. I only checked that printed\-command failures are recorded as unverified rather than failing the test\.
- Reviewer identity is self\-reported: Anthropic Claude Opus 5\.5 \(claude\-opus\-5\-5\)\. The requested/configured effort was 'high' per the request\. I cannot independently observe the effective reasoning effort\.
- Content changes outside the selected set may go undetected when Git status is unchanged; ignored, unselected, external, and transient write\-then\-revert activity are not fully monitored\.
- Provider read\-only controls are not universal filesystem or network isolation\.
- Retention is operator\-managed; the external run directory has no automatic cleanup or replay policy\.

## Checks reported

- Manifest hash match for reviewed files — passed: shasum of session\-import\.ts, native\-history\.ts, import\-store\.ts, session\-import\.test\.ts and the user\-guide doc matched the evidence manifest\.
- Static coverage grep for refusal codes in tests — passed: Confirmed no tests reference store\-write\-denied, target\-home\-drift, Claude chain refusal codes, media, synthetic preface, isMeta or command\-args\.
- Discovery persistence during plan — passed: GUIDANCE\_DISCOVERY\_OPTIONS\.persistence='forbid' prevents the observer cwd\-cache write \(locate\.ts:1002,1143\), so planning creates no files\.

## Suggested verification

- Full Vitest suite — not\_run: Instructed not to run; the host reports 2474 passed and 3 skipped\.
- Opt\-in native\-client import suite — not\_run: No provider/client execution permitted; the host reports 2 passed with Codex 0\.159\.2 RPC and Claude 2\.1\.284 CLI\.
- TypeScript type\-check / build:check / validate — not\_run: Read\-only review; outcomes are taken from the host's verification\.md\.

## Artifact paths

- Run directory: `/Users/tstang/.local/state/consensus/6c60744c2219535d84f7de65d8087e0ac134682406e65e8f6e96d9106da51fee/reviews/64766b16-e51f-4d2d-afa7-aeb02e7af428`
- Captured request: `/Users/tstang/.local/state/consensus/6c60744c2219535d84f7de65d8087e0ac134682406e65e8f6e96d9106da51fee/reviews/64766b16-e51f-4d2d-afa7-aeb02e7af428/request.txt`
- Captured evidence: `/Users/tstang/.local/state/consensus/6c60744c2219535d84f7de65d8087e0ac134682406e65e8f6e96d9106da51fee/reviews/64766b16-e51f-4d2d-afa7-aeb02e7af428/evidence.json`
- Host result JSON: `/Users/tstang/.local/state/consensus/6c60744c2219535d84f7de65d8087e0ac134682406e65e8f6e96d9106da51fee/reviews/64766b16-e51f-4d2d-afa7-aeb02e7af428/result.json`
