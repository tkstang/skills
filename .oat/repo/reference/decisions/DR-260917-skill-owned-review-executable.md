---
id: DR-260917-skill-owned-review-executable
title: Skill-owned Review executable
date: 2026-09-17
status: accepted
legacy_id: null
---

# Skill-owned Review executable

## Context

Consensus Review must ship identical behavior as a standalone skill and as the Consensus plugin local review skill without coupling plugin runtime code to a product skill or widening the generic dispatcher.

## Decision

The canonical consensus-review skill owns the review executable and its build closure. Both installation forms are generated from that owner, and no consensus review dispatcher subcommand is added.

## Consequences

Behavior stays identical across both distributions. Future changes must update canonical source, the affected skill and plugin versions, the Unreleased changelog, and generated outputs together.
