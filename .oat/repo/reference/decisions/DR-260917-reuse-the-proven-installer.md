---
id: DR-260917-reuse-the-proven-installer
title: Reuse the proven installer core
date: 2026-09-17
status: accepted
legacy_id: null
---

# Reuse the proven installer core

## Context

The sibling tkstang/personal-skills repository already contained proven pinned-Git acquisition, inventory, destination, and failure-injection patterns. Building a separate installer framework for this repository would duplicate behavior and expand the test and maintenance surface.

## Decision

Adapt the proven installer mechanics into the dependency-free first-party standalone helper, limiting new design to the public bootstrap and this repository's generated distribution contract.

## Consequences

The public installer shares established safety patterns and avoids a second staging-copy or shipped race-harness design. Future divergence requires a demonstrated repository-specific need.
