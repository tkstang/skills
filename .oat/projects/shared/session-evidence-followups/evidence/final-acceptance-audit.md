# Final acceptance audit — six selected session-evidence backlog items

**Audited HEAD:** `0fdf33d6d017b0b90ed843186f58efa6b85233ae`  
**Method:** bounded read-only inspection of final authored source/tests/docs and committed project receipts. No tests, builds, provider calls, or broad transcript scans were run for this audit.

## Verdict

All acceptance criteria in the six selected backlog items have committed implementation or retained acceptance evidence. I found no missing product-behavior criterion. Closeout is not yet fully green: the current full-suite integration run has one stale packaging assertion at `tests/tooling/skill-packaging.test.ts:1293-1295`, which still expects the removed “optional transcript reader” sentence after Session Retro began requiring the exact-session exporter workflow. Root reports the same run as 2,519 passed, 1 failed, 1 skipped; type-check, build freshness, validate, and smoke passed. This is a real test-integration gap, but it does not indicate a missing behavior in any of the six acceptance criteria.

Final independent review and CI for the current final head remain pending lifecycle evidence, not implementation gaps. The watcher ticket's required three-run CI streak is independently satisfied by the retained fixing-head receipt described below.

## BL-260919-stabilize-the-watcher-sigterm

| Requirement | Final evidence | Result |
| --- | --- | --- |
| Poll for the expected delta to a generous deadline; no skip, blind retry, or flaky mark | `src/skills/session-observer/src/watch.test.ts:289-307` defines condition polling with a 10-second starvation allowance. The ordinary test at `:890-1034` waits for watcher ownership, clean SIGTERM, and then exactly one delta plus checkpoint movement at `:994-1006`; it remains a normal `test(...)`. | Met |
| Audit comparable signal/timer subprocess tests | `src/skills/session-observer/src/watch.test.ts:5045-5108` also waits for active ownership before SIGTERM. The committed audit says cleanup tests wait for ownership/startup and timer tests use virtual clocks or intentionally test timeout behavior, with no matching fixed-lifetime event-count race: `.oat/projects/shared/session-evidence-followups/implementation.md:52`. | Met |
| 50 local runs including CPU load; three consecutive fixing-PR validate runs | The retained final-tree receipt records exactly 50 passes, 30 loaded iterations, clean teardown, and a checked digest: `.oat/projects/shared/session-evidence-followups/implementation.md:54`. Workflow receipt `.oat/projects/shared/session-evidence-followups/evidence/p01-ci-proof.json:2-18`, `:166-179`, and `:329-338` records attempts 1, 2, and 3 at the same `90086e6e...` head, all successful; the final disposition is recorded at `implementation.md:171`. | Met |
| Fix or separately file a real watcher race if found | The audit found a test-readiness race rather than a product shutdown/re-arm defect; the exact behavior remains asserted by the first stop, checkpoint, second delta, and second clean stop at `watch.test.ts:930-1033`. The committed subprocess audit conclusion is at `implementation.md:52`. | Met; no separate product defect required by the evidence |

## BL-260919-surface-terminally

| Requirement | Final evidence | Result |
| --- | --- | --- |
| One metadata event for provider limit/error/abort, including recorded retry evidence | `src/shared/transcript/terminal-events.ts:209-248` emits Codex error/abort metadata and admits only validated usage-limit retry fragments; Claude explicit terminal flags are decoded at `:251-322`, and Cursor unsuccessful terminal frames at `:350-378`. Native status and retry cases are covered in `src/shared/transcript/terminal-events.test.ts:62-183`, `:187-240`, and `:374-408`. | Met |
| Once per terminal record; survives quiet-empty; not a peer message or continuation authority | `src/skills/session-observer/src/watch.test.ts:1037-1178` proves one quiet-empty terminal event, checkpoint advancement, no delta, body omission, and no replay. The product contract states at-most-once delivery and denies message/continuation authority at `src/skills/session-observer/SKILL.md:331-339`; the user guide repeats it at `documentation/docs/user-guide/skills/session-observer.md:239-253`. | Met |
| No native unsuccessful status means no event; docs do not imply liveness | The decoders return no event for started/success/unqualified records (`terminal-events.ts:213-220`, `:251-257`, `:350-365`). Tests exclude Codex success at `terminal-events.test.ts:62-102`, ignore unqualified Claude error-like material at `:230-245`, and exclude Cursor success at `:374-408`. The guide explicitly says events require a natively recorded unsuccessful turn and describes the intentionally narrow runtime carriers at `session-observer.md:239-258`. | Met |
| Watch logs remain metadata-only | The quiet-empty terminal regression excludes the provider body and digest from the log at `watch.test.ts:1139-1151`; the general log regression excludes message content at `:4574-4635`. | Met |

