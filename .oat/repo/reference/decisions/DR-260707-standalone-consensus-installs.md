---
id: DR-260707-standalone-consensus-installs
title: Standalone consensus installs remain recovery-only
date: 2026-07-07
status: accepted
legacy_id: null
---

# Standalone consensus installs remain recovery-only

## Context

The primary runtime contract is the consensus plugin install/local-load layout. Standalone single-skill copies remain supported only through the existing ~/.consensus/consensus.mjs recovery path, not by introducing a new global shared runtime tree.

## Decision

Do not introduce a new global shared runtime tree for consensus wrappers.
Standalone single-skill installs continue to use the existing
`~/.consensus/consensus.mjs` recovery path when the full consensus plugin tree
is unavailable.

## Consequences

- The primary supported runtime layout remains the consensus plugin package,
  with `scripts/` and `skills/` preserved together.
- Standalone recovery remains an compatibility path for skills.sh-style
  single-skill copies, not the architecture for plugin installs.
- Documentation must avoid implying broader marketplace or skills.sh availability
  beyond verified evidence.
