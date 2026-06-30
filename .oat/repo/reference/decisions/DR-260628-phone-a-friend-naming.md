---
id: DR-260628-phone-a-friend-naming
title: Phone-a-friend naming
date: 2026-06-28
status: accepted
legacy_id: null
---

# Phone-a-friend naming

## Context

Use phone-a-friend consistently across the skill directory, frontmatter, examples, docs, manifests, tests, and project artifacts. This matches the backlog/project name and keeps the public label idiomatic.

## Decision

The shipped skill name is `phone-a-friend`.

Use that string consistently for the skill directory, frontmatter name, docs
page, examples, manifests, tests, and OAT project artifacts.

## Consequences

The public label stays aligned with the backlog item and project branch. Future
references should not introduce a shorter `phone-friend` alias unless a separate
compatibility decision is made.
