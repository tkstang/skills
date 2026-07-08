# OAT Decision Index

> Generated decision table lives inside the managed section below. Keep curated narrative updates outside the marker pair so CLI regeneration stays safe.

## Curated Overview

- Add brief narrative summaries here as decisions are created and migrated.

<!-- OAT DECISION-INDEX -->
| ID | Date | Status | Title | Legacy |
| --- | --- | --- | --- | --- |
| DR-260707-shared-consensus-loop-runtime | 2026-07-07 | accepted | Shared consensus loop runtime stays plugin-local | - |
| DR-260707-standalone-consensus-installs | 2026-07-07 | accepted | Standalone consensus installs remain recovery-only | - |
| DR-260705-skills-sh-listing-is-telemetry | 2026-07-05 | accepted | skills.sh listing is telemetry-seeded; never name internal skills in telemetry | - |
| DR-260703-invocation-wins-over-persisted | 2026-07-03 | accepted | Invocation wins over persisted defaults | - |
| DR-260703-moderator-stays-neutral | 2026-07-03 | accepted | Moderator stays neutral | - |
| DR-260703-one-project-for-config | 2026-07-03 | accepted | One project for config and panel | - |
| DR-260703-panel-is-single-round-breadth | 2026-07-03 | accepted | Panel is single round breadth | - |
| DR-260703-provider-cli-owns | 2026-07-03 | accepted | Provider CLI owns configuration | - |
| DR-260628-host-owned-disposition | 2026-06-28 | accepted | Host-owned disposition | - |
| DR-260628-instruction-only-advisory | 2026-06-28 | accepted | Instruction-only advisory skill | - |
| DR-260628-phone-a-friend-naming | 2026-06-28 | accepted | Phone-a-friend naming | - |
| DR-260628-skill-local-advisory-schema | 2026-06-28 | accepted | Skill-local advisory schema | - |
| DR-260627-control-public-skill-discovery | 2026-06-27 | accepted | Control public skill discovery in-repo via internal-flag apply script and CI gate | - |
| DR-260627-keep-consensus-skills | 2026-06-27 | accepted | Keep consensus skills discoverable and recover standalone installs via a shared-home installer | - |
| DR-260622-independent-draft-family | 2026-06-22 | Accepted. | Independent-draft family wrappers stay thin and whole-artifact for v1 | DR-026 |
| DR-260621-consensus-verdict-submission | 2026-06-21 | Accepted. | Consensus verdict submission uses owned submit CLI with sidecar capture | DR-024 |
| DR-260621-fumadocs-for-the-documentation | 2026-06-21 | proposed | Fumadocs for the documentation site | DR-025 |
| DR-260619-consensus-peer-invocation | 2026-06-19 | Accepted. | Consensus peer invocation owned by provider CLI | DR-023 |
| DR-260619-shipped-skills-carry | 2026-06-19 | Accepted. | Shipped skills carry a validator-backed top-level `version`, kept in sync with `metadata.version` | DR-022 |
| DR-260616-build-time-import-rewrites | 2026-06-16 | Accepted. | Build-time import rewrites reconcile canonical source paths with shipped runtime paths | DR-021 |
| DR-260615-canonical-typescript-sources | 2026-06-15 | Accepted. | Canonical TypeScript sources build committed generated runtime outputs | DR-020 |
| DR-260613-synthesis-mediation-is-two | 2026-06-13 | Accepted (implemented and merged to `main` via PR #9). | Synthesis mediation is two-tier — deterministic per-round merge plus agency-gated host/user escalation | DR-018 |
| DR-260613-unified-v1-verdict-schema | 2026-06-13 | Accepted (implemented and merged to `main` via PR #9). | Unified v1 verdict schema with no v0 migration; deterministic-only escalation triggers | DR-019 |
| DR-260612-oat-tool-packs-install-at-user | 2026-06-12 | Accepted current-state exception. | OAT tool packs install at user scope; the repo keeps only the workflow pack and project-local stubs | DR-017 |
| DR-260605-export-sanitization-is-two | 2026-06-05 | Accepted. | Export sanitization is two layers — structural filtering plus evidence-driven content detectors, drop-on-match | DR-016 |
| DR-260604-export-identifies-the-live | 2026-06-04 | Accepted. | Export identifies the live session by an announced content marker, with newest-for-cwd fallback | DR-015 |
| DR-260604-shared-transcript-knowledge | 2026-06-04 | Superseded in implementation by DR-020/DR-021 on 2026-06-17. The durable decision is still "share only per-provider transcript knowledge and ship self-contained generated copies"; the canonical source moved to `src/transcript/core/runtimes.ts`, and `sync:transcript-core` is now a compatibility wrapper around `scripts/build-generated.mjs`. | Shared transcript knowledge lives in `shared/transcript-core/` with build-time sync and a drift guard; share the minimum | DR-014 |
| DR-260603-watch-event-logs-are-metadata | 2026-06-03 | Accepted. | Watch event logs are metadata-only and path-hardened to the state directory | DR-013 |
| DR-260603-watch-is-a-foreground-polling | 2026-06-03 | Accepted. | Watch is a foreground polling watcher with a shared observe pipeline, not a daemon or provider hooks | DR-012 |
| DR-260515-watch-mode-design-locked-but | 2026-05-15 | Superseded by DR-012 (watch shipped 2026-06-04). | Watch mode design-locked but deferred from session-observer v1 | DR-011 |
| DR-260514-deterministic-tier-based | 2026-05-14 | Accepted. | Deterministic tier-based session ranking with explicit no-match widening | DR-008 |
| DR-260514-digests-are-natural-language | 2026-05-14 | Accepted. | Digests are natural-language-only by default; tool activity is opt-in | DR-010 |
| DR-260514-read-offsets-in-xdg-state | 2026-05-14 | Accepted. | Read offsets in XDG state, keyed by runtime:sessionId, with locked atomic persistence | DR-009 |
| DR-260514-session-observer-is-standalone | 2026-05-14 | Accepted. | session-observer is standalone — peer-transcript adapters ported, not depended on | DR-007 |
| DR-260505-deliberation-artifact-is | 2026-05-05 | Accepted. | Deliberation artifact is the canonical resume state; corruption fails closed | DR-005 |
| DR-260503-editorial-agency-is | 2026-05-03 | Accepted. | Editorial agency is a deterministic user-facing flag, shipped at v0.1 | DR-006 |
| DR-260502-normalized-hash-convergence | 2026-05-02 | Accepted. | Normalized-hash convergence with ACCEPT-twice-same-hash guard; versioned verdicts with post-receive byte caps | DR-004 |
| DR-260502-sequential-sections-by-default | 2026-05-02 | Accepted. | Sequential sections by default; parallel orchestration is host-mediated, fail-closed | DR-003 |
| DR-260501-paseo-invoked-by-shell-out | 2026-05-01 | Superseded by DR-023. | Paseo invoked by shell-out, never embedded | DR-002 |
| DR-260501-skills-first-repo-with-self | 2026-05-01 | Accepted. | Skills-first repo with self-contained sub-plugins; OAT scaffolding invisible to plugin consumers | DR-001 |
<!-- END OAT DECISION-INDEX -->

## Notes

- Decision records live as file-per-record Markdown files in this directory.
- Regenerate this index with `oat decision regenerate-index` after resolving conflicts.
