---
id: DR-261025-documentation-information
title: Documentation information architecture
date: 2026-10-25
status: accepted
legacy_id: null
---

# Documentation information architecture

## Context

The Fumadocs app in documentation/ already separates two reader audiences: people who install and use the plugins and standalone skills (documentation/docs/user-guide/), and maintainers who change, document and operate the repository (documentation/docs/engineering/). No decision recorded that structure, and documentation.ia was unset. There is no independent QA or verification track.

## Decision

Adopt the consumer-maintainer preset for the existing structure without restructuring. The user-guide track is organized by product capability: getting started, installation, the Consensus and Session plugins, and the standalone skills catalog grouped by what the reader wants to do. The engineering track is organized by maintenance responsibility: architecture, contributing, operations, decisions and repository layout. Verification overlay: none. The [Information architecture section](../../../../documentation/AGENTS.md#information-architecture) in documentation/AGENTS.md is the authored description; documentation.ia in .oat/config.json mirrors it.

## Consequences

New reader pages go in user-guide/ under the capability they serve; implementation, contribution and operations material goes in engineering/. Navigation stays hand-authored (documentation.navOwner: hand-authored). A future QA or verification track, or a move to nav sync, needs a new decision.
