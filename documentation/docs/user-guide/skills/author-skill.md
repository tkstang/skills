---
title: 'Author Skill'
description: 'Create, revise, migrate, or review agent skills using the target repository’s own authoring and distribution conventions.'
---

# Author Skill

`author-skill` is a standalone, instruction-only guide for creating, revising,
migrating, and reviewing agent skills. It applies when work touches a skill’s
instructions, references, templates, helpers, tests, or packaging. For a
review-only request, it reports findings without editing.

Invoke `$author-skill` in Codex or `/author-skill` in Claude Code, optionally
with a target and task. A natural-language request works too:

> Review this skill’s delegation fallback without editing it.

## How it works

The agent starts with the target repository’s instructions and the skill being
changed. It identifies when the skill should activate, its inputs and outputs,
side effects, dependencies, and completion evidence. It then finds the target
repository’s canonical source, generated forms, build commands, and install
paths. It does not assume this repository’s layout or commands apply elsewhere.

The guide favors a clear trigger description, a focused `SKILL.md` for the
normal workflow, and supporting references loaded only when needed. Executable
helpers are reserved for behavior that benefits from deterministic code.
Provider-specific fields and compatibility claims receive a separate check.

Verification follows the changed boundary: metadata and links for an
instruction-only edit; generation, freshness, and focused tests for a
distributed or executable change. A successful package check does not establish
fresh provider discovery or live execution. The skill preserves prior version
history and follows the target repository’s version policy.

## Boundaries

The skill uses the authorization already given for the requested work. It does
not automatically install prerequisites, replace active skill installations,
or publish a change. It keeps review-only requests read-only and reports what
was verified separately from outcomes still awaiting live acceptance.

For this repository’s concrete source and build procedure, see
[Adding a skill or distribution](../../engineering/contributing/development/adding-a-skill.md).