## BL-260919-skill-attribution-in-session

| Requirement | Final evidence | Result |
| --- | --- | --- |
| Claude `attributionSkill` and `Skill` calls are structurally distinct | `src/shared/transcript/activity/claude-code.ts:25-45` emits `native-attribution` and `native-invocation` evidence. `src/shared/transcript/activity/extract.test.ts:45-135` proves both kinds without preview parsing. | Met |
| Available skills are names only; instruction bodies excluded | Claude attachment extraction reads only valid names and locators at `claude-code.ts:48-92`. The regression proves name evidence while excluding attachment content and paths at `extract.test.ts:69-177`. | Met |
| Codex/Cursor direct `SKILL.md` reads are inferred file-read evidence | `src/shared/transcript/activity/skill-evidence.ts:4-34` accepts only historical Codex `read_file.file_path` and Cursor `Read`/`ReadFile.path`, labelled `inferred-file-read`. Codex rejects shell, wrong-key, alias, and prose cases at `extract.test.ts:563-654`; Cursor rejects a shell `cat` alongside the structured read at `src/shared/transcript/activity/cursor.test.ts:98-136`. | Met |
| No native version claim; install/Git lookup is explicitly inference | `documentation/docs/user-guide/skills/session-observer.md:97-99` and `documentation/docs/user-guide/skills/session-export-transcript.md:106-108` state that no runtime records the executed version and that timestamp-relevant installed/Git resolution is inferential and may be unavailable. | Met |
| Absent fields preserve behavior; no prose guessing | `claude-code.ts:31-45` emits evidence only for present structural carriers. `skill-evidence.ts:18-34` fails closed on unrecognized tools/keys/paths; the negative Codex and Cursor fixtures above establish that prose/shell text is not guessed. | Met |

## BL-260919-token-and-usage-accounting

| Requirement | Final evidence | Result |
| --- | --- | --- |
| Claude deduplicates by native session plus `message.id`; conflicts are diagnostics | `src/shared/transcript/activity/usage.ts:60-121` keys by `${nativeSessionId}:${messageId}`, preserves uncertain missing IDs, and emits `USAGE_CONFLICT`. `src/shared/transcript/activity/usage.test.ts:33-138` covers duplicate, conflicting, missing-ID, and wrong-session records. | Met |
| Codex cumulative/per-turn semantics remain distinct; decreases become reset segments | `usage.ts:148-204` deduplicates snapshots, increments a segment on decreases, and emits separate `codex-cumulative` and `codex-last-turn` samples; response usage stays separate at `:207-248`. The regression verifies the semantic list, segment change, and reset diagnostic at `usage.test.ts:141-245`. | Met |
| Models appear only where recorded; Cursor is `not-recorded` | Claude and Codex attach recorded, ownership-compatible models at `usage.ts:86-96`, `:132-145`, and `:238-247`; unjoined models remain absent in `usage.test.ts:229-239`. `notRecordedUsage()` is explicit at `usage.ts:269-275`. The user contract states Cursor is not-recorded at `documentation/docs/user-guide/skills/session-export-transcript.md:110-120`. | Met |
| Token counts are the contract; no unconfigured monetary estimate | Token-field filtering is implemented at `usage.ts:31-46`; both runtime regressions assert absence of price/cost/currency at `usage.test.ts:119-138` and `:239-245`. The guide states token-only output and no price/cost estimate at `session-export-transcript.md:119-121`. | Met |

## BL-260919-uncapped-structured-activity

| Requirement | Final evidence | Result |
| --- | --- | --- |
| Documented exact-session JSON file with no invocation/total-byte cap, unchanged preview cap and coverage contract | `src/skills/session-export-transcript/SKILL.md:153-174` documents exact `--session`, one snapshot, complete-capture mode, null total/invocation limits, the 2 KiB preview cap, and honest coverage. The user guide gives the command and same contract at `documentation/docs/user-guide/skills/session-export-transcript.md:137-175`. | Met |
| Carries schema/runtime/native identity/capture time/source bytes/count scopes | The envelope fields are defined at `src/skills/session-export-transcript/src/session-export-transcript.ts:176-188` and populated at `:1539-1561`. `ActivityReport` contains source snapshot, delivery range, and captured/delivered/displayed counts at `src/shared/transcript/activity/types.ts:376-383`. The paired-capture regression asserts schema, runtime, native identity, timestamp linkage, limits, and source/decoded counts at `src/skills/session-export-transcript/src/cli.test.ts:2215-2234`. | Met |
| Explicit opt-in; no Observer state movement; ordinary defaults unchanged | The flag defaults to absent and is separate from `--include-activity` at `session-export-transcript/SKILL.md:102-110`, `:153-160`; runtime activation is `opts.activityOutput !== undefined` at `session-export-transcript.ts:1308-1318`. The regression leaves the `STATE_DIR` sentinel and inventory unchanged at `cli.test.ts:2185-2207`, `:2273-2277`. Destination guards protect both effective and default Observer roots at `session-export-transcript.ts:768-890`. | Met |
| Sensitive label in artifact and both guides | Envelope value `sensitive: 'not-publish-safe'` is set at `session-export-transcript.ts:1550-1560` and asserted at `cli.test.ts:2215-2219`. Exporter docs state it at `documentation/docs/user-guide/skills/session-export-transcript.md:168-175`; Retro docs at `documentation/docs/user-guide/skills/session-retro.md:25-42`. | Met |
| Round trip includes every Markdown invocation for the same fixture | `cli.test.ts:2177-2272` creates one paired capture, extracts Markdown invocation keys and structured call event keys, requires exact equality, and requires the set to be nonempty. | Met |

