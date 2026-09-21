---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-20
oat_generated: true
oat_summary_last_task: p04-t01
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: session-evidence-followups

## Overview

This quick project delivered six approved session-evidence backlog items plus the user-requested 15-minute Consensus Review default in PR #99. It strengthens watcher reliability, native activity provenance, complete exact-session export, and evidence-backed retrospectives while preserving the ordinary compact observation and export defaults.

All seven tasks and 29 mapped ticket criteria are complete. The full independent integration review passed with zero Critical, High, or Medium findings; its three Low observations were dispositioned, and the accepted instruction follow-up passed a focused review with zero findings. PR #99 is ready for review and unmerged.

## What Was Implemented

- **Review runtime:** Consensus Review uses a 900-second default while preserving its explicit timeout control and documenting host execution budgets. The canonical skill is `consensus-review` 0.1.17.
- **Watcher reliability and terminal evidence:** Session Observer's SIGTERM re-arm test waits for observed readiness and delta conditions. Observer emits at-most-once, metadata-only unsuccessful terminal events for supported Claude Code, Codex, and Cursor carriers without granting peer-message or continuation authority.
- **Skill and usage provenance:** Shared activity captures native Claude attribution and invocation carriers plus narrow inferred Codex/Cursor direct `SKILL.md` reads. Claude deduplication, Codex cumulative, per-turn, and response samples, ownership and reset boundaries, models, extraction failure, and Cursor `not-recorded` remain distinct; no price or cost is inferred.
- **Paired exact-session export:** `session-export-transcript --activity-output` writes a sanitized narrative and complete sensitive activity JSON from one captured native snapshot. It records exact identity evidence, stable locators, coverage, diagnostics, and bounded previews; destination and Observer-state aliases fail closed and JSON replacement is atomic.
- **Frozen-evidence Retro:** `session-retro` requires Session Export Transcript, a known different reviewing session, and one frozen narrative/activity pair. Reports preserve all seven coverage states and native-origin limits while separating observation, interpretation, and proposal.
- **Distribution and documentation closure:** Canonical sources, standalone/plugin payloads, required workflow declarations, user and engineering guides, changelog entries, and version fan-out agree. Final versions are Exporter 2.0.34, Fork 0.2.48, Observer 1.0.81, Collaborative Observer 1.0.69, Retro 1.0.2, and Review 0.1.17.

## Key Decisions

- **Retrospectives use frozen evidence.** Live session reads can drift and mix later evidence into the reviewed episode. A retrospective therefore runs from a different known native session, freezes one exact target into paired narrative and activity files, and grounds findings only in that pair. This makes findings reproducible while excluding later live context from the episode's evidence.
- **Preserve native activity semantics.** Providers record different identity, origin, skill, usage, outcome, and coverage carriers. Normalization retains native semantics, locators, ownership and reset boundaries, and unknown states; it does not infer totals, prices, versions, human origin, or causality without evidence. Consumers carry more explicit uncertainty instead of converting partial evidence into false claims.
- **Opt-in complete activity export.** Compact Observer and narrative defaults intentionally omit detail, while retrospectives need every supported invocation from one snapshot. Complete activity is exposed only through explicit `--activity-output` as sensitive JSON paired with the narrative, with bounded previews and unchanged ordinary defaults. This provides complete captured activity without turning default output into a large analytics stream.

## Design Deltas

- Plan review added p00 when the user requested a 600-to-900-second Review default.
- The branch merged upstream PRs #100 and #101, retaining their Draft-07 schemas and `--timeout-sec` behavior while preserving branch guidance. This was reconciliation with main, not a merge of PR #99.
- Review follow-ups replaced a drifting Observer-state filename allowlist with direct ordinary-file inode checks in the two established roots, distinguished usage extraction failure from runtime `not-recorded`, documented the narrative invocation index, and made Retro's exporter identity/install preflight explicit.
- One stale installed-package assertion was corrected through append-only phase recovery; no product behavior changed in that recovery.

## Notable Challenges

