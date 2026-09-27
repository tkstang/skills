---
id: BL-260927-deduplicate-session-observer
title: Deduplicate session-observer CLI runtime resolution and close legacy
  coverage gaps
status: open
priority: low
scope: task
scope_estimate: M
labels:
  - session-observer
  - cleanup
  - testing
assignee: null
created: 2026-09-27T12:30:49.930Z
updated: 2026-09-27T12:30:49.930Z
associated_issues: []
external_plans: []
---

## Description

The session-observer test-pruning campaign (2026-09-26) found that the CLI (session-observer.ts) keeps its own copies of auto-runtime and snippet resolution. Meanwhile lib/observe.ts exports resolveAutoRuntime, applySnippetFilter, and shouldMarkCatchUpRead, which nothing imports, and neither copy tests excluding the observer's own runtime. Deliberate failure injection also showed four behaviors untested both before and after the campaign. (1) Reuse of a valid identityVersion 2 Codex cwd-cache entry (locate.ts): breaking reuse fails no test. (2) The watch shutdown clearControlDirective (watch.ts). (3) The rank() descendant path boundary (rank.ts startsWith(target + '/')). (4) Two watch.ts stdout-writer branches (callback and synchronous-throw) that only tests reach. See .oat/repo/reference/reviews/2026-09-26-session-observer-test-pruning-campaign.md.

## Acceptance Criteria

- Make the CLI and `lib/observe.ts` share one implementation of auto-runtime and snippet resolution, or delete the unused `observe.ts` exports. Behavior must not change.
- Add a test at the owning boundary proving auto-runtime resolution excludes the observer's own runtime. It must fail if that exclusion is removed.
- Add a test proving a valid `identityVersion: 2` Codex cwd-cache entry is reused without re-reading metadata. It must fail if reuse always misses.
- Add a test proving watch shutdown clears the watcher's control directive. It must fail if the shutdown `clearControlDirective` call is removed.
- Add a `rank()` case with `recordedCwd` `/foo/barbaz` against target `/foo/bar`. It must fail if the `+ '/'` path-boundary guard is dropped.
- Decide whether the test-only `watch.ts` stdout-writer callback and synchronous-throw branches are production contracts. Remove them or document them.
- Run a deliberate failure check for each new test before relying on it, bump `session-observer`, add a CHANGELOG entry, and pass repository validation.
