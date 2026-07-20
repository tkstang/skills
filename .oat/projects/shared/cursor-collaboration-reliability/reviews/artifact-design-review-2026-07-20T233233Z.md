---
oat_generated: true
oat_generated_at: 2026-07-20T23:32:33Z
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/cursor-collaboration-reliability
oat_selection_reason: inherit (pre-plan; no project policy)
---

# Artifact Review: design

**Reviewed:** 2026-07-20T23:32:33Z
**Scope:** design.md completeness, clarity, internal consistency, implementation-readiness, and alignment with spec.md
**Files reviewed:** 2 (design.md, spec.md; discovery.md consulted for background)
**Commits:** none — artifact review

## Summary

The design is unusually complete and tightly aligned with the spec: all 16
requirements (FR1–FR10, NFR1–NFR6) trace to concrete components, data models,
error codes, test scenarios, and phases, and the Requirement-to-Test Mapping
matches the spec's Requirement Index verification methods row-for-row. No
scope drift beyond the spec was found. The one substantive defect is an
internal contradiction in the FR2 content-stability check — the Turn Analyzer
design decision demands a stricter whole-file-signature match that, if
implemented, would starve content availability during active generation and
recreate the failure the project exists to fix — plus a few clarity gaps
around one-shot stability waits, null device/inode continuity semantics, and
non-final records in freshly caught-up completed turns.

Findings: 0 critical, 1 important, 3 medium, 3 minor

## Findings

### Critical

None

### Important

