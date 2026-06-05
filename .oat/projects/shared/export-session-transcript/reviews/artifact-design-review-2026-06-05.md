---
oat_generated: true
oat_generated_at: 2026-06-05
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/export-session-transcript
---

# Artifact Review: design

**Reviewed:** 2026-06-05
**Scope:** Lightweight design artifact for `export-session-transcript`
**Files reviewed:** 7
**Commits:** artifact review; no git range

## Review Scope

**Project:** `.oat/projects/shared/export-session-transcript`
**Type:** artifact
**Scope:** design
**Workflow mode:** quick

**Artifact Paths:**

- Discovery: `.oat/projects/shared/export-session-transcript/discovery.md`
- Design: `.oat/projects/shared/export-session-transcript/design.md`
- Plan: `.oat/projects/shared/export-session-transcript/plan.md`
- Implementation: `.oat/projects/shared/export-session-transcript/implementation.md`
- State: `.oat/projects/shared/export-session-transcript/state.md`

**Supporting Code/Tests Inspected:**

- `skills/session-observer/scripts/lib/runtimes.mjs`
- `tests/session-observer/runtimes.test.mjs`

## Summary

The lightweight design makes a coherent architecture decision: extract the drift-prone runtime adapter into a canonical core, sync committed copies into consumer skills, and keep installed skills self-contained. The main gap is that the design currently treats `normalizeEntries` as a complete sanitization boundary, but the existing adapter only guarantees structural tool/function filtering and Claude command-message filtering; it does not classify injected instruction/context payloads that arrive as normal text messages. There is also lifecycle artifact drift around the now-complete design state.

## Findings

### Critical

None

### Important

1. **The design relies on `normalizeEntries` for sanitization that it does not actually provide across runtimes.**

   Discovery requires the export to exclude system/developer instructions, environment-context payloads, AGENTS.md/skill payloads, and subagent notifications (`.oat/projects/shared/export-session-transcript/discovery.md:20`). The design says the exporter can reuse `normalizeEntries` as the sanitization engine and only additionally strip the marker line (`.oat/projects/shared/export-session-transcript/design.md:181`). In the current implementation, `normalizeEntries` filters tool calls/results and Claude command payloads, but Codex and Cursor message paths return any user/assistant text block as a normal message (`skills/session-observer/scripts/lib/runtimes.mjs:503`, `skills/session-observer/scripts/lib/runtimes.mjs:554`). The tests only assert that Codex function calls are excluded and that ordinary messages remain (`tests/session-observer/runtimes.test.mjs:465`). That leaves a direct path for injected context that is recorded as a user/assistant message to leak into the exported transcript.

   Fix guidance: make the design explicit that export owns a second sanitization layer after normalization, with detectors and fixtures for environment-context wrappers, AGENTS.md/SKILL.md payloads, system/developer instruction records if present, and subagent notification text for all three runtimes. Keep `normalizeEntries` as the structural adapter, not the whole privacy boundary.

### Medium

1. **Lifecycle artifacts disagree about the current phase and plan source.**

   `state.md` frontmatter reports `oat_phase: design` and `oat_phase_status: complete`, but the rendered body still says "Status: Discovery", marks discovery in progress, says design is N/A, and says the next milestone is to complete discovery (`.oat/projects/shared/export-session-transcript/state.md:14`, `.oat/projects/shared/export-session-transcript/state.md:34`). Separately, the scaffolded `plan.md` still declares `oat_plan_source: spec-driven` even though the project state and design are quick-mode, and the plan body is still placeholder text (`.oat/projects/shared/export-session-transcript/plan.md:10`, `.oat/projects/shared/export-session-transcript/plan.md:21`). This is artifact drift rather than a design flaw, but it can mislead the next lifecycle step or a human resuming the project.

   Fix guidance: refresh `state.md` body to match design-complete quick mode and regenerate/fill `plan.md` from the quick design before implementation.

### Minor

None

## Spec/Design Alignment

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| Export current session by default | partial | Marker-based selection is designed, with newest-for-cwd fallback. |
| Support `--session`, `--all`, runtime override, output override | designed | Covered in CLI interface and output path resolution. |
| Exclude hidden/tool/system/context payloads | partial | Tool and command filtering are supported by the shared adapter, but hidden/context payload filtering needs an explicit export sanitizer. |
| Reuse session-observer cross-provider knowledge without runtime coupling | designed | Canonical shared core plus vendored sync matches discovery. |
| Keep `session-observer` behavior stable | designed | Migration and regression test strategy are called out. |
| Pass `npm test` and `npm run validate` | designed | Test strategy includes drift guard, export CLI fixtures, frontmatter, and repo layout updates. |

### Extra Work (not in requirements)

None

## Verification Commands

- `oat project validate-plan --project-path .oat/projects/shared/export-session-transcript`
- Inspect `skills/session-observer/scripts/lib/runtimes.mjs` normalization paths for Claude Code, Codex, and Cursor.
- Inspect `tests/session-observer/runtimes.test.mjs` coverage for hidden-payload filtering.

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert the Important sanitization-boundary gap and Medium lifecycle drift into plan tasks before implementation.
