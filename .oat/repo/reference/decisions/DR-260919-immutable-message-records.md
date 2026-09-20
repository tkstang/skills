---
id: DR-260919-immutable-message-records
title: Immutable message records
date: 2026-09-19
status: accepted
legacy_id: null
---

# Immutable message records

## Context

Concurrent senders, crashes, retries, takeover, and close races must not overwrite messages, create torn state, or conflate host output with recipient action.

## Decision

Publish messages, acknowledgments, claims, bindings, and log entries as complete immutable no-clobber records. Treat the caller-supplied message ID as the idempotency key, and require an explicit content-bound acknowledgment from the current recipient.

## Consequences

Same-ID retries are inspectable and deterministic, while conflicting reuse fails closed. Crashes may leave an uncertain committed operation or conservative replay, but cannot invent an acknowledgment; enqueue, output attempt, acknowledgment, reply, and completed action remain distinct states.
