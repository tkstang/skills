---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-17
oat_generated: true
oat_summary_last_task: p03-t02
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: first-party-standalone-installer

## Overview

This project added a first-party command for installing any declared generated standalone skill from an exact release tag into an explicit project or user scope. It reused the proven installer mechanics from `tkstang/personal-skills`, preserving the existing zero-argument Consensus recovery path while adding only the dependency-free public bootstrap delta.

## What Was Implemented

- `install.sh` now delegates explicit standalone arguments to a dependency-free Node.js 22 helper while preserving its existing zero-argument Consensus behavior.
- The standalone path requires `--skill`, `--agent`, `--scope`, and `--ref`. It supports project and user destinations for Codex, Claude Code, and Cursor, writes only the selected provider view, and prints provider-specific invocation guidance.
- The helper fetches only the fully qualified tag into a private bare Git repository, peels it to a commit, and reads only `skills/<name>/`. A regression proves a divergent same-named branch cannot replace the promised tag.
- Installation inventories every regular file by path, executable mode, and SHA-256 digest; refuses unsafe source entries, symlinked destination ancestors, and existing destinations; reserves the destination exclusively; and leaves `.standalone-install-incomplete` after a post-reservation failure.
- Documentation covers both scopes and all supported hosts, distinguishes copy fidelity from live provider acceptance, and records real user-home mutation and live discovery/invocation as separate authority-gated release checks.
- The shared Node.js version failure now says Node 22 is required for “this installer,” which is accurate for both Consensus and standalone entry paths. Its standalone regression lives outside distributed Consensus source so it does not trigger unrelated skill-version bumps.

## Key Decisions

- **Reuse the proven installer core.** The implementation adapts the pinned-source, inventory, destination, and injectable-failure patterns from `personal-skills` instead of introducing a second staging copy, shipped race harness, or exhaustive concurrency matrix.
- **Require explicit installation intent.** Standalone mode has no default scope or mutable ref: the caller must select a skill, host, project or user scope, and exact tag before any destination mutation.
- **Constrain the payload and source identity.** Only generated `skills/<name>/` content is eligible, and the source is the peeled commit from an exact qualified tag; the installer does not fall back to authored source, plugins, or compatibility names.
- **Keep installation provider-specific.** The command writes only the selected Codex, Claude Code, or Cursor destination. Cross-provider mirrors and `oat sync` remain owned by existing workflows.
- **Prefer refusal and inspectable recovery.** Existing destinations are never updated or adopted. A failure after reservation retains a marked partial directory rather than guessing what can be deleted safely.
- **Keep verification claims narrow.** Automated tests establish tag selection and byte/mode fidelity, not signed provenance, fresh-session discovery, or live provider behavior.

## Design Deltas

- Standalone-only tests moved from `src/plugins/consensus/` into repository-level tooling and release suites. The skill-version validator correctly treats changes under distributed Consensus source as affecting seven skills, so relocating the tests preserved the runtime design without unrelated version bumps.
- The documented bootstrap was hardened after review to fetch `refs/tags/<tag>` explicitly and detach at the peeled commit, eliminating same-named branch ambiguity.

## Notable Challenges

- The skill-version gate initially blocked closeout because standalone assertions were placed beneath distributed Consensus source. Candidate-tree comparison established the intended net cancellation, after which the tests were relocated and both committed-range version checks passed with zero changed skills.
- Repository-wide closeout lint followed `.claude/skills/**` and `.cursor/skills/**` symlinks into generated OAT mirrors. The user-authorized correction added those provider mirrors to `.oxlintrc.json`; the later documentation sync aligned `.oxfmtrc.json` and root guidance in `b000f991`. The full test, lint, type-check, and build commands passed.
- The first Node-message regression location repeated the version-gate issue during p03 review. Moving it into the standalone tooling suite resolved the Medium finding while retaining focused coverage.

## Tradeoffs Made

- The public command is new-install-only: update, force, merge, adopt, prune, uninstall, receipts, and ownership lifecycle remain out of scope.
- The installer uses Git transport and exact-tag selection but does not enforce signed tags or provide independent release attestation.
- A post-reservation failure leaves an incomplete destination for inspection instead of performing automatic recursive cleanup.
- Unit and integration tests use local Git fixtures and temporary homes; production networking, real user homes, and live provider calls remain outside automated acceptance.

## Integration Notes

- Shipped runtime remains dependency-free and requires Node.js 22 or newer; Git is the only external acquisition boundary.
- The default source is `https://github.com/tkstang/skills.git`, and release tags must already contain build-validated generated `skills/<name>/` payloads.
- Final verification passed: 2,030 Vitest tests passed with one opt-in live test skipped, repository-wide lint completed with only four pre-existing warnings, and type-check plus generated build passed without drift. Independent final review and the refreshed cross-family exit gate passed with no Critical, Important, or Medium findings.

## Follow-up Items

- Complete the authority-gated live acceptance matrix for project and user scope across Codex, Claude Code, and Cursor before closing backlog item `BL-260916-add-a-first-party-install` or claiming provider-path completion.
- **m1:** Revisit direct invocation through the private Node helper only if that helper becomes a supported public interface.
- **m2:** Document Git configuration isolation during the next installation-guide cleanup, or sooner if a proxy/private-CA user reports a problem; `--repository` already permits a local mirror.
- **m4:** Improve fetch-timeout diagnostics if the bounded timeout is reproduced or support demand appears.

## Explainer Outcome

- **project-recap:** skipped — the operator chose not to generate a final visual recap during completion.

## Workflow Observations

### 2026-09-16 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:1,medium:3,minor:4 exit=1 status=blocked artifact=.oat/projects/shared/first-party-standalone-installer/reviews/artifact-plan-review-2026-09-16T231057Z.md run=8526c3ae-9e24-42fd-b0c2-bf22639824df

### 2026-09-16 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:1,medium:1,minor:2 exit=1 status=blocked artifact=.oat/projects/shared/first-party-standalone-installer/reviews/artifact-plan-review-2026-09-16T232140Z.md run=0a7568fc-1f95-49dd-90bc-3768c2c5fc2c

### 2026-09-17 · project · feedback · reuse proven installer prior art

A complexity review and live comparison found that tkstang/personal-skills already provides the relevant pinned-source, inventory, destination, and failure-injection patterns. The plan now adapts only the dependency-free public bootstrap delta; do not reintroduce a second staging copy or shipped race harness without a demonstrated requirement.

### 2026-09-17 · structural · oat-project-implement · p01

run-first-party-standalone-installer-p01-20260917-blocked verdict=blocked fix-loops=0 recovery-attempts=1; see implementation.md#run-1--2026-09-16

### 2026-09-17 · structural · oat-project-implement · p01

run-first-party-standalone-installer-p01-20260917-passed verdict=passed fix-loops=0 review=reviews/p01-review-2026-09-17T012147Z.md findings=critical:0,important:0,medium:1,minor:0

### 2026-09-17 · structural · oat gate review · final

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:0,minor:5 exit=0 status=ok artifact=.oat/projects/shared/first-party-standalone-installer/reviews/final-review-2026-09-17T020642Z.md run=3631aaf2-103a-4106-9bda-9eeb577cc87f

### 2026-09-17 · structural · oat gate review · final

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:0,minor:4 exit=0 status=ok artifact=.oat/projects/shared/first-party-standalone-installer/reviews/final-review-2026-09-17T050550Z.md run=f673a067-7275-4ef8-9a0a-55e88e880a5b
