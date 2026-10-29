---
id: DR-261028-session-toolkit-naming
title: Session toolkit naming
date: 2026-10-28
status: accepted
legacy_id: null
---

# Session toolkit naming

## Context

The shared session library and CLI need distinct package and executable names. The operator selected @tkstang/session-toolkit with the seshtk command after considering session-kit, stk and sesh; stk and sesh already have CLI conflicts.

## Decision

Name the npm package `@tkstang/session-toolkit` and its CLI executable `seshtk`.
The operator confirmed this pair in the current conversation. `session-toolkit`
describes the broad session capability set; `seshtk` provides a short command
without the existing CLI collisions found for `stk` and `sesh`.

Use the scoped package explicitly for fetched execution:

```sh
npx --package=@tkstang/session-toolkit@<approved-version> seshtk <command>
```

## Consequences

Update the [shared toolkit proposal](../brainstorms/2026-10-28-shared-session-toolkit.md)
and future package declarations, examples and skill prerequisites to use these names.
No alternate executable aliases are selected.

Registry checks returned no published package for `@tkstang/session-toolkit`
or `seshtk` on 2026-10-28; no existing `seshtk` CLI surfaced in web searches.
Those checks do not reserve names or establish publishing rights. Verify the
publishing identity and rights before the first release.

This decision covers naming only. Package architecture, runtime prerequisites,
release scope and migration policies remain proposals; existing standalone-skill
decisions are not superseded by this record.