- **Contradictory stability check: whole-file signature vs candidate-prefix verification** (`design.md:375-379` vs `design.md:118-124`, `design.md:263-267`, `design.md:1252-1255`)
  - Issue: The Cursor Turn Analyzer design decision says a closed record
    "becomes content-available after two scans separated by the configured
    interval return the same file signature, safe boundary, and safe-prefix
    hash." Requiring the *same file signature and safe boundary* across both
    scans means any append between scans (normal during an active turn)
    invalidates the candidate, so content could remain buffered indefinitely
    while the peer is actively generating — precisely the "substantive text
    present but nothing surfaced" failure this project fixes. This contradicts
    three other statements in the same document that express the correct
    (spec-aligned) check: Data Flow step 5 ("Any candidate whose exact prefix
    still verifies becomes structurally stable"), the framed-reader
    `verifyPrefixBytes` decision (which explicitly snapshots the prior-boundary
    hash inside a longer file and notes that "comparing it with the longer
    current-prefix hash would be invalid"), and Caching ("Open-turn content
    requires one bounded confirmatory scan"). Spec FR2 requires only that the
    record's "exact raw prefix is unchanged."
  - Fix: Reword the analyzer design decision (design.md:375-379) to state that
    a candidate becomes content-available when the second scan verifies the
    exact raw prefix through the candidate's byte boundary (via the
    `verifyPrefixBytes` snapshot mechanism) — later appended frames do not
    reset stability. Also disambiguate the unit-test bullet "becomes observable
    only after the unchanged confirmatory scan" (design.md:1361-1363) so
    "unchanged" clearly refers to the candidate's prefix, not the whole file.
  - Requirement: FR2

### Medium

- **One-shot catch-up behavior during the stability wait is unspecified** (`design.md:118-124`, `design.md:676-679`)
  - Issue: Data Flow step 5 says "For an open turn, wait one configured
    stability/debounce interval and rescan," which reads naturally for a
    foreground watcher but is ambiguous for one-shot `catch-up` /
    `catch-up-then-watch` invocations: does the command sleep the interval
    inline, perform a single bounded rescan, or immediately return with
    `buffered.reason: 'stability-wait'` and defer to the next invocation? The
    accounting shape (`stability-wait`) suggests the latter, but no section
    states the per-command contract, exit code, or cursor behavior for a delta
    consisting only of stability candidates.
  - Fix: Add a sentence to the Data Flow or CLI Behavioral Contract section
    specifying each command's behavior: e.g., one-shot catch-up reports the
    candidate as `buffered`/`stability-wait` without waiting (exit 0, cursor
    not advanced past the candidate), while watch resolves stability across
    subsequent polls.

- **Null device/inode semantics for `TRANSCRIPT_REPLACED` are undefined** (`design.md:470-478`, `design.md:567-570`)
  - Issue: `TranscriptContinuityCheckpoint.device`/`inode` are nullable, and
    the continuity decision states "Any device/inode replacement, including the
    same path with an identical prefix, blocks as `TRANSCRIPT_REPLACED`." The
    design never says what happens when device/inode are `null` (platforms or
    filesystems where they are unavailable): null-to-null comparison silently
    passing would disable in-place replacement detection on those platforms
    without any stated downgrade of the guarantee.
  - Fix: Specify the comparison contract for null identity fields — e.g., when
    device/inode are unavailable, continuity falls back to prefix + size
    checks, replacement detection is explicitly weaker, and the support-matrix
    row for that platform records the reduced guarantee; or, alternatively,
    block stateful use. Add a test scenario for the null case.

- **Fate of non-final substantive records in a freshly caught-up completed turn is implicit** (`design.md:125-127`, `design.md:737-739`; spec FR2 criterion 3)
  - Issue: Data Flow step 6 and the projector decision say success "renders
    only the final substantive assistant record for a previously unseen
    completed turn." Spec FR2 requires that "Every structurally stable
    substantive source record in the consumed range is rendered or explicitly
    retained as recoverable." The recovery-pointer mechanism
    (`accounting.recovery.omittedAssistantEntries`) exists, but the design only
    invokes it for tail slicing (design.md:740-743); it never states that
    earlier substantive records inside a fresh completed turn receive recovery
    pointers when only the final record is rendered.
  - Fix: State explicitly in Data Flow step 6 or the projector decisions that
    non-final substantive records of a previously unseen completed turn are
    recorded in `recovery.omittedAssistantEntries` (frame pointers, no prose),
    so FR2's "rendered or explicitly retained as recoverable" clause is
    satisfied on the terminal-success path as well as the tail-slice path.

### Minor

- **Referenced types `LegacyCursorStateMarker` and `ContinuityFailureCode` are never defined** (`design.md:513`, `design.md:521`)
  - Issue: Both appear in the Continuity Guard interfaces but have no
    definition. `ContinuityFailureCode` values can be inferred from the Error
    Handling continuity list, but the marker shape (what identity/backup
    metadata it carries) is load-bearing for the migration plan and left to the
    implementer.
  - Suggestion: Add a minimal type sketch for `LegacyCursorStateMarker`
    (identity, backup pointer, migration status) and note that
    `ContinuityFailureCode` enumerates the Continuity Errors codes listed in
    Error Handling.

- **`createCursorTurnAccumulator` receives only `sessionId`, but `entryKey` is claimed to be scoped to exact transcript identity** (`design.md:350-353` vs `design.md:364-366`)
  - Issue: The entry-key scoping claim ("scoped to exact transcript identity")
    is broader than the accumulator's inputs (session id + start frame). This
    is probably fine because path binding is enforced upstream by the identity
    resolver and continuity guard, but the interface does not make the scoping
    claim self-evident.
  - Suggestion: Either state that session id is the identity scope embedded in
    keys (with path/continuity binding enforced by the guard), or pass the
    identity evidence into the accumulator.

- **Legacy-receiver envelope claim is asserted without grounding** (`design.md:846-852`)
  - Issue: "Old receivers may classify the envelope as automatic control but
    never use its range to mutate a cursor" is stated as fact. It is plausible
    (receivers treat wake envelopes as review requests, not cursor mutations),
    but the design does not say why a v1 receiver parsing a v2 envelope's
    `records` attribute under record-index assumptions is harmless.
  - Suggestion: Add one sentence grounding the claim in existing receiver
    behavior (ranges are advisory review pointers; cursor mutation happens only
    on the producer side under lease CAS), so the compatibility-window
    reasoning is reviewable.

## Requirements/Design Alignment

**Evidence sources used:** spec.md (requirements, priorities, verification
intents, constraints, assumptions), design.md (artifact under review),
discovery.md (background: chosen direction, decisions, out-of-scope). Plan.md
is scaffold-only (design phase current) and implementation.md is not yet
populated; neither was treated as evidence.

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| FR1 (exact identity) | covered | Exact Identity Resolver, evidence strength gates, identity error codes, symlink/canonicalization decisions; test row matches spec verification |
| FR2 (content-first observation) | covered — with defect I1 | Two-scan stability, entry keys, ordered delivery, recovery pointers, `pending-lifecycle` labeling; one contradictory stability formulation (Important finding) and one implicit recovery path (Medium finding) |
| FR3 (lifecycle reconciliation) | covered | Later Terminal Reconciliation flow, lifecycle events without prose repetition, non-success suppression + diagnostic, open turns never continuation-eligible |
| FR4 (fail-visible continuity) | covered | Continuity Guard, `ContinuityResult`, continuity error codes, explicit reset/replay, repaired-frame resume in test mapping; null device/inode edge unspecified (Medium finding) |
| FR5 (truthful activity/health) | covered | `ObservationStatus` independent facets with validation rules; additive defaults for existing consumers |
| FR6 (atomic idempotent accounting) | covered | Reserve/write/commit CAS, `PendingCursorDelivery`, delivery-uncertain keyed replay, ownership-before-observation, separate observation/completion cursors |
| FR7 (foreground watch) | covered | Baseline, debounce, buffered-vs-blocked health, ownership/cleanup, newer-candidate diagnostic; one-shot stability-wait ambiguity noted (Medium finding) |
| FR8 (collab completion contract) | covered | Completion projection, lease v6 with `peerIndexBase` + private checkpoint, envelope v2, v5 Cursor lease refusal, fail-closed checks, ship-without-promotion path |
| FR9 (evidence-gated coverage) | covered | `CursorCapabilityEvidence` row schema, five evidence labels, Markdown evidence table + fixtures, per-row live-probe requirement |
| FR10 (wake evaluation) | covered | Conditional Phase 6, tier distinctions, deterministic scheduled observer constraints, non-claim outcome explicitly acceptable |
| NFR1 (fail-closed authority) | covered | Root containment, realpath checks, synthetic-control non-authority, owner-local writes only |
| NFR2 (privacy-preserving evidence) | covered | No prose in state/logs/evidence, unhashed-digest non-disclosure, `0700`/`0600` modes, redacted probe records |
| NFR3 (backward compatibility) | covered | Isolated `cursor-state.json`, digest v1/v2 discriminated union, schema-dispatch completion selection, non-Cursor regression scope |
| NFR4 (dependency-free runtime) | covered | Canonical TS → generated `.mjs` build steps, build:check, skill-version bumps + `bump-version.mjs` entries, no new runtime deps |
| NFR5 (bounded resources) | covered | Stat-only unchanged polls, streaming single pass, bounded confirmatory scan, existing digest/watch/lease limits retained |
| NFR6 (reproducible verification) | covered | Requirement-to-Test Mapping matches spec Requirement Index row-for-row; planned verification file locations; live-probe artifacts named authoritative |

### Extra Work (not in declared requirements)

None found. Digest schema v2, lease v6, wake envelope v2, and the isolated
Cursor state store all trace to FR8/NFR3 compatibility requirements; the
Export Session Transcript projection default and permission tightening trace
to NFR3/NFR2. Non-goals (SQLite store, N>2, streaming retraction, background
LLM polling) are explicitly excluded or rejected in Alternatives.

### Readiness Assessment

The design is implementation-ready once the Important finding is resolved and
the design-phase user decisions are confirmed. The five Open Questions
(design.md:1570-1593) each carry a concrete recommendation and correctly
identify the content-availability boundary as "the primary user-review
decision"; they are decision points for design sign-off, not completeness
gaps. Phases 1–6 are ordered sensibly (correctness before live acceptance
before conditional wake work), interfaces are concrete enough to plan against,
and the migration/rollback plans handle the one intentional breaking change
(legacy Cursor offset refusal) fail-visibly.

## Verification Commands

Run these to spot-check the review's factual claims:

```bash
# The contradictory stability formulations (I1)
grep -n "same file signature, safe boundary" .oat/projects/shared/cursor-collaboration-reliability/design.md
grep -n "exact prefix still verifies" .oat/projects/shared/cursor-collaboration-reliability/design.md
grep -n "comparing it with the longer current-prefix hash" .oat/projects/shared/cursor-collaboration-reliability/design.md

# Undefined referenced types (m1)
grep -n "LegacyCursorStateMarker\|ContinuityFailureCode" .oat/projects/shared/cursor-collaboration-reliability/design.md

# Requirement-to-test mapping vs spec requirement index
grep -n "^| FR\|^| NFR" .oat/projects/shared/cursor-collaboration-reliability/spec.md
grep -n "^| FR\|^| NFR" .oat/projects/shared/cursor-collaboration-reliability/design.md
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into design
revisions before design sign-off. The Important finding (I1) should be fixed
before the user is asked to approve the content-availability boundary, since
the contradictory wording sits inside the exact decision being reviewed.
