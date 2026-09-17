---
id: DR-260917-scoped-external-review-state
title: Scoped external review state
date: 2026-09-17
status: accepted
legacy_id: null
---

# Scoped external review state

## Context

Runtime evidence and results should not add unrequested files to the worktree being reviewed, while mutation checks still need a bounded auditable contract.

## Decision

Store private review runs in external XDG or home state keyed by canonical worktree path. Compare HEAD, index, status, and selected-path identities before and after dispatch.

## Consequences

Repository churn is avoided and selected evidence is auditable, but unchanged status can hide changes outside the selected set; ignored paths and transient write-and-revert activity are not universally monitored.
