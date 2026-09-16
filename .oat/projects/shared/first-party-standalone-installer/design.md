---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-16
oat_generated: false
oat_template: false
oat_template_name: design
---

# Design: first-party-standalone-installer

## Overview

Extend the existing top-level installer with a strictly additive standalone-skill mode. Calling `install.sh` with no arguments retains the current Consensus recovery behavior byte-for-byte at the contract level. Calling it with `--skill`, `--agent`, and an explicit `--ref` selects the new path: resolve an exact tag from the configured Git repository, read only the generated `skills/<name>/` payload, and install it into the selected host's project-scoped skills directory.

The installer treats the destination as a new installation, not an update. It validates the source name, exact-tag resolution, payload boundary, and entry types before touching the host directory. It then records a complete source inventory of relative paths, modes, and SHA-256 hashes; copies into a same-parent staging directory; verifies the staged inventory; and publishes the installation by renaming the stage into a destination that was confirmed absent. Existing destinations are refused, which keeps failure recovery simple and prevents stale-file merges.

The verification claim is deliberately narrow. Exact-tag resolution pins the selected repository revision, and the inventory comparison proves that the installed payload matches that selected source. The command does not claim cryptographic authorship of the tag, independent release attestation, fresh-session discovery, or live provider behavior. Those live checks remain explicit release gates.

## Architecture

### System Context

The top-level `install.sh` remains the single first-party bootstrap surface. Argument dispatch separates two contracts before any filesystem mutation:

- no arguments call the existing Consensus recovery flow;
- standalone arguments call the new generated-payload flow.

The standalone flow uses Git as the only external acquisition boundary. It clones an exact tag from the default repository or an explicit `--repository` override, which also enables isolated local-fixture tests. It does not execute build tooling from the checkout and does not import the TypeScript distribution catalog at runtime. Eligibility is structural and fail-closed: a safe skill name must resolve to `skills/<name>/SKILL.md`; the command never searches or falls back to `src/skills/`.

**Key components:**

- **Argument dispatcher:** Preserves legacy zero-argument behavior and validates the standalone flag combination.
- **Pinned source resolver:** Checks out and verifies an exact tag into a temporary directory.
- **Payload validator:** Enforces confinement and regular-file/directory entry types and records a complete file inventory.
- **Host mapper:** Maps the explicit agent to a project-relative destination and invocation display.
- **Staged publisher:** Copies, re-inventories, compares, and renames an absent destination into place.

### Data Flow

```text
arguments
   |
   +-- none ----------------------> legacy Consensus installer
   |
   `-- --skill/--agent/--ref
          |
          v
   validate flags and destination absence
          |
          v
   clone + verify exact tag
          |
          v
   select skills/<name>/ only
          |
          v
   validate entries + inventory source
          |
          v
   copy to same-parent temporary directory
          |
          v
   inventory stage == source inventory
          |
          v
   rename stage to absent destination
          |
          v
   print installed path + host invocation name
```

## Component Design

### Argument Dispatcher

**Purpose:** Keep the Consensus recovery path backward compatible while exposing one explicit standalone mode.

**Responsibilities:**

- Route zero arguments directly to the existing behavior.
- Parse `--skill <name>`, `--agent <codex|claude-code|cursor>`, `--ref <tag>`, optional `--repository <git-url-or-path>`, and `--help`.
- Reject duplicates, unknown flags, missing values, unsafe skill names, and partial flag sets before installation work.
- Require Node.js 22 only where the preserved Consensus contract or installed runtime contract already requires it; do not add package dependencies.

### Pinned Source Resolver

**Purpose:** Materialize the selected repository revision without production-network assumptions in tests.

**Responsibilities:**

- Validate the tag with Git ref rules and reject option-like or revision-expression inputs.
- Clone the exact requested tag into a private temporary directory.
- Verify `refs/tags/<ref>^{commit}` exists after clone so a same-named branch is not accepted.
- Clean only the exact temporary directory created by this invocation.

### Payload Validator and Inventory

**Purpose:** Establish the complete source and copied payload identities.

**Responsibilities:**

- Resolve only `<checkout>/skills/<name>` and require its `SKILL.md`.
- Reject symlinks, sockets, devices, FIFOs, and other non-file/non-directory entries.
- Reject relative paths that cannot be represented safely in the inventory.
- Emit a deterministic sorted inventory of each regular file's relative path, permission mode, and SHA-256 hash.
- Compare source and staged inventories byte-for-byte.

Empty directories and directory permission modes are not part of the payload identity, matching the repository's current build inventory semantics.

### Host Mapper and Publisher

**Purpose:** Translate the explicit host into a confined project destination and publish a verified new install.

**Responsibilities:**

- Map Codex to `.agents/skills/<name>` and `$<name>`.
- Map Claude Code to `.claude/skills/<name>` and `/<name>`.
- Map Cursor to `.cursor/skills/<name>` and the unqualified installed name shown with inventory-selection guidance.
- Resolve the current working directory as the physical project root and reject symlinked destination ancestors.
- Refuse any existing destination, including a dangling symlink.
- Create a same-parent staging directory, preserve file modes during copy, verify the stage, and rename it into the absent destination.
- Remove only owned temporary paths on failure.

## API Design

```text
bash install.sh
bash install.sh --help
bash install.sh \
  --skill <standalone-name> \
  --agent <codex|claude-code|cursor> \
  --ref <exact-tag> \
  [--repository <git-url-or-local-path>]
