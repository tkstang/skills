---
id: DR-260919-filesystem-mailbox-transport
title: Filesystem mailbox transport
date: 2026-09-19
status: accepted
legacy_id: null
---

# Filesystem mailbox transport

## Context

Agent messaging must work across local repositories and worktrees without depending on transcript observation, a provider-native queue, a daemon, a network service, or runtime package installation.

## Decision

Use the shared local collaboration filesystem as the transport. Store addressed recipient inboxes and the collaboration log under one resolved collaboration root, and have host adapters read that same durable state.

## Consequences

Three or more local sessions can communicate through dependency-free generated skills and adapters, including across repositories and worktrees. The first scope is intentionally limited to one machine and supported local filesystems; network and synced stores require separate validation.
