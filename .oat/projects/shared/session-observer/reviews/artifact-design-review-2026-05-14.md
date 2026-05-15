---
oat_generated: true
oat_generated_at: 2026-05-14
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/session-observer
---

# Artifact Review: design

**Reviewed:** 2026-05-14
**Scope:** `design.md` in quick mode, checked against `discovery.md` and the source spec `.superpowers/specs/2026-05-14-session-observer-design.md`.
**Files reviewed:** 3
**Commits:** N/A (artifact review)

## Summary

The design captures the core architecture, data flow, state model, and testing strategy for the bidirectional session observer. It is close to implementation-ready, but one command-path assumption can make the generated skill and local probe invoke the wrong script from normal repo working directories.

## Findings

### Critical

None.

### Important

- `.oat/projects/shared/session-observer/design.md:83` specifies the skill dispatch as `spawnSync('node', ['scripts/session-observer.mjs', 'catch-up'])`, but the CLI is designed to live under `.agents/skills/session-observer/scripts/`, not repo-root `scripts/`. The same pattern is echoed in the source spec's integration command at `.superpowers/specs/2026-05-14-session-observer-design.md:579`. From a normal project cwd this resolves to `repo/scripts/session-observer.mjs`, which does not exist for this skill and will break the exact installed-skill path the design is trying to standardize. Fix the design to require skill-root-relative script resolution, for example by having the agent run `node .agents/skills/session-observer/scripts/session-observer.mjs ...` when executing from the repo root, and having `probe-local.mjs` resolve its sibling CLI with `new URL('./session-observer.mjs', import.meta.url)`.

### Medium

- `.oat/projects/shared/session-observer/design.md:213` makes `rank.mjs` responsible for populating `sisters` from `gitWorktrees`, but the public interface at `.oat/projects/shared/session-observer/design.md:219` has no dependency injection parameter and the dependency list for `rank.mjs` does not mention `locate.mjs`. That leaves the module boundary ambiguous: either `rank` imports `locate` and creates a circular-ish ownership relationship, or the CLI has to enrich no-match results after ranking. Clarify the intended ownership before implementation so the p03 tests and CLI behavior do not drift.

### Minor

None.

## Spec/Design Alignment

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| Bidirectional Claude/Codex transcript inspection | covered | Runtime selection, transcript stores, and auto-resolution are described. |
| Tool-free digest by default | covered | `digest.mjs` and rendering rules exclude tools by default. |
| Incremental catch-up offsets | covered | State model and `catch-up` flow define high-water marks. |
| No Stoa runtime dependency | covered | Stoa is reference-only and runtime writes are local state only. |
| Watch mode designed but deferred | covered | Design points to `references/watch-design.md` and keeps implementation out of v1. |

### Extra Work

None.

## Verification Commands

After artifact fixes:

```bash
npm test
npm run validate
node .agents/skills/session-observer/scripts/probe-local.mjs --runtime claude-code --cwd "$PWD"
```

## Recommended Next Step

Run `oat-project-review-receive` to convert the Important and Medium findings into plan tasks before implementation starts.
