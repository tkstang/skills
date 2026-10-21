---
id: BL-261021-record-qualified-native-skill
title: Record qualified native skill-response content evidence
status: open
priority: medium
scope: feature
scope_estimate: L
labels:
  - session-export-transcript
  - session-retro
  - transcript-core
assignee: null
created: 2026-10-21T12:50:14.221Z
updated: 2026-10-21T12:50:14.221Z
associated_issues: []
external_plans: []
---

## Description

Provisional implementation estimate approved for planning: **L**. The reviewed bounded first slice is sized **M, conditional on carrier qualification**; that narrower sizing remains in the design rationale below. The provisional budget does not expand this item’s scope or authorize implementation, enablement or live acceptance.

An operator reviewing a skill read needs to know which response content was recorded, without treating today's source as the executed revision. Extend the existing export/frozen-capture/Retro path with a digest of a qualified native response. Start with the demonstrated historical Codex structured `read_file`/`file_path` and correlated string `function_call_output.payload.output` carriers. Qualify the combined carrier with a sanitized per-runtime/version fixture before claiming support; source inspection alone does not prove complete skill-body capture. Claude Code body injection is unverified and is not a dependency; the current Cursor surface has no recorded results for this path.

The smallest useful slice qualifies one Codex carrier, computes the response digest from decoded export records before preview clipping, freezes it with existing skill/resource references and locators, and renders its basis/status/limits in Retro. The domain is recorded UTF-8 response bytes after documented extraction, never raw file bytes or executed revision. Defer file/config collectors and larger observation schemas. Reconsider a collector only when a documented runtime lacks a usable native carrier and a concrete retrospective needs that missing evidence.

## Acceptance Criteria

- Qualification runs first. If no runtime version that a concrete retrospective needs emits the structured carrier, record the gap and stop: no extraction, envelope bump or render. Support limited to historical versions requires a named retrospective need. Shell-command reads remain unattributed and never receive a skill digest.
- When qualification succeeds, one vertical slice supports the Codex structured skill-read plus string response carrier, exports its digest into the versioned frozen capture, and renders its basis/status/limits in Retro. Per-runtime/version qualification records the supported carrier, exact association and completeness/decorations; additional runtimes remain unsupported or unavailable until separately qualified. No Claude Code loaded-body assumption is required.
- For the qualified Codex string carrier, extraction takes the JSON-decoded native `payload.output` string and encodes it as UTF-8 without trimming, newline or Unicode normalization, wrapper stripping, line-number removal or redaction. The digest is SHA-256 of exactly those recorded response bytes before activity preview clipping. Malformed encoding or unsupported shapes yield an unavailable diagnostic; the extraction rule is documented with the envelope contract.
- Add only `evidenceBasis: native-recorded-content`, `status`, and optional algorithm-tagged `digest` (`sha256:<64 lowercase hex>`) to the existing skill/resource evidence and event/result locators. Status distinguishes a qualified recorded response, partial, unknown and unavailable evidence, independently of the seven unchanged activity coverage states. Envelope versions identify this extraction contract; no observation registry or separate phase schema is introduced.
- Truncation, range limits, native decoration or uncertain completeness keep the skill-content claim partial or unknown even when the exact response digest is available. Ambiguous call/resource association never attaches a digest to a skill. Preserve native identity, event keys, locators, correlation evidence and existing diagnostics; do not infer success from unrelated item outcomes.
- No digest is represented as proof of raw file identity, executed skill/runtime/supporting-resource revision, model consumption, compliance or causality. Current files, Git timestamps, catalog names and heartbeat inventory are comparison context only. Historical frozen captures are not backfilled through live-file or native-store reads; a preview-only artifact cannot supply missing response evidence.
- BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency is the concrete optional consumer: use qualified recorded response evidence where available in its version assessment, distinguish declared SemVer/Git comparisons, and retain inference or unknown labels elsewhere. This unit can render evidence in existing Retro without waiting for that assessment feature.
- Evidence inherits the private frozen-pair/report lifetime and authorized output destinations; do not duplicate response bodies, publish private identities/digests by default, install hooks, scan configs, or add a Beacon/runtime service dependency. File/config collectors, confinement/symlink machinery and supporting-resource manifests are deferred beyond this unit.
- Future automated coverage targets the export/extraction boundary with an independently known UTF-8 digest, partial/decorated response cases, ambiguous association and unsupported carrier/envelope shapes. Reuse existing exporter/extraction coverage for pair writes and generic parsing. Follow canonical version, generated-output and changelog requirements for the affected owners.

## Dependencies

- Existing structured activity extraction, exact correlation and frozen narrative/activity capture are the foundation; qualify one carrier and version the envelope before emitting this new evidence.
- BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency is a soft consumer, not a prerequisite or duplicate assessment project.
- No dependency on frozen activity views, a findings ledger, Beacon installation or another repository shipping.
