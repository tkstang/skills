---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-16
oat_generated: false
oat_template: true
oat_template_name: design
---

# Design: first-party-standalone-installer

## Overview

Extend the existing top-level installer with a strictly additive standalone-skill mode. Calling `install.sh` with no arguments retains the current Consensus recovery behavior byte-for-byte at the contract level. Calling it with `--skill`, `--agent`, and an explicit `--ref` selects the new path: resolve an exact tag from the configured Git repository, read only the generated `skills/<name>/` payload, and install it into the selected host's project-scoped skills directory.

The installer treats the destination as a new installation, not an update. It validates the source name, exact-tag resolution, payload boundary, and entry types before touching the host directory. It then records a complete source inventory of relative paths, modes, and SHA-256 hashes; copies into a same-parent staging directory; verifies the staged inventory; and publishes the installation by renaming the stage into a destination that was confirmed absent. Existing destinations are refused, which keeps failure recovery simple and prevents stale-file merges.

The verification claim is deliberately narrow. Exact-tag resolution pins the selected repository revision, and the inventory comparison proves that the installed payload matches that selected source. The command does not claim cryptographic authorship of the tag, independent release attestation, fresh-session discovery, or live provider behavior. Those live checks remain explicit release gates.

## Architecture

_Pending collaborative review._

## Component Design

_Pending collaborative review._

## API Design

_Pending collaborative review._

## Error Handling

_Pending collaborative review._

## Testing Strategy

_Pending collaborative review._

## References

- Discovery: `discovery.md`
- Backlog item: `.oat/repo/pjm/backlog/items/BL-260916-add-a-first-party-install.md`
- Kickoff handoff: `.oat/repo/pjm/handoffs/BL-260916-add-a-first-party-install.md`
