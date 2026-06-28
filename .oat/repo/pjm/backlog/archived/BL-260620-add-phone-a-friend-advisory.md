---
id: BL-260620-add-phone-a-friend-advisory
title: Add phone-a-friend advisory peer skill
status: done
priority: medium
scope: feature
scope_estimate: M
labels:
  - consensus
  - provider-cli
  - skill
  - peer-review
assignee: null
created: 2026-06-20T19:18:18Z
updated: 2026-06-28T18:10:22Z
associated_issues: []
legacy_id: bl-22d3
---

## Description

Add a lightweight `phone-a-friend` consensus skill that lets a host agent ask one
other provider-backed peer for a structured advisory take on the current
discussion, design question, bug, review concern, or implementation uncertainty.
This should use the owned provider invocation CLI as the execution boundary, but
it should not run a deliberation loop or produce a refine/evaluate artifact.

The invoking agent should infer the question from the current context when it is
clear, compact the relevant context into a focused prompt, and ask the user for
clarification when multiple plausible topics or sensitive/private material are
involved. The host agent remains responsible for dispositioning the peer's take
rather than blindly applying it.

Resolved naming decision: the shipped skill is named `phone-a-friend` across
skill metadata, docs, examples, manifests, and tests.

**Sequencing (2026-06-20):** independent of the consensus-family lane and the
provider CLI is already shipped, so this is *buildable* any time. Preferred order
is **after** the docs site lands (`bl-ecaa`) so this skill documents directly into
the new IA rather than adding another section to the dense README right before it
is restructured. As a small, self-contained new skill it is a good **first
validation** that the new docs IA absorbs a new skill cleanly. Do not start it as
a 4th concurrent track while release + family + hardening are in flight.

## Acceptance Criteria

- A new shipped skill exists for one-shot advisory peer consultation using the
  provider CLI and a documented structured output schema.
- The skill instructions tell the host agent how to infer the advisory question
  from context, summarize only relevant context, and ask the user when the topic
  is unclear or the prompt would include sensitive material.
- Default peer selection prefers a provider different from the host when
  possible, with explicit user/provider overrides available.
- The advisory response captures at least the understood question, peer take,
  recommendation, risks or missed considerations, follow-up questions, and
  confidence.
- The host-facing workflow includes a disposition step: agree, disagree, apply,
  ignore, or ask a follow-up, with the host agent explaining how the peer take
  affected its next action.
- Recursion and safety behavior is specified, including protection against
  unnecessary same-provider self-spawn and a clear boundary that the peer output
  is advisory only.
- The naming decision (`phone-a-friend` vs `phone-friend`) is resolved before
  shipping and reflected consistently in skill metadata, docs, examples, and any
  scripts.

## Completion

Completed on 2026-06-28 by the `phone-a-friend` OAT project.

- Shipped `plugins/consensus/skills/phone-a-friend/` as an instruction-only
  consensus skill for one-shot advisory peer consultation.
- Added `schemas/advisory.schema.json`, operator reference material, example
  prompt/advisory payloads, and a Vitest contract test against the real schema
  validator.
- Registered the skill in release version tooling and Claude/Cursor/Codex plugin
  descriptions.
- Added User Guide documentation plus plugin README coverage so the docs site and
  plugin-facing docs describe the advisory workflow.
