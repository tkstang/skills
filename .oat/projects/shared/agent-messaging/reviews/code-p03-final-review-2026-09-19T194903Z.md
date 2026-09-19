---
oat_generated: true
oat_generated_at: 2026-09-19T19:49:03Z
oat_review_scope: p03
oat_review_type: code
oat_review_invocation: subagent
oat_project: .oat/projects/shared/agent-messaging
oat_review_head_sha: d1b3fe166adc76e3be78bfb1a21c7ee8adfd7c8c
---

# Code Review: p03 Final Re-review

**Reviewed:** 2026-09-19T19:49:03Z
**Scope:** Complete Phase 3 contract after fix rounds 1 and 2, including every prior finding and both deferred Phase 2 corrections
**Files reviewed:** 72
**Commits:** `254e190e081fc7af07931bc5b118b1d80643065d..d1b3fe166adc76e3be78bfb1a21c7ee8adfd7c8c` (10 commits)

## Summary

Phase 3 passes this final configured review cycle. The round-two controller
race is fixed at every standalone Stop and foreground-watch ownership boundary:
initial, post-wait/final, claim-finalization, retry, and pre-output checks are
bound to the activation's immutable controller, while complete schema-v6
observer ownership appearing after activation produces no host output and
leaves the activation and non-reusable claims truthful. The four round-one
findings, both deferred Phase 2 findings, the complete Phase 3 composition and
shared-log contract, generated parity, versions, changelog, and conservative
live-evidence labels also remain resolved.

Findings: 0 critical, 0 important, 0 medium, 0 minor

Reviewer-local reconnaissance was not attempted. The final fix was narrowly
localized, and the primary reviewer directly re-opened the complete authoritative
range, artifacts, canonical source, tests, generated forms, and release surfaces.

## Findings

### Critical

None.

### Important

None.

### Medium

None.

### Minor

None.

## Prior Finding Disposition

