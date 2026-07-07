---
id: DR-260703-panel-is-single-round-breadth
title: Panel is single round breadth
date: 2026-07-03
status: accepted
legacy_id: null
---

# Panel is single round breadth

## Context

The v1 panel workflow gathers independent attributed responses from two or more panelists instead of extending the convergence loop or forcing a synthesized outcome.

## Decision

Panel v1 is a single-round breadth workflow. It asks each resolved panelist for
one independent response through direct provider fan-out and does not run a
discussion loop, convergence loop, vote, or synthesis step. Multi-round panel
discussion remains a separate explicit follow-up and must not change the default
single-round behavior.

## Consequences

The panel artifact is optimized for side-by-side attributed responses rather than
a unified answer. Users who need peer convergence should use `refine` or
`evaluate`; users who need one advisory take should use `phone-a-friend`. Any
future multi-round panel mode must remain opt-in, preserve attribution across
rounds, and justify the added cost, timeout, state, and resume complexity with
real usage evidence.