```

`bash install.sh` remains the Consensus recovery command. Standalone installation requires all three primary flags; there is no implicit host, mutable branch default, global flag, source-directory flag, or force flag.

The default repository is the canonical Git repository. `--repository` changes only the Git origin used to resolve the exact tag; it does not allow a direct payload path and therefore cannot select `src/skills/`.

Success output includes the selected tag, final project-relative path, verification result, and host invocation name. Output must not imply fresh-session discovery.

## Error Handling

Validation and acquisition errors exit nonzero with an `install.sh:` prefix and no destination mutation. These include incomplete flags, invalid names, unsupported agents, invalid tags, missing tags, missing generated payloads, authored-source-only fixtures, unsafe entry types, symlinked destination ancestors, and existing destinations.

Copy and verification errors remove the owned staging directory and leave the final destination absent. Because the initial design refuses an existing destination before acquisition or staging, a failed run cannot modify a prior installation. This intentionally avoids claiming atomic overwrite semantics that portable rename cannot provide for a nonempty directory.

The command performs no automatic retry. Git/network failures are reported with the repository and tag context so the operator can retry deliberately.

## Testing Strategy

### Installer Behavior Tests

Extend the existing shell-installer coverage and add a focused tooling suite that uses temporary directories and a temporary local Git repository with lightweight tags. Execute the real `install.sh` process with isolated `HOME`, working directory, environment, stdout, and stderr.

Key scenarios:

- Zero arguments preserve Consensus checkout, remote, checksum, permission, and repeated-install behavior.
- Help, unknown flags, missing values, invalid skill names, unsupported agents, and partial standalone inputs do not create host directories.
- Each host mapping installs a small generated fixture and prints the expected invocation form.
- A generated executable fixture preserves its executable mode and runs outside the source checkout.
- Missing tag, missing generated skill, and a fixture containing only `src/skills/<name>` fail clearly.
- Symlink/special-entry payloads and symlinked destination ancestors are refused.
- An existing destination remains byte-for-byte unchanged.
- Copy or inventory mismatch failure leaves no final destination and cleans the owned staging path.

### Documentation and Contract Tests

Update the Installation page beside the Skills CLI path and extend release-contract assertions without weakening the separate Consensus recovery pin. Keep README quick-start wording and the provider plugin matrix untouched.

### Verification Layers

- Focused Vitest suites for the standalone installer, legacy installer, install contract, and README scope.
- Type checking, generated-output freshness, repository validation, and smoke tests.
- Documentation production build and local link checks for the changed guide.
- Full `pnpm run premerge` before handoff.
- No `test:live-e2e` or live host install/discovery in this implementation session; the release checklist records that evidence as pending separate authorization.

## References

- Discovery: `discovery.md`
- Backlog item: `.oat/repo/pjm/backlog/items/BL-260916-add-a-first-party-install.md`
- Kickoff handoff: `.oat/repo/pjm/handoffs/BL-260916-add-a-first-party-install.md`
