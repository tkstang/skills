---
id: DR-260914-metadata-version-is-the-sole
title: Metadata version is the sole skill version
date: 2026-09-14
status: accepted
legacy_id: null
---

# Metadata version is the sole skill version

## Context

The repository's transitional dual top-level and nested skill-version fields created two authored authorities and complicated generated multi-target ownership.

## Decision

Use quoted stable metadata.version as the sole authored skill version. Apply one owner version to every generated form, keep plugin release versions independent, and retain old owner mappings only for historical version comparison across clean-break renames.

## Consequences

Validators reject top-level skill versions and require changed owners and transitive shared-source consumers to increase metadata.version against an explicit base. This decision supersedes DR-260619-shipped-skills-carry and removes its dual-field compatibility transition.
