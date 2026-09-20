---
title: 'Getting Started'
description: 'Choose an installation form, try a small request, and recognize a useful skill response.'
---

# Getting Started

Start with one capability that solves a problem you already have. You do not
need both plugins or every standalone skill.

## Choose a starting point

- **Unsure what to do next?** Try [Next Steps](../skills/next-steps.md), a
  standalone, instruction-only skill that recommends an action without doing it.
- **Continuing work in another session?** Start with
  [Session Handoff](../skills/session-handoff.md), available in the
  [Session plugin](../plugins/session/index.md) or on its own.
- **Coordinating work across local sessions?** Use
  [Agent Messaging](../skills/agent-messaging.md) for durable addressed inboxes
  with explicit acknowledgments and manual fallback.
- **Need independent perspectives on a draft or decision?** Explore the
  [Consensus plugin](../consensus/index.md). Its peer workflows invoke provider
  CLIs and have additional prerequisites.

## Install the form you chose

For Next Steps, follow [Install one standalone skill](../installation.md#install-one-standalone-skill)
for a copyable command targeting Codex, Claude Code, or Cursor. For a plugin,
use the [installation matrix](../installation.md#install-matrix).
Plugin-local names and standalone names differ; each skill guide identifies
the available forms. Avoid installing both forms of the same skill unless you
intend to manage duplicate host entries.

## Try a bounded request

Once Next Steps is available in your agent, invoke `$next-steps` in Codex or
`/next-steps` in Claude Code. In Cursor, select the installed skill in the host's
skill interface or ask it to use Next Steps; check that it loads the skill
before relying on the response. Use a small example:

> The feature is implemented. Review found one empty-input bug and no other
> blockers. What should we do next, and why? Recommend a path; do not change
> files yet.

A useful response explains the current state, recommends fixing the bug and
checking that exact regression, and distinguishes what the agent can do from
what needs your decision. It should not start editing files. See
[Next Steps](../skills/next-steps.md) for its full behavior and limits.

If the skill is not visible, first check the installed form and host inventory
against [Installation](../installation.md). A valid payload does not by itself
prove that a fresh agent session discovered it.

## Contents

- [Installation](../installation.md) — Provider setup, prerequisites, standalone forms, updates, and readiness checks.
