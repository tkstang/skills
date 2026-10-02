# Implementation review disposition

Consensus requested `claude:opus` with `--effort high`. [First review](reviews/implementation-01.md) / [JSON](reviews/implementation-01.json) completed with changes requested: one high, two medium, three low. The reviewer self-reported Claude Opus 5.5 and explicitly could not independently observe effective effort. Drift comparison was stable within selected-file coverage. These controls are not universal filesystem or network isolation; ignored, unselected and transient changes are outside full coverage. External review retention is operator-managed.

Root verified the queued-input finding against the repository's shared Claude normalizer and selected these bounded dispositions before Sol fixes:

| Finding | Accepted disposition |
| --- | --- |
| H1 queued human prompts | Refuse queued input anywhere in the selected Claude transcript rather than guess delivery/deduplication order. Unknown attachments cannot be silently classified as runtime metadata. |
| M1 command arguments | Preserve safely delimited slash-command arguments as user text; keep provider-expanded isMeta instructions omitted. Malformed mixtures refuse. |
| M2 coverage gaps | Add meaningful public conversion/chain tests and filesystem publication tests, especially staging-to-link revalidation, actual write denial/replay routing and source/home drift. No coverage quota or test-only production hook. |
| L1 synthetic completion | Reject synthetic/API-error Claude assistant rows as completion evidence, grounded in repository-supported markers. |
| L2 publication diagnostics | Classify actual store write failures separately, preserve original refusal when cleanup also fails, and document empty directories may remain. Do not broaden cleanup ownership. |
| L3 evidence wording | Keep same-provider commands documentation-backed; describe imported-seed RPC/noninteractive CLI checks separately. |

The design was updated with these conservative refinements. Sol completed the fixes. Eleven fidelity/completion regressions and two publication-diagnostic regressions failed against the pre-fix code for their intended reasons, then passed after fixes. The focused import suite passes 35 tests; publication passes eight. Two staging-window cases passed ten repetitions each. Final integrated validation passed: 2,502 tests and both isolated generated-client loops. TypeScript, generated parity, validation, smoke, version checks and docs build passed.

## Final acceptance

[Second review](reviews/implementation-02.md) / [JSON](reviews/implementation-02.json): **pass**, zero critical/high/medium findings and two low findings. All six first-review findings were resolved. The reviewer also inspected native-test network isolation and the new test oracles. Requested/configured `claude:opus --effort high`; self-reported Opus 5.5, effective effort not independently observable. Selected-state drift comparison passed.

Root accepts this bounded alpha implementation for a draft PR. Two low completion-detection edge cases remain documented, not dismissed as impossible: Codex abort/error lifecycle events or final commentary do not independently invalidate the portable completion check; Claude trailing omitted context can hide a preceding error/synthetic assistant row from the leaf check. Users must still stop the source and verify a completed assistant turn. These cases need fixture/client-order verification before broadening completion rules; no generalized completion guarantee is claimed. Recognized slash-command scope is deliberately message-first with matching command-name; unrecognized order refuses.

Exact printed-command interactive acceptance remains unverified, as recorded in verification.md. Merge, release, global install and personal-history acceptance are separate.
