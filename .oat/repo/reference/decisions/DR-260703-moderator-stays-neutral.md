---
id: DR-260703-moderator-stays-neutral
title: Moderator stays neutral
date: 2026-07-03
status: accepted
legacy_id: null
---

# Moderator stays neutral

## Context

The host frames one approved question, dispatches panelists, and renders their responses without becoming an additional panel voice or injecting its own recommendation.

## Decision

The host remains a neutral moderator for panel runs. It may frame the approved
question, invoke the wrapper, read JSONL status, and present attributed panelist
responses, but it does not become a panelist, synthesize a panel answer, vote, or
claim consensus as part of the panel result.

## Consequences

Panel prompts and artifacts must keep panelist voices attributed and separate
from host commentary. If the user asks for a host recommendation after the panel,
that recommendation is a separate follow-up, not part of the panel result. Any
future multi-round panel mode must preserve moderator neutrality rather than
using cross-talk as a path to host-authored convergence.
