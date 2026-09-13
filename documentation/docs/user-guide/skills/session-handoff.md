---
title: 'Session Handoff'
description: 'Prepare concise evidence-grounded continuation context, with optional observer review and sanitized transcript export.'
---

# Session Handoff

`session-handoff` prepares another agent or person to continue a bounded piece
of coding work. It is generated as the standalone `session-handoff` skill and
as `handoff` in the session plugin. Both forms come from one canonical owner and
share one `metadata.version`.

A handoff records the goal, current state, decisions, evidence, remaining work,
and approval boundaries. It is not a verbatim transcript, retrospective,
completion claim, or authorization to commit, push, install, publish, recover,
or invoke a provider.

## Output destination

- Use an explicit `--out <path>` or prose path when the handoff should be saved.
- Without a path, return the handoff inline.
- A project-local default under `.oat/projects/shared/<project>/handoff.md` is
  used only when an existing active project is already established and the
  handoff belongs there.
- Do not overwrite an existing handoff unless the user explicitly asks to
  update that file.

The bundled handoff template keeps only sections that have useful continuation
context; it does not require empty ceremony.

## Optional integrations

`session-observer` can provide one exact, stateless peer-session review, and
`session-export-transcript` can create a sanitized companion transcript after
the user accepts that separate write. Neither skill is a prerequisite. The
handoff checks only the current host's effective skill inventory, skips missing
optional integrations honestly, and never installs them automatically.

If a transcript companion is created, record its path and limitations rather
than copying the transcript into the handoff. Transcript export remains
separately authorized because it creates another artifact.

## What a good handoff contains

- the concrete objective and current verified state;
- exact branch, HEAD, worktree, and relevant file paths when a repository is in
  scope;
- decisions and constraints the successor must preserve;
- completed work separated from pending, blocked, or approval-bound work;
- the next bounded action and the checks that establish success.

Keep evidence compact. Link to durable files, commits, test results, and an
accepted transcript artifact instead of pasting large logs or hidden session
payloads.

## Limitations

- A handoff does not create, resume, fork, or move a provider session.
- It does not prove a successor can discover or invoke every optional skill.
- Static packaging does not establish live provider behavior.
