---
id: BL-261021-prepare-canonical-proposals
title: Prepare canonical proposals from accepted retrospective findings
status: open
priority: medium
scope: feature
scope_estimate: M
labels:
  - session-retro
  - author-skill
  - skills
assignee: null
created: 2026-10-21T12:50:14.435Z
updated: 2026-10-21T12:50:14.435Z
associated_issues: []
external_plans: []
---

## Description

Provisional implementation estimate approved for planning: **M**. The reviewed bounded first slice is sized **S**; that narrower sizing remains in the design rationale below. The provisional budget does not expand this item’s scope or authorize implementation, enablement or live acceptance.

After Retro ends, a user can accept a particular report-local finding and separately authorize `author-skill` to prepare a proposal for its canonical owner. Add stable finding IDs to the existing report template, emit an external SHA-256 receipt for the final report bytes, and add a short prose intake to `author-skill`. Ship those together as the smallest useful slice. Acceptance alone never grants implementation, installation, publication, memory-write or ledger-append authority.

Keep the existing observation/interpretation/proposal fields and canonical ownership rules. The handoff requires only the report, finding ID, external receipt and explicit follow-up scope/destination; it adds no structured transfer object, handle service or store. BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection remains the any-findings recurrence owner; this unit follows accepted findings into proposals. Publish its exact authority amendment with this unit while keeping ledger implementation optional.

Worked intake examples (synthetic, no session data):

1. **Accepted:** The user accepts `F-001` in final `report.md` and explicitly authorizes a proposal at a named destination for its canonical skill owner. The external receipt matches the report bytes and the current owner still has the reported gap. `author-skill` prepares only that scoped proposal, retaining the digest/finding ID in authorized private context. It does not edit or install the skill.
2. **Stale:** The report was edited after the external receipt was issued. Digest verification fails; no proposal is saved until a new receipt and renewed acceptance identify the changed report. If the receipt still matches but the current owner baseline changed materially, request revalidation of the finding before preparing a proposal. Neither case silently reuses the old approval.
3. **No change:** The receipt and accepted `F-001` match, and the user authorizes the same scoped proposal preparation, but the current owner already addresses the gap. Return `no change` with the current-base rationale. Do not invent a patch or append a ledger entry.

## Acceptance Criteria

- Add stable report-local finding IDs such as `F-001` to the existing Improvement candidates template without replacing Observed evidence, Interpretation, Likely cause, Owner, Proposed change or Validation. Never silently renumber or reuse an ID within the finalized report revision.
- After final rendering, compute SHA-256 over the exact final UTF-8 report bytes and emit an external receipt in the response or at an explicitly authorized companion destination. When saving is authorized, hash the final saved file rather than a pre-save rendering. The report never contains its own digest. Verifiable later intake expects a report saved at an authorized destination. A response-only receipt is valid only for byte-exact same-session intake; otherwise follow the Stale case. Any byte change requires a new receipt and renewed acceptance of the changed report; a receipt identifies bytes, not authenticity or approval.
- Add explicit prose intake to `author-skill`: accept report + finding ID + external receipt + user-authorized follow-up scope/destination; verify the digest and exact finding, preserve evidence limits, confirm canonical owner, and check the current owner baseline and existing proposals before producing a minimal sanitized proposal, requesting revalidation, or concluding `no change`.
- Retro stays read-only apart from its explicitly authorized report output; an external companion receipt also requires an authorized destination. Intake begins only after Retro ends and is separately explicitly authorized. Acceptance, a receipt, a configured path, recurrence or configuration alone never permits a skill edit, install, publication, memory write or ledger append. Missing destination authority permits a read-only response only.
- Private proposal context may retain the report digest/finding ID and existing authorized evidence references. Public rationale uses redacted evidence and canonical repo-relative owner paths, with no private native identities, host paths, raw payloads, invented opaque-handle service or copied session instructions. Unknown historical revision remains unknown.
- Reconcile BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection using its exact companion amendment: only a separately explicitly authorized post-retro intake may append; Retro never appends and configuration alone never grants permission. The ledger records any finding and evidence limits for recurrence; this unit processes only accepted findings and needs no ledger implementation.
- Manually work three cases in the authoring guidance: an unchanged accepted `F-001` whose current owner still has the gap yields a bounded proposal; changed report bytes fail receipt verification and a changed owner baseline requires revalidation; a finding already addressed on the current baseline yields `no change`. Each case states scope/destination authority and permitted output. Do not add instruction snapshots or speculative concurrency/store tests.
- Follow canonical `session-retro` and `author-skill` version, generated-output and changelog rules when implementing this prose/template slice. No `AcceptedFindingRef`, transfer persistence, private handle store, dedup/concurrency machinery, automatic authoring trigger or installed-skill modification is introduced.

## Dependencies

- Existing session-retro report/follow-through and author-skill canonical authoring contracts; ship finding IDs, external final-byte receipt and author intake together.
- Publish the exact BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection authority amendment with this unit; implementing that ledger is not required.
- Native response evidence and frozen activity views are optional evidence/navigation aids. No dependency on BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency, Beacon installation or another repository shipping.
