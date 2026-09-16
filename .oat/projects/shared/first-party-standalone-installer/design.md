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

The installer treats the destination as a new installation, not an update. It validates the source name, exact-tag resolution, payload boundary, and entry types before touching the host directory. It then records a complete source inventory of relative paths, modes, and SHA-256 hashes; copies into a same-parent staging directory; verifies the staged inventory; and atomically reserves the final name with an exclusive `mkdir`. Only after acquiring that absent path does it add a reserved installer marker, populate the directory, verify the payload while ignoring only that marker, and remove the marker to publish success. Existing or concurrently created destinations are refused. A post-reservation failure leaves the marked partial directory for explicit recovery rather than recursively deleting a path that concurrent activity may have altered.

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
- **Staged publisher:** Copies, re-inventories, compares, exclusively reserves the absent destination, and publishes only after marked population verifies.

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
   fetch qualified tag + detach at peeled commit
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
   atomically mkdir absent destination
          |
          v
   add marker + populate + verify destination
          |
          v
   remove marker and report success
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
- Fetch only the fully qualified `refs/tags/<ref>` into a private temporary repository.
- Peel the fetched tag to a commit, check out that commit detached, and require `HEAD` to equal the peeled commit before reading payload bytes.
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
- Refuse any existing destination, including a dangling symlink, during preflight.
- Create a same-parent staging directory, preserve file modes during copy, and verify the stage.
- Re-check destination ancestors immediately before publication, then atomically reserve the final path with exclusive `mkdir`; failure means a concurrent directory or symlink won and must be preserved unchanged.
- Reject a source payload that already contains the reserved installer marker name.
- Add the marker immediately after exclusive reservation. Create payload directories in deterministic parent-first order and require each `mkdir` to acquire a previously absent path. Create each payload file through Bash noclobber redirection before writing bytes and applying its declared mode; never use an overwrite-capable copy into the final directory.
- Verify the complete destination inventory while excluding only the marker, and remove the marker only after verification succeeds.
- On post-reservation copy or verification failure, preserve the marked partial directory and report its exact recovery path. Never recursively delete the final path, because concurrent content or path replacement cannot be proven to belong to this invocation.
- Remove owned staging and checkout paths on failure; never clean a destination whose exclusive reservation was not acquired by this process.

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

Copy and staging-verification errors remove the owned staging directory and leave the final destination absent. Publication uses `mkdir <destination>` as the atomic no-clobber reservation. If that fails, the installer preserves the competing directory or symlink unchanged. After reservation, the installer writes a reserved marker, creates every payload directory and file with no-clobber semantics, and verifies the payload while excluding only the marker. A competing entry at any payload path therefore fails instead of being overwritten. If population or final verification fails, the installer cleans the checkout and stage but deliberately leaves the marked partial destination with a recovery error. It never recursively removes the final path, because a concurrent writer or path replacement would make ownership ambiguous. Success removes the marker only after payload verification.

The command performs no automatic retry. Git/network failures are reported with the repository and tag context so the operator can retry deliberately.

## Testing Strategy

### Installer Behavior Tests

Extend the existing shell-installer coverage and add a focused tooling suite that uses temporary directories and a temporary local Git repository with lightweight tags. Execute the real `install.sh` process with isolated `HOME`, working directory, environment, stdout, and stderr.

Key scenarios:

- Zero arguments preserve Consensus checkout, remote, checksum, permission, and repeated-install behavior.
- Help, unknown flags, missing values, invalid skill names, unsupported agents, and partial standalone inputs do not create host directories.
- Each host mapping installs a small generated fixture and prints the expected invocation form.
- A generated executable fixture preserves its executable mode and runs outside the source checkout.
- Missing tag, branch-only ref, missing generated skill, and a fixture containing only `src/skills/<name>` fail clearly.
- Annotated tags work, and a same-named branch/tag fixture with different payload bytes installs the peeled tag commit's bytes.
- Symlink/special-entry payloads and symlinked destination ancestors are refused.
- Existing destinations remain byte-for-byte unchanged, including deterministic races that create a directory or symlink after preflight but before exclusive reservation.
- A source payload using the reserved marker name is rejected.
- Competing directories or files created after reservation are never overwritten; deterministic fixtures assert that their bytes survive.
- Copy or inventory mismatch after reservation leaves a clearly marked partial destination, preserves concurrent additions or a replacement path, cleans only checkout/staging paths, and causes subsequent installs to refuse the existing path.

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