- Generated bundles exceeded the review wrapper's whole-file snapshot cap. Phase and final reviews used immutable bounded packets while build freshness and version gates covered generated outputs.
- Early phase reviews found material provenance and ownership defects. They were corrected through bounded fix rounds, then verified independently before later phases consumed the contracts.
- One p04 reply and the first final-integration reply were internally contradictory and rejected as invalid. Both remain diagnostic evidence only; valid later reviews supply the accepted verdicts.

## Tradeoffs Made

- JSON was chosen for the first complete activity artifact; no stream protocol, generic findings ledger, pricing system, or compatibility layer was added.
- Complete capture removes report and invocation eviction only for the explicit activity artifact. Individual previews remain bounded and coverage and omissions stay visible.
- Destination protection covers direct ordinary files in the effective and fixed-default Observer roots. It does not recursively inspect arbitrary trees or claim protection for relocated collaboration state.
- Retro remains instruction-only and read-only. Synthetic Claude/Cursor exercises and static Codex origin checks verify the documented boundaries without adding a runtime evaluator or prose snapshot suite.

## Integration Notes

- The authoritative suite passed 2,521 tests with one expected opt-in live-provider test skipped across 171 files. Type-check, build freshness, validation, smoke, version validation, scoped lint/format, documentation production, and diagram inspection also passed.
- Full final Consensus review `a0d67b6b-d460-42c9-b1a6-5d7c6da06367` passed with zero Critical, High, or Medium findings and three Low observations. L1 was declined after source inspection, L2 was implemented, and L3 corrected an immutable-packet prose count. Focused review `a701868f-1450-498a-9c95-fc6fbdd4c23c` passed the L2 closure with zero findings at `8c65be6c`.
- PR #99 is the single delivery PR. It is ready for review and unmerged; no release, global install, provider-cache refresh, or broad live-provider acceptance occurred.
- Existing repository decisions continue to govern observation authority, identity, sanitization, generated targets, explicit installation, and capability claims: [metadata-only watch events](../../../repo/reference/decisions/DR-260603-watch-event-logs-are-metadata.md), [exact identity for stateful work](../../../repo/reference/decisions/DR-260724-stateful-work-requires-exact.md), [separate observation authority](../../../repo/reference/decisions/DR-260724-separate-observation.md), [two-layer export sanitization](../../../repo/reference/decisions/DR-260605-export-sanitization-is-two.md), [canonical TypeScript generation](../../../repo/reference/decisions/DR-260615-canonical-typescript-sources.md), [declared skill distributions](../../../repo/reference/decisions/DR-260914-declared-skill-distributions.md), and [evidence-gated capability claims](../../../repo/reference/decisions/DR-260724-gate-capability-claims.md). Required workflow identities are declared through those generated targets and are never installed implicitly.

## Autonomous Execution Learnings

### Agent-instruction updates

