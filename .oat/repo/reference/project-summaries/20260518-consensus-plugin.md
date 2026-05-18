---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-05-05
oat_generated: true
oat_summary_last_task: p07-t02
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: consensus-plugin

## Overview

This project built v0.1 of the `consensus` plugin for this skills repository. The goal was to reduce manual shuttling between Claude and Codex by providing a portable `consensus-refine` skill that can drive structured peer deliberation, preserve an audit trail, and work across supported agent hosts.

The implemented scope is intentionally narrow: one production-ready refinement skill, local/Git distribution support, and enough release validation to prepare for a cautious private or Git-based v0.1 release.

## What Was Implemented

- A self-contained plugin package under `plugins/consensus`, with standalone top-level `skills/`, provider manifests, repo-root marketplace entries, baseline documentation, a structural validator, and CI workflows.
- The `consensus-refine` wrapper and `consensus-loop.mjs` core, including alternating peer turns, structured verdict parsing, byte caps, normalized content hashing, convergence/oscillation/max-round status, write-through records, JSONL progress, path confinement, and atomic artifact writes.
- Sequential section orchestration as the default execution model, including markdown section parsing, per-section peer refinement, canonical deliberation artifacts, and fail-on-section-error aggregation.
- Host-mediated parallel section orchestration as an opt-in mode, including prepare manifests, per-section packets, host dispatch instructions, fan-in assembly, original-order preservation, default output-domain safety, and simulated integration coverage.
- Resume and recovery behavior, including artifact parsing, corrupt-artifact fail-closed handling, user intervention resume, completed-section output preservation, artifact-authoritative section inventory, skip controls, and agency-aware resume hash validation.
- Release and distribution support, including Paseo preflight/install assist, semver-aware validation, version bump and tag checks, smoke testing, release workflow scaffolding, and refreshed release-readiness documentation.
- Final review fixes for completed resume output, version validation, artifact frontmatter, release readiness evidence, resume inventory, minimal-agency hash validation, test count documentation, and host metadata in frontmatter and resolution JSON.

The final code review passed after Phase 7. The final verification set included `node --test tests/sequential-wrapper.test.mjs`, `npm test` with 124 passing tests, structural validation, smoke testing, version bump tag validation, and a focused git diff check.

## Key Decisions

- Package the work as a self-contained `plugins/consensus` plugin instead of a repo-level one-off skill, so future consensus skills can share distribution structure without coupling to OAT scaffolding.
- Keep peer execution as a Paseo shell-out rather than embedding Paseo internals, preserving license separation and keeping the runtime boundary simple.
- Make sequential execution the default and keep parallel execution host-mediated. The wrapper prepares section work and fans results in, while the host is responsible for actual parallel agent dispatch.
- Treat deliberation artifacts as the durable resume source. Resume logic reads canonical artifact containers and fails closed on corruption instead of reconstructing state from loose output.
- Use Agent Skills-compatible frontmatter as the baseline and provider-specific manifests for host-specific metadata where fields conflict.
- Support Cursor as a host install target, but do not make Cursor a default peer in v0.1 because custom ACP peer behavior still needs dedicated documentation and dogfooding.

## Notable Challenges

- Early review exposed drift between design intent and implementation around verdict shape, record/status schemas, byte caps, and path confinement. Phase 2 review tasks tightened fail-on-section-error semantics, canonical artifact containers, and Paseo remediation guidance.
- Parallel fan-in needed extra safety around output paths and default output domains. Phase 3 fixes made fan-in preserve original ordering while keeping writes inside the expected output area.
- Resume behavior required several rounds of hardening. Fixes covered max-rounds continuation after user direction, completed-section preservation, artifact-authoritative section inventory, and agency-aware hash validation so minimal-agency resumes do not falsely reject valid artifacts.
- Release readiness evidence drifted during the review/fix loop. Later phases refreshed version-aware validation, documented the current 124-test count, and aligned host metadata across artifact frontmatter and resolution JSON.

## Tradeoffs Made

- The implementation stays on Node ESM and built-in modules with no build step. That keeps installation and validation simple, at the cost of some local duplication until a second skill proves out shared loop abstractions.
- Paseo installation is assisted but not automatic. Users get explicit remediation through the repo script, while the wrapper avoids mutating host environments without direction.
- Parallel mode can reduce wall-clock time for multi-section documents, but it does not reduce peer-model spend and depends on host orchestration quality. Sequential mode remains the stable default.
- Public distribution is limited to Git/local plugin paths for v0.1. The project does not claim public Codex marketplace or public skills.sh availability until those external paths are verified.
- Runtime observability is file-based rather than telemetry-based: artifacts, status JSON, JSONL progress, and release evidence carry the operational trace.

## Integration Notes

- Published plugin behavior must not depend on `.oat` or `.agents` project scaffolding. Distribution-facing files live in `plugins/consensus`, top-level `skills/`, root marketplace entries, and repo docs.
- Useful maintenance commands are `npm test`, `npm run validate`, `npm run smoke`, `node scripts/bump-version.mjs --version <version> --check-tag`, and `node scripts/install-paseo.mjs`.
- `RELEASING.md` remains the gate before a v0.1 tag. Manual provider runtime install and permission smoke checks for Claude, Cursor, Codex, and Agent Skills must be completed before release claims are broadened.
- Deliberation artifacts now include host metadata in both frontmatter and resolution JSON. Future resume-schema changes should either migrate explicitly or fail closed.

## Follow-up Items

- Complete the manual provider runtime install and permission checks in `RELEASING.md` before tagging v0.1.
- Verify `npx skills add <username>/skills` against the published or release-candidate repository before claiming skills.sh install support.
- Re-check the Codex public Plugin Directory path before any public launch language.
- Future consensus work remains deferred: skills 2-6, parallel-revision and parallel-synthesized modes, whole-document harmonization, shared loop extraction, summary-context sequential mode, and Cursor custom ACP peer documentation.
