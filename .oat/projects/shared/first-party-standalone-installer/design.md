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

Extend the existing top-level installer with a strictly additive standalone-skill mode. Calling `install.sh` with no arguments retains the current Consensus recovery behavior at the contract level. Calling it with `--skill`, `--agent`, `--scope`, and an explicit `--ref` delegates to a dependency-free Node.js 22 helper that resolves an exact tag, reads only the generated `skills/<name>/` payload, and installs it into the selected host and scope.

This design adapts two proven patterns from the sibling `tkstang/personal-skills` repository: bounded pinned-Git object inspection and an inventory-driven direct installer with a small injectable filesystem seam. It deliberately does not port that repository's update receipts, provenance registry, status, uninstall, or multi-skill lifecycle.

The public installer supports new installations only. It inventories the tagged source, resolves the selected provider destination beneath either the physical current project or `HOME`, exclusively reserves the absent final directory, writes an incomplete marker, creates payload entries without overwrite-capable operations, verifies the installed inventory, and removes the marker only on success. A post-reservation failure leaves a clearly marked partial directory for deliberate recovery.

The verification claim is narrow. Exact-tag resolution pins the selected repository revision, and inventory comparison proves that the installed payload matches that selected source. The command does not claim cryptographic authorship of the tag, independent release attestation, fresh-session discovery, or live provider behavior.

## Architecture

### System Context

The top-level `install.sh` remains the single first-party bootstrap surface:

- no arguments call the existing Consensus recovery flow;
- standalone arguments call `scripts/install-standalone.mjs` through Node.js 22.

The standalone helper uses Git as the only external acquisition boundary. It fetches the fully qualified tag from `https://github.com/tkstang/skills.git` or an explicit `--repository` override into a private bare repository. It reads the selected tree and blobs without executing builds, filters, hooks, submodules, or code from the source. Every Git subprocess receives a clean environment with inherited `GIT_*` variables removed before deliberate noninteractive values are added.

Eligibility is structural and fail-closed: a safe skill name must resolve to `skills/<name>/SKILL.md`, and every selected Git entry must be a regular file with mode `100644` or `100755`. The helper never searches or falls back to `src/skills/`.

**Key components:**

- **Argument dispatcher:** Preserves legacy zero-argument behavior and delegates standalone arguments to the adjacent helper.
- **Standalone helper:** Owns argument validation, scope/host mapping, Git acquisition, inventory, publication, and output.
- **Pinned source reader:** Fetches and peels one exact tag in a private bare repository, then reads bounded tree objects.
- **Payload inventory:** Records each file's safe relative path, executable mode, bytes, and SHA-256 digest.
- **Destination resolver:** Maps the explicit host and scope to one provider-specific skills directory.
- **Exclusive publisher:** Reserves an absent destination, marks it incomplete, writes without overwriting, verifies, and publishes by removing the marker.

### Data Flow

```text
arguments
   |
   +-- none ----------------------> legacy Consensus installer
   |
   `-- --skill/--agent/--scope/--ref
          |
          v
   validate flags and resolve destination
          |
          v
   fetch refs/tags/<ref> into private bare repo
          |
          v
   peel tag + read skills/<name>/ tree and blobs
          |
          v
   validate entries + build source inventory
          |
          v
   validate/create provider parent directory
          |
          v
   exclusively mkdir absent destination
          |
          v
   add marker + write payload entries exclusively
          |
          v
   verify destination inventory
          |
          v
   remove marker + print path and invocation
