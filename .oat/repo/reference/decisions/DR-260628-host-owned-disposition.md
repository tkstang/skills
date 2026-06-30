---
id: DR-260628-host-owned-disposition
title: Host-owned disposition
date: 2026-06-28
status: accepted
legacy_id: null
---

# Host-owned disposition

## Context

The host agent owns context selection, peer choice, and final judgment for phone-a-friend. Peer output is advisory data; the host must decide whether to agree, disagree, apply, ignore, or follow up before acting.

## Decision

`phone-a-friend` returns advisory data for the host to disposition.

The host remains responsible for selecting or confirming context, choosing the
peer, reading the advisory payload, and deciding whether to agree, disagree,
apply, ignore, or ask a follow-up.

## Consequences

The skill must not auto-apply peer recommendations or present the peer as the
final decision-maker. This keeps `phone-a-friend` distinct from future
neutral-moderator panel work, where the host role may be intentionally
different.