- Keep availability, invocation, identity, origin, and usage semantics separate, preserving ambiguity rather than strengthening claims from names or prose. Source: [`2026-09-20 — Native evidence carriers`](oat-execution-learnings.md#2026-09-20).
- State Consensus reply-shape constraints in review requests so verdicts, findings, checks, and external anchors remain mutually valid. Source: [`2026-09-20 — Consensus reply format`](oat-execution-learnings.md#2026-09-20).

### Workflow issues

- Keep one approved wave in one canonical plan and avoid duplicate review routes after an exact reviewer workflow is selected. Source: [`2026-09-20 — One canonical plan and review route`](oat-execution-learnings.md#2026-09-20).
- When a scoped commit reports `index.lock`, inspect ownership and retry after the transient lock clears; never delete the lock blindly. Source: [`2026-09-20 — Transient index lock`](oat-execution-learnings.md#2026-09-20).

## Follow-up Items

- Preserve the acceptance limits: the opt-in live-provider test remains skipped, Retro fixtures cover Claude and Cursor rather than every runtime/state combination, and complete capture means every supported invocation in captured bytes rather than proof that the provider recorded every action or that the session ended.

## Associated Issues

- `BL-260919-stabilize-the-watcher-sigterm`
- `BL-260919-surface-terminally`
- `BL-260919-skill-attribution-in-session`
- `BL-260919-token-and-usage-accounting`
- `BL-260919-uncapped-structured-activity`
- `BL-260919-session-retro-consume-activity`

## Workflow Observations

### 2026-09-20 · structural · oat-project-implement · p00

p00 passed independent Consensus review 8c84e955-3f2e-4817-afd8-a7d08531875b; nonblocking docs follow-up accepted, zero blocking fix rounds; see implementation.md.

### 2026-09-20 · structural · oat-project-implement · p01

p01 passed full and bounded independent Opus reviews; one nonblocking fix round plus docs clarification; review c47f8d9e-a43b-48e3-b790-fdf445abf041, evidence in implementation.md.

### 2026-09-20 · structural · oat-project-implement · p02

evidence-p02-outcome-20260920: two Sol task commits verified; phase checks and self-review pass, independent Opus review pending; see implementation.md.

### 2026-09-20 · structural · oat-project-implement · p02-fix1

evidence-p02-fix1-outcome-20260920: six accepted findings fixed by same Sol handle; self-review and checks pass, independent verification pending; see implementation.md.

### 2026-09-20 · structural · oat-project-implement · p02-complete

evidence-p02-complete-20260920: phase complete with independent pass and all follow-ups implemented; two review-fix rounds, no recovery; p03 review includes final Low delta.

### 2026-09-21 · structural · oat-project-implement · p03

evidence-p03-implementation-outcome-20260920: Sol/high completed p03-t01 in190e5a51; full2499-test suite and phase checks passed, recovery0, independent review pending; see implementation.md.

### 2026-09-21 · structural · oat-project-implement · main-integration

evidence-main-integration-20260921: merged main4150cfe2 in14b7bd1e retaining PR100/101 and host polling guidance;75 focused tests, types, build/validate/version gates pass; canonical review runner replaces temporary shim.

### 2026-09-21 · structural · oat-project-implement · p03-outcome

evidence-p03-final-outcome-20260921: p03 Opus pass and all Low follow-ups implemented in fad824d7;135 focused tests and phase gates pass;fixround1,recovery0; p04 review includes narrow follow-up delta.

### 2026-09-21 · structural · oat-project-implement · p04

evidence-p04-implementation-outcome-20260921: Sol/medium completed p04-t01 in c97f65db; frozen fixture acceptance and phase gates pass, recovery0; independent review and final integration pending.

### 2026-09-21 · structural · oat-project-implement · p04

evidence-p04-invalid-20260921: Consensus reply defective, no pass; stable diagnostic evidence/p04-review-diagnostic.json retained. Independent final suite found stale packaging assertion; same-target p04 recovery and valid corrected-scope review remain required.

### 2026-09-21 · structural · oat-project-implement · p04

evidence-p04-recovered-20260921: same-target recovery f3dea62b verified, attempt1/10 preserved and pending marker settled; packaging41/41, freshness/types/lint pass. Corrected-scope review remains pending.

### 2026-09-21 · structural · oat-project-implement · p04

evidence-p04-pass-20260921: valid Opus pass0Critical/High,2Medium/3Low accepted; canonical reviews/archived/p04-opus-review.md. Sequential original-target p03 guard and p04 docs follow-ups precede final integration review.

### 2026-09-21 · structural · oat-project-implement · p03

evidence-p03-fix2-done-20260921: L2 fixed in0ca7ad65 by originalSolhigh; exporter97/97 and gates passed, exporter2.0.32/fork0.2.46 dependency closure. Review-fix2/2, recovery0; final review remains.

### 2026-09-21 · structural · oat-project-implement · p04

evidence-p04-terminal-20260921: all accepted findings fixed8ac3ba9e and0ca7ad65; p04 proof/gates pass, visual evidence/p04-visual/receipt.md. All7tasks/phases complete; final review next.

## Explainer Outcome

[Project recap](explainers/project-recap/site/index.html) recorded outcome **built**, run `c9dfb65f-e1a3-4a09-9394-f8503f89d67f`. All seven static checks and inspected Chrome captures at 320, 768 and 1440 pixels passed. The immutable package captures the approved inputs at 14390681, before this outcome section and later PR closeout metadata; it is a historical snapshot, not a claim of current source-hash freshness.
