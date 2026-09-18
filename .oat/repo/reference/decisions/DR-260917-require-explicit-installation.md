---
id: DR-260917-require-explicit-installation
title: Require explicit installation intent
date: 2026-09-17
status: accepted
legacy_id: null
---

# Require explicit installation intent

## Context

The installer can write either project-local or user-wide provider directories and must select an immutable release source. Defaults for scope or reference could cause unintended home-directory mutation or ambiguous source selection.

## Decision

Require callers to provide skill, host, scope, and exact tag explicitly; provide no default scope or mutable reference.

## Consequences

Commands are more verbose, but user-scope mutation and source identity are deliberate before any destination write begins.
