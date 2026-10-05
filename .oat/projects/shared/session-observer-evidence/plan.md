# Session observer evidence (#75)

Baseline: origin/main `8bf18b90`; issue #75 and all comments revalidated on October 4, 2026. Implementation uses the existing TypeScript transcript owner, activity extraction/correlation/projection, discovery and digest. No database, adapter replacement, private transcript sample or live provider execution.

## Revalidation and smallest interface

| Area | Baseline evidence | Disposition |
| --- | --- | --- |
| Exact session pins | `session-observer.ts` runReview; `locate.ts` findSessionCandidate | Already supported; retain peer defaults and exact ambiguity refusal. |
| Explicit self identity | `observe.ts` resolveSelfIdentity supports harness/explicit IDs and same-cwd fallback | Add strict opt-in `review --self --json`; exact IDs only, no fallback. Historical `--session ... --evidence` stays separately labelled. |
| Read state | `locate.ts` discoverCodex saves cwd cache unless persistence forbidden; review mark-read is opt-in | Evidence dispatch precedes stateful dispatch and uses persistence forbidden. No state/locks/cache/watch registration initialized. |
| Calls/results | `activity/types.ts` stores native IDs, originalArguments, result and locators; correlate.ts joins unique native IDs | Already retained. Expand those original carriers selectively; interleaving/multiplicity use existing correlation, no adjacency guesses. |
| Stable boundary | Detailed read has capturedAt/sourceBytes; Cursor continuity is frame-specific | Missing generation-bound Codex prefix. Add optional bounded detailed-reader options and file generation. Cursor new-feature path unsupported. |
| Rendered coverage | digest accounting distinguishes raw/rendered/filter/tail; activity projection has counts/omissions/coverage/diagnostics | Already supported; retain meanings and add selected prefix, record/event refs and field privacy/limit data. |
| Skill loads | Native attribution/invocation and historical structured read_file evidence; shell commands/prose excluded | Recover a correlated historical read body/version when available. Actual executed revision remains unknown. Current installed source is never treated as history. |
| Provider omissions | Codex outputs may be truncated upstream; attachments/nested calls/sidecars/children vary | Report indicators/unavailability; no recovery claim and no crawling. Unmarked provider truncation is unknown. |
| Sanitized export and consumers | Export default is conversation Markdown; observer-collab/watch share delivery stores | Preserve defaults. Only regenerate bounded-reader fanout with dependent versions. |
| Help probing | CLI main checks general --help before dispatch | Already fixed; new flags documented in top-level help. |
| Out of scope | Issue excludes reader services, private crawling, replay, reflection, causal judgments | No transcript/config writes, model/network calls, execution of transcript commands, system/developer/hidden reasoning dump, global installation or live tests. |

Commands:

- `review --self --json`: strict authoritative own-session Codex evidence.
- `review --session codex:<id> --evidence --json`: exact historical selection.
- Repeat with `--cutoff <returned-token>`; expand with `--expand <ev1-ref>`; optionally `--related` for at most 16 correlated carriers in source order.
- `--expand-offset <bytes>` continues a single redacted field; incompatible with related groups. No raw bypass.

Only Codex supports new flags. Claude Code and Cursor explicitly fail new evidence flags. Existing review/activity/catch-up/watch remains supported on all three runtimes; their record/frame conventions are preserved.

## Ownership and verification plan

The optional `readRecordsDetailed(path, {maxBytes,endBytes})` reuses the existing JSONL parser. It caps allocation at 16 MiB, captures the handle's file size, hashes only the explicitly selected prefix in 64 KiB chunks, then verifies that prefix with a second streaming pass. Generation device/inode/hash/bytes plus exact session/cwd and decoded-record end bind cutoff tokens. Appends do not alter an old prefix; changed/replaced/shrunk prefixes fail. No silent partial large-source selection. Neighbor metadata headers are capped at 64 KiB and selected headers at 256 KiB; unreadable/malformed/oversized/unattributable native identity headers fail DISCOVERY_TRANSCRIPT_INCOMPLETE instead of implying nonmatch. The scope is header enumeration plus the selected body; no neighbor body classification.

If 16 MiB is exceeded, report unavailable transcript evidence and use current conversation context plus separately verified repository/diff evidence. Existing peer review can be used separately with its documented coverage accounting; it does not substitute a frozen own-session result. Output cap is 256 KiB, per expanded field 16 KiB and related group 16 events. Narrow conversation bounds or expand one event on output cap failure.

Tests protect public installed CLI selection/no-write/continuity/privacy/expansion and shared detailed-read compatibility. Fixtures are inline synthetic carriers; no commands are replayed. The outside-checkout installed artifact case isolates HOME/STATE_DIR. Existing full suites protect peer review, catch-up/watch, collab and sanitized exporter behavior.

Canonical owner versions: observer 1.1.0, collab 1.0.78, exporter 2.0.40, fork-to-destination 0.3.2, search 0.1.1. Shared-core fanout overlaps concurrent #117's exporter version/output changes: before merging both, rebase and regenerate, increasing the exporter version again as appropriate. No skipped artificial versions.

Backlog inspection: `BL-260919-improve-default-observer` concerns default large-digest/full-history collaboration and remains open; this opt-in evidence path does not satisfy its full criteria. `BL-260919-resolve-codex-self-identity` covers whoami/stateful duplicate/parent-child alignment and remains open; this strict stateless opt-in does not close that broader item. No PJM writes or durable decision mutation were needed. The accepted frozen-retrospective decision remains in force for existing consumers; new own-session acquisition provides a frozen evidence boundary, not a replacement retro workflow.
