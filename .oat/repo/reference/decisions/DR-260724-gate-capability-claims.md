---
id: DR-260724-gate-capability-claims
title: Gate capability claims on evidence
date: 2026-07-24
status: accepted
legacy_id: null
---

# Gate capability claims on evidence

## Context

Provider documentation, visible configuration, or synthetic tests do not prove that a runtime actually delivers callbacks, preserves identity, or cleans up safely.

## Decision

Publish support labels only from bounded automated coverage and sanitized live evidence, retaining structural data while excluding transcript prose, secrets, and personal paths.

## Consequences

Unsupported or unmeasured provider surfaces remain explicitly unavailable or documented-but-unvalidated rather than being promoted from inference.
