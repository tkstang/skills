---
id: DR-260917-explicit-v1-review-selectors
title: Explicit v1 review selectors
date: 2026-09-17
status: accepted
legacy_id: null
---

# Explicit v1 review selectors

## Context

An implicit broad scope would make reviewer intent, captured evidence, and drift coverage ambiguous.

## Decision

Review v1 accepts exactly a base-branch diff, explicit files, or one document. The host gathers missing details, while the non-interactive executable returns usage errors instead of guessing.

## Consequences

The v1 evidence contract stays bounded and testable. Staged-only, unstaged-only, and committed-range selectors remain deferred until a concrete need cannot be expressed by the three supported selectors.
