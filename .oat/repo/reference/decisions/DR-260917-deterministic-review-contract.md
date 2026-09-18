---
id: DR-260917-deterministic-review-contract
title: Deterministic review contract
date: 2026-09-17
status: accepted
legacy_id: null
---

# Deterministic review contract

## Context

Peer output is untrusted input and cannot overwrite host evidence or appear as a clean review when incomplete.

## Decision

Review owns a strict JSON schema, fixed semantic validation, host evidence aggregation, and deterministic Markdown rendering. OAT consumes the artifact optionally instead of defining the runtime contract.

## Consequences

Completed artifacts preserve stable findings, provenance, checks, limitations, and receipt-compatible Markdown. Invalid output becomes a labeled diagnostic rather than a successful review.
