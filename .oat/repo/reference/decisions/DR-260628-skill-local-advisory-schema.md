---
id: DR-260628-skill-local-advisory-schema
title: Skill-local advisory schema
date: 2026-06-28
status: accepted
legacy_id: null
---

# Skill-local advisory schema

## Context

Keep the canonical advisory response contract under plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json. The future panel skill can reuse or copy this schema with parity coverage rather than introducing a shared schema location prematurely.

## Decision

Store the canonical advisory response contract at
`plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json`.

Do not introduce a shared schema package for the first advisory skill.

## Consequences

The schema ships with the skill that owns it and remains easy for operators to
locate. A future `consensus-panel` project can copy or reuse the contract with
parity coverage once the second advisory surface exists.
