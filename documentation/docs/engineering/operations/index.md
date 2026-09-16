---
title: 'Operations'
description: 'Understand CI, docs deployment, release gates, and independent plugin and skill versions.'
---

# Operations

How this repository validates changes, deploys documentation, and prepares
releases. For local checkout setup and everyday verification, start with
[Development](../contributing/development/index.md).

Automated validation, publishing the docs site, and accepting a live provider
path are separate outcomes. A green build proves neither that a provider has
discovered an installed skill nor that a release is ready for publication.

## Contents

- [CI & Quality Gates](ci.md) — What runs on PRs, pushes, manual dispatches, and release tags; how to reproduce deterministic checks.
- [Releases & Versioning](releases-and-versioning.md) — Select a plugin, distinguish skill and plugin versions, and identify the evidence required before a release.
