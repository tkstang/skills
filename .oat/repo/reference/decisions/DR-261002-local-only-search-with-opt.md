---
id: DR-261002-local-only-search-with-opt
title: Local-only search with opt-in remote hosts
date: 2026-10-02
status: accepted
legacy_id: null
---

# Local-only search with opt-in remote hosts

## Context

The user works across several machines, but the shipped skill must be machine-agnostic with no hostnames, and remote non-interactive shells often lack Homebrew on PATH.

## Decision

The CLI searches only the local machine; on a miss or a user hint, the agent runs a documented injection-safe ssh recipe on a host the user names, with a read-only tier 1-2 fallback when the skill is not installed remotely.

## Consequences

No automatic multi-machine fan-out; remote search depends on ssh access and ideally a remote install; the no-install fallback is unranked and unredacted (a known follow-up).
