---
id: DR-260917-host-aware-single-review
title: Host-aware single review
date: 2026-09-17
status: accepted
legacy_id: null
---

# Host-aware single review

## Context

Consensus Review is an independent inspection rather than a convergence loop, and provider selection must not accidentally recurse into the host or spend on hidden retries.

## Decision

Ordered reviewer defaults prefer a provider different from the host. Same-provider review requires a pinned reviewer plus explicit consent, and execution permits one attempt with one host and depth context reused for preflight and dispatch.

## Consequences

Reviewer choice and spend remain traceable. A malformed response, timeout, or concrete model failure produces an incomplete run rather than a repair or provider-fallback invocation.