## BL-260919-session-retro-consume-activity

| Requirement | Final evidence | Result |
| --- | --- | --- |
| Freeze exact session first, analyze only the pair, use captured-activity title when end is unproven | `src/skills/session-retro/SKILL.md:22-55` requires exact selection, full paired export before analysis, frozen-only findings, and **Captured activity review** for active/unknown-ended targets. | Met |
| Different reviewing session; report contamination risks | `session-retro/SKILL.md:24-29`, `:53-61` requires different known identities and contamination reporting. The manual receipt establishes a distinct Codex reviewer and two target IDs at `.oat/projects/shared/session-evidence-followups/evidence/p04-acceptance.md:3-21`, with checklist evidence at `:27-32`. | Met |
| Observed evidence/locator, interpretation, and proposed change remain separate | Canonical instructions require the split at `session-retro/SKILL.md:57-73`; the template gives distinct fields at `src/skills/session-retro/assets/report-template.md:73-77`. Both acceptance examples apply it at `p04-acceptance.md:85-96` and `:132-143`. | Met |
| Preserve seven coverage states; do not turn missing evidence into absence | `session-retro/SKILL.md:75-86` preserves all seven exact values and their negative-evidence limits; the template repeats them at `report-template.md:41-53`. Manual acceptance compares the union and avoids invented states at `p04-acceptance.md:34-36`. | Met |
| Human intervention uses request → activity → native-human correction → recovery/outcome | `session-retro/SKILL.md:106-125` defines the linked chain and native-origin rules for all three runtimes. The acceptance example reports a partial Claude chain, correctly separating the runtime notification and declining a recovery claim at `p04-acceptance.md:64-76`; Cursor remains unknown at `:120-130`. | Met |
| Use full export and state runtime limits | The workflow prohibits capped Observer modes and requires full narrative plus complete activity JSON at `session-retro/SKILL.md:30-47`; runtime limits are explicit at `:87-104`. The manual receipt confirms those limits at `p04-acceptance.md:39-41`, `:78-83`, and `:113-130`. | Met |
| Agreed report shape; propose only and never edit | Assessment/report requirements are at `session-retro/SKILL.md:127-147`, `:167-178`; hard no-edit boundaries are at `:149-165`. The retained examples conclude `no change`, and the checklist records read-only outcome at `p04-acceptance.md:42`. | Met |

## Gaps and evidence limits

1. **Known current integration failure:** `tests/tooling/skill-packaging.test.ts:1293-1295` expects obsolete Session Retro wording. The generated canonical/install payload now correctly requires the installed exact-session exporter (`src/skills/session-retro/SKILL.md:30-36`). The assertion must be updated before claiming a green final full suite.
2. **Current-head review/CI:** the final independent Opus review and current final-head CI are pending. Do not infer either from prior phase checks. The watcher-specific three-run criterion is nevertheless satisfied by the immutable `p01-ci-proof.json` receipt on the fixing watcher implementation.
3. **Watcher stress receipt:** this audit did not rerun the 50-iteration stress. It relies on committed implementation evidence and its retained log/harness (`implementation.md:54`).
4. **Retro manual evidence:** the authoritative p04 exercise uses frozen Claude and Cursor fixtures only. It does not exercise a Codex frozen capture, the five unobserved coverage states, malformed/truncated input, destination failure, or a proven completed session; `p04-acceptance.md:147-154` records these limits. Static Codex checks establish contract behavior, not fixture-episode evidence.
5. **Scope of “complete”:** structured capture means every supported invocation in the captured bytes. It does not prove the session stopped or that the provider recorded every action (`session-export-transcript.md:168-175`).
