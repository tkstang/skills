---
id: DR-260917-prefer-refusal-and-inspectable
title: Prefer refusal and inspectable recovery
date: 2026-09-17
status: accepted
legacy_id: null
---

# Prefer refusal and inspectable recovery

## Context

Overwriting or adopting an existing skill directory makes ownership and partial-failure recovery ambiguous, and automatic recursive cleanup could destroy user data.

## Decision

Keep the installer new-install-only, reserve the destination exclusively, refuse every existing destination, and retain a marked partial directory after post-reservation failure.

## Consequences

Updates and retries require deliberate operator cleanup or relocation. Failures remain inspectable, and the installer never guesses that recursive deletion is safe.
