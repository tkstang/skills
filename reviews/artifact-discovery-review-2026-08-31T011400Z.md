---
oat_generated: true
oat_generated_at: 2026-08-31T01:14:00Z
oat_review_scope: discovery
oat_review_type: artifact
oat_review_invocation: auto
oat_project: /Users/thomas.stang/.codex/worktrees/d7d8/skills/.oat/projects/synced/coding-session-handoff
---

# Artifact Review: discovery

**Reviewed:** 2026-08-31T01:14:00Z
**Scope:** Committed `discovery.md` baseline at `640026ccb4263686adc28eefecb0593f476111cf`
**Files reviewed:** 6
**Commits:** `640026ccb4263686adc28eefecb0593f476111cf`

## Summary

The discovery preserves the authoritative product boundary: one public Codex-and-Claude skill, exact-source explicit selection, direct-only current identity, fail-closed same-ID writer safety, existing-target Git validation, provider-native mutation, truthful deferral, itemized outcomes, no registry, and local-only delivery. It is not ready to advance unchanged because the zero-write discovery contract omits the existing Codex cwd cache and the cross-directory execution promise is not explicitly gated on evidence beyond CLI help.

Findings: 0 critical, 2 important, 0 medium, 0 minor

## Findings

### Critical

None

### Important

- **The read-only discovery requirement does not cover the Codex cwd cache** (`.oat/projects/synced/coding-session-handoff/discovery.md:116`)
  - Issue: The discovery promises that previewing will not advance observer offsets or persist transcript content, and it treats provider stores as immutable, but it never says candidate enumeration must not write transcript-discovery caches. That omission matters in the current repository: `discover('codex', ...)` loads and populates `codex-cwd-cache.json` on cache misses, then calls `saveCwdCache` (`src/transcript/session-observer/lib/locate.ts:694`, `src/transcript/session-observer/lib/locate.ts:705`, `src/transcript/session-observer/lib/locate.ts:744`, `src/transcript/session-observer/lib/locate.ts:766`). Reusing that public discovery entry point directly would violate the authoritative zero-write kickoff requirement even though no transcript or provider store is modified.
  - Fix: Add an explicit decision, constraint, and success criterion that enumeration, preview, comparison, and plan mode write neither observer state nor transcript-discovery caches (including `codex-cwd-cache.json`). Require design to use or introduce a mutation-free discovery seam and to verify it with a temporary empty state directory whose contents remain unchanged.

- **Cross-directory native execution is not explicitly evidence-gated** (`.oat/projects/synced/coding-session-handoff/discovery.md:142`)
  - Issue: Current help verifies command shape only: Codex 0.151.0 accepts an exact UUID and `-C` for both `fork` and `resume`; Claude Code 2.1.251 accepts `--resume` and `--fork-session`, but exposes no target-directory flag, so target placement is inferred from the launch cwd. Help does not prove the persisted child cwd, resulting identity, source resumability, or metadata behavior. The discovery acknowledges capability drift and a reconciliation question, yet its success criteria only require generic “cross-provider installation compatibility” and do not say that immediate native execution remains unavailable until target-cwd semantics are observed. That can turn an unverified inference into a v1 support promise.
  - Fix: State that CLI probes authorize only the exact syntax they report. Add a design-time/implementation gate for disposable two-worktree verification of each proposed Codex and Claude operation, recording parent/child IDs, runtime cwd, source resumability, and metadata effects. If that gate cannot be run or does not establish the contract, require the affected operation to remain `plan`/deferred and label its execution semantics unverified rather than claiming success.

### Medium

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** committed `discovery.md`; coordinator-supplied authoritative requirements ledger; referenced ADE handoff packet; installed Codex 0.151.0 and Claude Code 2.1.251 help; `src/transcript/session-observer/lib/locate.ts`; `src/transcript/export-session/sanitize.ts`; `src/transcript/export-session/export-session-transcript.ts`.

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| Public standalone skill, repository deliverables, and v1 provider floor | covered | Codex and Claude Code are the floor; Cursor and Orc changes remain out of scope; local-only closeout is explicit. |
| Exact-source discovery, explicit one/many/all selection, and direct-only current identity | covered | Recency is diagnostic only, provider-qualified IDs are required, and current identity requires direct evidence. |
| Bounded sanitized preview with no observer/cache mutation | partial | Sanitization and observer-offset safety are explicit, but the existing Codex discovery-cache write is not covered. |
| Existing target and Git safety | covered | Same intended repository, branch/commit/dirty evidence, no worktree or Git-state transfer, and distinct-dirty-source refusal are preserved. |
| Successor/resume/plan semantics and one-writer safety | covered | Successor is the default; same-ID resume requires real proof and unknown/concurrent writers are refused. Activity mtime is explicitly not proof. |
| Native provider capability and truthful cross-directory execution | partial | Help/version probing and deferral are present, but execution semantics lack an explicit observation gate and fallback-to-plan rule. |
| Batch confirmation, native/reporting outcome separation, and retry boundary | covered | The artifact distinguishes deferred from native success, itemizes mixed outcomes, and permits retry only for failed/deferred items. The exact state model appropriately belongs in design. |
| No persistence, transcript/store mutation, bypass flags, cross-host sync, or remote delivery actions | covered | The exclusions and privacy/scope boundaries match the kickoff. |

### Extra Work (not in declared requirements)

None

## Verification Commands

Run these after revising the discovery artifact:

```bash
git diff --check -- .oat/projects/synced/coding-session-handoff/discovery.md
rg -n "codex-cwd-cache|discovery cache|design-time gate|unverified|target cwd|source resum" .oat/projects/synced/coding-session-handoff/discovery.md
codex fork --help
codex resume --help
claude --help
```

The help commands verify syntax only; they do not satisfy the required cross-directory behavioral gate.

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert the two findings into discovery fixes, then re-review before completing the discovery HiLL checkpoint.
