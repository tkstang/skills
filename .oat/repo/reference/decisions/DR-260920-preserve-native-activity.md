---
id: DR-260920-preserve-native-activity
title: Preserve native activity semantics
date: 2026-09-20
status: accepted
legacy_id: null
---

# Preserve native activity semantics

## Context

Provider runtimes record different identity, origin, skill, usage, outcome, and coverage carriers, and lossy normalization can overstate the available evidence.

## Decision

Retain native semantics, locators, ownership and reset boundaries, and explicit unknown states; do not infer totals, prices, versions, human origin, or causality without supporting evidence.

## Consequences

Consumers must handle explicit uncertainty, but missing or partial evidence cannot become a false claim.
