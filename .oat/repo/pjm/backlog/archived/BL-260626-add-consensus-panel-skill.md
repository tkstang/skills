---
id: BL-260626-add-consensus-panel-skill
title: Add consensus-panel skill (neutral moderator, multi-agent panel)
status: closed
priority: medium
scope: feature
scope_estimate: M
labels:
  - consensus
  - skill-family
  - provider-cli
  - peer-review
assignee: null
created: 2026-06-26T04:55:26Z
updated: 2026-07-03T04:02:22Z
associated_issues: []
---

## Description

Add `consensus-panel`: a consensus-family skill where the user's idea, question,
or inquiry is dispatched to a panel of 2+ provider-backed agents, and **all**
panel responses are presented back to the user.

The defining property is **moderator neutrality**. The agent the user speaks to
directly acts as the panel **moderator** and does *not* participate as a panel
member. It frames the question, dispatches it to the panelists, collects their
responses, and presents them — it does not contribute its own opinion as one of
the panel voices, so it stays neutral. Panel size is 2 or more.

This is distinct from the rest of the family and should be positioned against
them in the docs:

- **vs `refine` / `evaluate`:** those run a deliberation loop that *converges*
  on a single artifact/verdict. `consensus-panel` is a single-round breadth
  gather with **no forced convergence** — the value is seeing each independent
  perspective side by side, not collapsing them to one answer.
- **vs `phone-a-friend` (BL-260620-add-phone-a-friend-advisory):** that is a
  one-shot *single* advisory peer. `consensus-panel` is 2+ peers in parallel with
  a neutral moderator surfacing every response.

Execution should reuse the owned provider invocation CLI as the subprocess /
peer-execution boundary (provider inventory, preflight, bounded execution,
schema delivery, retry/cap/timeout ownership), consistent with the rest of the
family.

Panel composition (how many panelists, which providers/models) should be
selectable per invocation. The ergonomic "use my default panel" path depends on
**BL-260626-configure-default-consensus** (CLI-configurable default panel /
consensus agent configs); panel can ship first with explicit per-invocation
composition and adopt configured defaults when that lands. These two items are
intended to be the **same project**, with the config item as a dependency for
the default-panel ergonomics.

Open design questions to resolve before/at build:

- Whether the moderator may add a clearly-separated *neutral* overview (themes,
  agreements, disagreements) without breaching neutrality, or whether v1 surfaces
  raw attributed responses only.
- Whether panelists are strictly independent (no cross-talk) in v1, or whether an
  optional second round (panelists see each other's first answers) is in scope.
- Cold-start mode reuse: this looks like `shared_input` (same prompt to every
  panelist) with no iteration/synthesizer — confirm it maps onto existing
  cold-start/mode plumbing rather than introducing a new one.

## Acceptance Criteria

- A new shipped consensus-family skill `consensus-panel` exists, dispatching the
  user's input to **2 or more** provider-backed panelists via the owned provider
  CLI.
- Moderator neutrality is specified and enforced in the skill instructions: the
  host agent frames, dispatches, collects, and presents, and does **not** author
  a panel response of its own or inject its opinion as a panel member.
- **All** panelist responses are presented to the user, each attributed to its
  panelist (provider/model), with no forced convergence or synthesis into a
  single answer.
- Panel composition (count + providers/models) is selectable per invocation, and
  consumes configured defaults from BL-260626-configure-default-consensus when
  available.
- Graceful degradation when fewer panelists than requested are available
  (provider unavailable / preflight failure), with the shortfall surfaced to the
  user rather than silently dropped.
- A panel artifact (or transcript) captures each attributed response and the
  question as posed to the panel.
- The skill's positioning relative to `refine` / `evaluate` / `phone-a-friend`
  (non-converging panel vs deliberation loop vs single advisor) is documented.
- The open design questions (optional neutral overview, independence vs second
  round, cold-start/mode reuse) are resolved and recorded (DR if durable).
- Manifests, SKILL.md, documentation site pages, and tests updated as for other
  family skills.

## Completion

Completed on 2026-07-03 by the `consensus-panel` OAT project.

- Shipped `plugins/consensus/skills/panel/` as the `consensus-panel` workflow,
  with moderator-neutral host instructions, operator QA, examples, schema
  assets, generated runtime output, and provider plugin manifest coverage.
- Added a direct single-round panel wrapper that sends the same question to two
  or more provider-backed panelists via the owned provider CLI and renders all
  attributed responses, diagnostics, and shortfalls into a markdown artifact.
- Integrated configured panel defaults from the shared consensus config resolver,
  while keeping per-invocation `--panelists` and `--panel-size` controls.
- Documented positioning against `refine`, `evaluate`, and `phone-a-friend`,
  and recorded v1 as independent single-round paneling with multi-round
  discussion deferred to `BL-260701-add-multi-round-panel`.