```

## Component Design

### Argument Dispatcher

**Responsibilities:**

- Route zero arguments directly to the existing Consensus behavior.
- Route any standalone arguments to the adjacent helper.
- Fail clearly when standalone mode is invoked from a copied or streamed shell script without the adjacent helper.
- Require Node.js 22 and add no package dependencies.

### Standalone Helper and Destination Resolver

Parse:

- `--skill <name>`
- `--agent <codex|claude-code|cursor>`
- `--scope <project|user>`
- `--ref <exact-tag>`
- optional `--repository <git-url-or-local-path>`
- `--help`

All four primary flags are required. There is no default scope, mutable ref, global alias, force flag, or direct source-directory option.

Destination roots:

| Agent | Project scope | User scope | Invocation |
| --- | --- | --- | --- |
| Codex | `<physical-cwd>/.agents/skills/<name>` | `$HOME/.agents/skills/<name>` | `$<name>` |
| Claude Code | `<physical-cwd>/.claude/skills/<name>` | `$HOME/.claude/skills/<name>` | `/<name>` |
| Cursor | `<physical-cwd>/.cursor/skills/<name>` | `$HOME/.cursor/skills/<name>` | installed name plus inventory guidance |

The helper writes only the selected provider destination. It does not create provider mirrors, symlinks, plugin state, or run `oat sync`.

### Pinned Source Reader

The resolver is a narrowed dependency-free adaptation of `personal-skills/scripts/external/git-source.ts`:

- validate safe repository and tag arguments;
- create a private temporary bare repository;
- fetch only `refs/tags/<ref>` with tags otherwise disabled;
- peel `FETCH_HEAD^{commit}` and use that commit for every subsequent read;
- list only `skills/<name>/` with `git ls-tree`;
- reject symlinks, gitlinks, unsupported modes, unsafe paths, and a missing `SKILL.md`;
- read blobs with `git cat-file`, preserving executable mode and computing SHA-256 over the bytes;
- remove only the exact temporary repository created by this invocation.

All Git calls use argv arrays and an environment constructed by removing every inherited key beginning with `GIT_`, then adding deliberate noninteractive controls. The implementation passes the private `--git-dir` explicitly.

### Payload Inventory

The deterministic inventory contains every selected regular file:

```text
relative-path -> { sha256, executable }
```

Directories are derived from file paths. Empty directories are not part of the payload identity, matching Git's tree semantics and the repository's generated-output contract. Source entries named `.standalone-install-incomplete` are rejected because the name is reserved for publication state.

### Exclusive Publisher

After the complete source has been read and inventoried:

1. Resolve the selected project or user root physically and refuse unsafe or symlinked provider ancestors.
2. Create missing provider parent components one at a time, accepting an `EEXIST` race only after `lstat` confirms a real directory.
3. Refuse any existing final destination, including a dangling symlink.
4. Reserve the final destination with exclusive `mkdir` and immediately create `.standalone-install-incomplete`.
5. Create required directories parent-first and open each file with Node `wx`; write bytes and apply the executable/non-executable mode through the held descriptor.
6. Re-inventory the destination while ignoring only the marker and require exact equality with the source inventory.
7. Remove the marker and report success.

If any operation fails after reservation, retain the marked destination and report its exact path. Never recursively delete the final directory: it is safer to preserve an incomplete new installation for inspection than to guess which entries remain owned after failure. Cleanup is limited to the private bare Git repository.

The module exports a small `fileOperations` object, following the `personal-skills` test pattern, so a direct unit test can inject one deterministic mid-write failure. The CLI has no environment-driven failure mode or checkpoint protocol.

## API Design

```text
bash install.sh
bash install.sh --help
bash install.sh \
  --skill <standalone-name> \
  --agent <codex|claude-code|cursor> \
  --scope <project|user> \
  --ref <exact-tag> \
  [--repository <git-url-or-local-path>]
```

`bash install.sh` remains the Consensus recovery command. `--repository` changes only the Git origin used to resolve the exact tag; it cannot select an arbitrary payload directory.

Success output includes the selected tag, scope, final path, verification result, and host invocation name. It must not imply fresh-session discovery.

## Error Handling

Argument, acquisition, and source-validation errors exit nonzero with an `install.sh:` prefix and do not create a skill destination. These include incomplete flags, invalid names, unsupported agents/scopes, invalid or missing tags, branch-only refs, missing generated payloads, authored-source-only fixtures, unsafe Git entries, symlinked destination ancestors, and existing destinations.

After destination reservation, errors leave `.standalone-install-incomplete` in place and identify the recovery path. Subsequent installs refuse the existing directory. There is no automatic retry, deletion, adoption, or replacement.

## Testing Strategy

Use temporary project roots, temporary `HOME` directories, and temporary local Git repositories. No production networking or real user installation is required.

Keep the suite proportional and table-driven:

1. Existing zero-argument Consensus checkout, remote, checksum, permission, and repeated-install tests remain green.
2. One tagged multi-file fixture covers bytes, executable mode, all three host mappings, both explicit scopes, and invocation output.
3. A compact argument table covers help and representative missing, unknown, and invalid values.
4. A source-refusal table covers missing tag, branch-only ref, missing generated skill, `src/skills`-only fixture, unsafe name, unsupported Git entry, and reserved marker.
5. One annotated tag sharing a name with a different branch proves the qualified tag is selected.
6. One inherited-`GIT_*` decoy test proves acquisition uses the intended temporary repository and leaves the decoy unchanged.
7. One existing-destination test proves byte-for-byte preservation.
8. One symlinked-ancestor test proves destination confinement.
9. One direct publisher test injects a mid-write failure through `fileOperations` and proves a marked partial directory remains.
10. One missing-helper process test verifies checkout guidance without host-directory mutation.

Documentation contract coverage belongs in the existing `src/plugins/consensus/install-contract.test.ts` unless implementation shows a separate stable contract file is materially clearer. Do not add a second documentation test merely to mirror prose.

## Verification Layers

- Focused standalone, legacy installer, and installation-contract tests.
- Type checking, changed-file lint/format, generated-output freshness, repository validation, and smoke tests.
- Documentation production build.
- Full `pnpm run premerge` before handoff.
- No live provider install/discovery/invocation or real user-home mutation without separate authorization.

## References

- Discovery: `discovery.md`
- Backlog item: `.oat/repo/pjm/backlog/items/BL-260916-add-a-first-party-install.md`
- Kickoff handoff: `.oat/repo/pjm/handoffs/BL-260916-add-a-first-party-install.md`
- Prior-art installer: `tkstang/personal-skills` `scripts/install.ts`
- Prior-art pinned source reader: `tkstang/personal-skills` `scripts/external/git-source.ts`