| Prior finding                                                    | Disposition | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical observer bundles accepted as composition-capable      | Fixed       | The installer publishes a versioned SHA-256 content-bound capability (`src/skills/session-observer-collab/src/lib/codex-install.mjs:18-75`), inventory verifies that exact capability and installed bytes (`src/skills/agent-messaging/src/registration.ts:129-183`), and legacy/content-drift fixtures pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Registration could switch away from the active epoch controller  | Fixed       | Registration requires the exact active collaboration/session/worktree and supplies `requestedController: activation.controller` before deciding whether to delegate or install (`src/skills/agent-messaging/src/agent-messaging.ts:681-748`); lease-arm and lease-disarm races pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Public-cursor proof used an unrelated file                       | Fixed       | The composition fixture seeds and reads the observer's real public `STATE_DIR/state.json`, independently preserves the private lease, and verifies presentation plus acknowledgment leave both unchanged (`src/skills/session-observer-collab/src/messaging-composition.test.ts:470-538`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Changelog blurred fixture and live acceptance                    | Fixed       | The release note says `fixture-tested, composition-capable` (`CHANGELOG.md:7-11`), while the canonical matrix keeps installation, trust, invocation, recipient context, continuation, and cleanup unverified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Standalone boundaries accepted newly appeared observer ownership | Fixed       | Stop initial/final/claim-final/pre-output ownership checks all request and compare the immutable controller (`src/skills/agent-messaging/src/hooks/common.ts:138-152`, `src/skills/agent-messaging/src/hooks/common.ts:203-217`, `src/skills/agent-messaging/src/hooks/common.ts:225-285`). Foreground watch uses the same controller-bound helper at initial, claim-final, and pre-output checks (`src/skills/agent-messaging/src/watch.ts:105-141`, `src/skills/agent-messaging/src/watch.ts:214-243`). A regular retry re-enters the same Stop boundary path. Real complete schema-v6 lease/bundle races assert zero output, one spent finite slot, outcome-unknown state, and the unchanged active standalone epoch (`src/skills/agent-messaging/src/hooks.test.ts:418-455`, `src/skills/agent-messaging/src/watch.test.ts:429-476`). |

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md`, `design.md`, `plan.md`,
`implementation.md`, both prior Phase 3 review artifacts, repository/source/docs
instruction contracts, the authoritative Git range, canonical runtime and tests,
generated standalone/plugin payloads, documentation, changelog, and release
guidance. Quick mode correctly has no `spec.md`.

### Requirements Coverage

| Requirement                                                      | Status      | Notes                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| p03-t01 shared collaboration container/log                       | Implemented | Observer open/join and immutable append/show/render use the shared container while reporting delivery disabled; both generated observer forms carry the required shared runtime and the focused cross-bundle tests pass. |
| p03-t02 content-bound composition capability and legacy refusal  | Implemented | Capability, manifest, digest, launcher marker, and installed file bytes agree; legacy and drifted bundles fail closed.                                                                                                   |
| p03-t02 immutable controller and lease-arm/disarm races          | Implemented | Enablement, registration, Stop, retry, and watch paths retain the epoch's controller and refuse a newly mismatched owner without mutating observer state.                                                                |
| p03-t02 inbox-first/shared budget/single owner                   | Implemented | Composed Codex Stop selects addressed requests first, reserves the shared slot before observer CAS, contains CAS loss, and keeps standalone Stop/watch inert for observer-owned epochs.                                  |
| p03-t02 public/private cursor preservation and exact-ID guidance | Implemented | Real public state and private lease evidence remain unchanged across message presentation/ack; both skill forms instruct exact message-ID dedup rather than fuzzy prose matching.                                        |
| p03-t02 Claude/Cursor boundaries                                 | Implemented | Claude composition remains `composed-monitor-unavailable` pending p04-t01; Cursor remains manual/unverified with no fabricated adapter.                                                                                  |
| p03-t03 docs/distribution/release                                | Implemented | Canonical/generated forms, versions `agent-messaging` 1.0.12 and `session-observer-collab` 1.0.36, changelog, navigation, release guidance, and acceptance matrix agree.                                                 |
| p02-r2-M1 exact expiry equality                                  | Implemented | `activationStatus` is inactive at `now >= effectiveExpiresAt`; focused and full tests pass.                                                                                                                              |
| p02-r2-M2 final-veto diagnostic ordering                         | Implemented | Stop and watch publish attempt diagnostics only after their final controller-bound output veto; race fixtures preserve truthful finite claim state.                                                                      |

### Extra Work (not in declared requirements)

None.

## Verification Commands

Commands actually run by the primary reviewer:

```bash
pnpm run test:vitest src/skills/session-observer-collab/src/messaging-composition.test.ts src/skills/session-observer-collab/src/shared-log.test.ts src/skills/session-observer-collab/src/codex-hook.test.ts src/skills/session-observer-collab/src/cursor-hook.test.ts src/skills/session-observer-collab/src/control.test.ts src/skills/session-observer-collab/src/wake-envelope-contract.test.ts src/skills/session-observer-collab/src/codex-install.test.ts src/skills/agent-messaging/src/cli.test.ts src/skills/agent-messaging/src/hooks.test.ts src/skills/agent-messaging/src/registration.test.ts src/skills/agent-messaging/src/watch.test.ts src/skills/agent-messaging/src/owner-contract.test.ts src/skills/agent-messaging/src/packaging.test.ts src/shared/collaboration/activation.test.ts src/shared/collaboration/claims.test.ts tests/tooling/skill-packaging.test.ts
pnpm run test
pnpm run build:check
pnpm run type-check
pnpm run validate
pnpm run smoke
pnpm run validate:skill-versions -- --base-ref 254e190e081fc7af07931bc5b118b1d80643065d
pnpm exec oxfmt --check CHANGELOG.md RELEASING.md src/distributions.ts src/shared/collaboration/activation.ts src/shared/collaboration/activation.test.ts src/shared/collaboration/claims.ts src/skills/agent-messaging/SKILL.md src/skills/agent-messaging/references/live-acceptance.md src/skills/agent-messaging/src/agent-messaging.ts src/skills/agent-messaging/src/hooks.test.ts src/skills/agent-messaging/src/hooks/common.ts src/skills/agent-messaging/src/owner-contract.test.ts src/skills/agent-messaging/src/packaging.test.ts src/skills/agent-messaging/src/registration.ts src/skills/agent-messaging/src/watch.test.ts src/skills/agent-messaging/src/watch.ts src/skills/session-observer-collab/SKILL.md src/skills/session-observer-collab/references/runtime-claude-code.md src/skills/session-observer-collab/references/runtime-codex.md src/skills/session-observer-collab/references/runtime-cursor.md src/skills/session-observer-collab/src/codex-install.test.ts src/skills/session-observer-collab/src/collab-control.d.mts src/skills/session-observer-collab/src/collab-control.mjs src/skills/session-observer-collab/src/hooks/codex-stop.d.mts src/skills/session-observer-collab/src/hooks/codex-stop.mjs src/skills/session-observer-collab/src/lib/codex-install.mjs src/skills/session-observer-collab/src/messaging-composition.test.ts src/skills/session-observer-collab/src/shared-log.test.ts tests/tooling/skill-packaging.test.ts documentation/docs/engineering/architecture/agent-messaging.md documentation/docs/engineering/architecture/index.md documentation/docs/engineering/architecture/meta.json documentation/docs/user-guide/plugins/session/index.md documentation/docs/user-guide/skills/agent-messaging.md documentation/docs/user-guide/skills/index.md documentation/docs/user-guide/skills/meta.json documentation/docs/user-guide/skills/session-observer-collab.md plugins/consensus/README.md
pnpm exec oxlint src/distributions.ts src/shared/collaboration/activation.ts src/shared/collaboration/activation.test.ts src/shared/collaboration/claims.ts src/skills/agent-messaging/src/agent-messaging.ts src/skills/agent-messaging/src/hooks.test.ts src/skills/agent-messaging/src/hooks/common.ts src/skills/agent-messaging/src/owner-contract.test.ts src/skills/agent-messaging/src/packaging.test.ts src/skills/agent-messaging/src/registration.ts src/skills/agent-messaging/src/watch.test.ts src/skills/agent-messaging/src/watch.ts src/skills/session-observer-collab/src/codex-install.test.ts src/skills/session-observer-collab/src/collab-control.mjs src/skills/session-observer-collab/src/hooks/codex-stop.mjs src/skills/session-observer-collab/src/lib/codex-install.mjs src/skills/session-observer-collab/src/messaging-composition.test.ts src/skills/session-observer-collab/src/shared-log.test.ts tests/tooling/skill-packaging.test.ts
git diff --check 254e190e081fc7af07931bc5b118b1d80643065d..d1b3fe166adc76e3be78bfb1a21c7ee8adfd7c8c
```

Results: 243/243 focused tests passed; the full suite passed 2,216 with 1
skipped; generated build freshness, type-check, validation, smoke, two-skill
version validation, scoped formatting, scoped lint, and diff checks passed. The
worktree was clean before this review artifact was written. The prior successful
54-page documentation production build remains applicable because neither fix
round changed authored documentation.

Deliberately not run: live provider hooks, provider installs/trust/configuration,
user-level skill installs or syncs, paid/live gates, publication, push/PR/merge,
and backlog closure. No live acceptance claim was inferred from fixtures.

## Recommended Next Step

Accept Phase 3 in the parent `oat-project-implement` workflow and proceed to
the configured Phase 4 HiLL implementation/review boundary. Keep live provider
and installation acceptance separate.
