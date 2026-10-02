# Design review disposition

2026-09-30. Consensus requested `claude:opus`, effort `high`; reviewer self-reported Claude Opus 5.5/high. Runtime observed the provider, not independently the exact model/effort. [First review](reviews/design-01.md) completed with changes requested; [JSON](reviews/design-01.json) preserves structured findings. No product implementation has begun.

| Finding | Disposition in revised design |
| --- | --- |
| H1 live source snapshot | Accept problem; deliberately exclude cross-provider source-current for this version. Require inactive completed source, retain same-provider behavior. No prefix-cut machinery. |
| H2 injected user context | Add explicit wrapper classification, counts and ambiguous-mixture refusal. Preserve ordinary/quoted text and avoid broad tool-output scrubbing. This is not a secret sanitizer. |
| H3 home routing | Preserve default unset routing and selected spelling; realpath only for storage/identity. Reviewer's credential-specific explanation remains unverified; change avoids unnecessary configuration changes regardless. |
| H4 project key | Private non-ASCII-alphanumeric replacement, bounded key length, space/underscore acceptance fixture. Verified pinned upstream `claude_sessions.py:177`; long-key behavior is unsupported rather than guessed. |
| M1 idempotence | Occupancy excluded from digest but checked on apply. Exact repeats succeed; any divergence/archives refuse with manual recovery guidance. No nonce. |
| M2 API constraints | Conservative explicit supported identifier profile, documented tool-name constraint, no Codex item IDs, require a completed final assistant message. Loopback does not prove production service acceptance. |
| M3 Claude identity | Synthetic native fork inspected: all sessionId rows equal child. Define filename/leaf ownership separately from validated-chain ancestry; refuse contradictions. No assumption that all native forks mix owners. |
| M4 local compaction | Explicit summary-only compaction refusal/code and fixture. |
| M5 sandbox writes | Distinct store-write-denied and exact terminal apply fallback, no automatic escalation. |
| M6 acceptance gaps | Preinitialize disposable homes, test exact emitted command with PTY where available; separately state RPC and terminal evidence. |
| L1 store scans | Restrict to deterministic paths and UUID matches in archive/date directory. |
| L2 publication | Non-JSONL temporary name, directory fsync, extra namespaced provenance, UUIDv8, canonical plan encoding. |
| L3 helper adaptation | Import errors and quoted env argv; source-home discovery asymmetry stated. |
| L4 raw caps/types | Raw-input caps explicit; bounded known metadata allowlist distinct from unknown active content. |

Design questions resolved by scope: distinct worktrees only, CLI sources only, evolved seeds refused, active source-current unsupported. These are first-release limits, not compatibility claims. A second Opus design review must resolve remaining material issues before Sol implementation.

## Second review and implementation gate

[Second review](reviews/design-02.md) / [JSON](reviews/design-02.json): **pass**, all prior high/medium findings resolved, five low clarifications. Incorporated explicit Codex display-event/rollback handling, opaque compaction refusal, home assignment on terminal replay, actionable incomplete-turn remedy, and non-skipped evidence requirements. Owning session_meta cwd remains authoritative; turn_context does not redefine source ownership.

Consensus selected and passed `claude:opus --effort high`. The reviewer response self-reported effort `medium`, conflicting with the invocation metadata; observed output identifies only provider. The verified claim is an Opus/high configured invocation, not independent confirmation of internal effort. The first review self-reported high. Root accepts the revised design and authorizes the already user-approved GPT-6.1 Sol implementation. No product code was changed before both design reviews completed.

Implementation clarification: target homes inside either selected worktree refuse before writes. Otherwise the importer's own staging/seed files would invalidate Git evidence and repeated-apply digests. This bounds placement without adding Git exclusions or weakening drift checks.
