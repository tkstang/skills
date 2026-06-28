---
id: DR-260628-instruction-only-advisory
title: Instruction-only advisory skill
date: 2026-06-28
status: accepted
legacy_id: null
---

# Instruction-only advisory skill

## Context

Reuse the existing consensus run provider CLI primitive for a single schema-validated provider turn instead of adding TypeScript source or a generated runtime wrapper. This keeps phone-a-friend dependency-free and avoids duplicating shipped provider invocation machinery.

## Decision

Implement `phone-a-friend` as an instruction-only skill over the existing
`consensus run` provider CLI command.

Do not add `src/consensus/phone-a-friend/` TypeScript source, a generated
`.mjs` wrapper, or another loop/runtime copy for this skill.

## Consequences

The host-facing `SKILL.md` and the advisory schema are the behavioral surface.
Verification focuses on schema contract coverage, manifest/version invariants,
docs, and the existing provider CLI execution boundary rather than wrapper unit
tests.
