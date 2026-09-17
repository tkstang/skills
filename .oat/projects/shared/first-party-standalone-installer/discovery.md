---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-09-16
oat_generated: false
---

# Discovery: first-party-standalone-installer

## Initial Request

Add a first-party command that installs any declared generated standalone skill from an explicit pinned release tag into the selected host's explicit project or user scope. Preserve the existing zero-argument Consensus recovery installer, verify the complete copied payload, print the host invocation name, and document both this path and the existing third-party Skills CLI path.

The kickoff handoff selects quick mode with a lightweight design focused on source identity, destination scope, refusal, and partial-failure boundaries.

## Existing Prior Art

The sibling `tkstang/personal-skills` repository already solves most installer mechanics:

- `install.ts` selects generated payloads, inventories paths/hashes/executable modes, accepts an explicit destination, refuses unowned or modified targets, and exposes a small filesystem-operation seam for failure tests;
- `external/git-source.ts` resolves pinned Git sources through a private bare repository and reads bounded tree objects without executing the selected source;
- `docs/installation.md` demonstrates the same installer against user, vault, and project destinations.

The public installer should adapt the smallest dependency-free subset of those patterns. It must not take a runtime dependency on the private repository, and it does not need that repository's receipts, update, status, uninstall, external-registry, or provenance lifecycle.

## Solution Space

### Approach 1: Adapt the proven installer core behind `install.sh` _(Chosen)_

Keep the existing no-argument Consensus installation contract unchanged and activate standalone installation when standalone flags are present. Delegate to a dependency-free Node.js 22 helper that narrows the proven pinned-Git, inventory, explicit-destination, and injectable-filesystem patterns to public `skills/<name>/` payloads.

This is the best fit because it preserves the documented bootstrap surface while avoiding a second installer design. Only the public delivery delta is new: exact release tags from `tkstang/skills`, host/scope mapping, invocation guidance, and operation without `pnpm install` or `tsx`.

### Approach 2: Greenfield transactional installer

Build staging, recovery, race checkpoints, and an adversarial concurrency matrix specifically for this repository. This can be made correct, but it duplicates proven behavior and exceeds the backlog contract's new-install-only scope.

### Approach 3: Commit a release manifest and installer runtime

Generate a catalog with per-file hashes and install through a dedicated runtime. This gives stronger release metadata but expands the generated-output contract and build pipeline beyond the current item. It remains a possible follow-up if independently attested release manifests are needed.

## Chosen Direction

**Approach:** Adapt the proven direct-installer and pinned-Git patterns behind the existing `install.sh` entrypoint.

**Rationale:** The hard filesystem and inventory problems are already solved locally. The implementation should concentrate on the genuinely new public bootstrap contract and keep one small dependency-free helper.

**User validated:** Yes — the user explicitly approved revising the project around the existing `personal-skills` implementation and supporting both user and project scope.

## Key Decisions

1. **CLI activation:** Zero arguments continue to install the Consensus provider CLI exactly as today. Standalone mode requires explicit `--skill`, `--agent`, `--scope`, and `--ref`; malformed or mixed inputs fail before modifying a destination.
2. **Explicit scope:** `--scope` is required and accepts only `project` or `user`. There is no default, so a user-level mutation cannot happen implicitly.
3. **Pinned source:** `--ref` must resolve to an exact tag in the configured repository. Tests point the same mechanism at a temporary local Git repository; production networking is not required by the unit suite.
4. **Payload boundary:** Only the generated `skills/<name>/` directory is eligible. The installer never falls back to `src/skills/`, recursive discovery, plugin payloads, or historical compatibility names.
5. **Destination mapping:** Project scope resolves beneath the physical current directory; user scope resolves beneath `HOME`. Codex uses `.agents/skills/`, Claude Code uses `.claude/skills/`, and Cursor uses `.cursor/skills/`. The installer writes only the selected provider view and does not run `oat sync` or create cross-provider mirrors.
6. **Invocation output:** Print `$<name>` for Codex, `/<name>` for Claude Code, and the installed skill name with Cursor inventory guidance for Cursor.
7. **Existing destination:** Refuse any existing destination. The initial public feature has no update, force, merge, adopt, prune, uninstall, or automatic rollback mode.
8. **Integrity semantics:** Resolve the exact tag in a private bare Git repository, accept only regular-file Git modes under `skills/<name>/`, compute a deterministic path/mode/SHA-256 inventory, reserve the absent destination with exclusive `mkdir`, mark it incomplete, create every payload entry without overwriting, verify the installed inventory, and remove the marker only on success. A post-reservation failure leaves the marked partial directory for explicit recovery.
9. **Test seam:** Use a small programmatic filesystem-operations object, following `personal-skills`, to inject one mid-copy failure. Do not ship an environment-driven checkpoint or timing protocol.
10. **Git environment confinement:** Every Git subprocess receives an environment with the complete inherited `GIT_*` namespace removed before deliberate noninteractive overrides are added.
11. **Authenticity wording:** An exact tag and Git transport establish which repository revision was selected. Inventory comparison proves copy fidelity. The feature does not claim signed-tag verification or independent release attestation.
12. **Acceptance boundary:** Automated fixtures prove installer behavior and payload fidelity. Real user-home mutation, fresh host discovery, and bounded invocation remain separate, explicitly authorized release checks.

## Constraints

- Keep shipped runtime dependency-free and compatible with Node.js 22 or newer.
- Preserve all current Consensus installer environment overrides, target path, default `v0.1.2` pin, optional checksum behavior, and local-checkout preference for the zero-argument path.
- Use temporary directories, a temporary `HOME`, and local Git fixtures for deterministic tests; do not require production networking or paid/live provider calls.
- Use `https://github.com/tkstang/skills.git` as the explicit default repository URL and keep it pinned by contract tests.
- Keep the canonical installation guide and release checklist accurate without changing the plugin install matrix.
- Do not mutate the real user-level installation, publish a release, push a branch, open a PR, or run live provider acceptance without separate authority.
- Do not edit generated skill payloads or canonical skill owners for installer fixtures; therefore no skill version bump is expected.

## Success Criteria

- An exact tag and declared generated standalone skill install into every supported host mapping at explicit project and user scope.
- The complete payload's paths, bytes, and executable modes are verified before success is reported.
- Missing tags, branch-only refs, missing skills, malformed names, source-tree-only fixtures, symlinks, and existing destinations fail clearly without damaging an installation.
- One injected write failure leaves a marked partial new installation and never changes a pre-existing destination.
- The existing zero-argument Consensus installation behavior and contract tests remain green.
- The installation guide presents project and user first-party procedures beside the Skills CLI path and distinguishes static copy verification from live host acceptance.
- The release checklist calls for authorized live first-party install, discovery, and bounded invocation evidence for every advertised host and scope.
- Scoped tests require no network and never touch the real home directory.

## Out of Scope

- Updating, force-replacing, merging, adopting, pruning, inspecting, or uninstalling an existing installation.
- Ownership receipts or external-source provenance registries.
- Cross-provider symlink/mirror management or invoking `oat sync`.
- Automatic installation of required or optional sibling skills.
- Signed-tag enforcement or a new independently attested release manifest.
- Plugin installation or changes to the provider plugin matrix.
- Live provider discovery/invocation, real user-home installation, publishing, tagging, pushing, or PR creation in this work session.

## Deferred Ideas

- **Managed update lifecycle:** Add receipts, status, safe replacement, and uninstall only if the public installer needs ongoing ownership rather than one-time installation.
- **Release manifest:** Generate per-file release attestations if independent source authenticity becomes a release requirement.
- **Catalog command:** Expose declared standalone names directly if users need discovery rather than installation of a known skill.

## Open Questions

None blocking.

## Assumptions

- Release tags contain build-validated committed `skills/<name>/` payloads.
- Git is an acceptable external boundary for resolving an exact tag; no package installation is required.
- Direct provider-specific user destinations are sufficient for this installer; canonical cross-provider mirroring remains owned by existing sync workflows.

## Risks

- **Docs contract collision:** The existing Consensus test assumes exactly one raw `install.sh` URL in the installation guide.
  - **Likelihood:** High
  - **Impact:** Medium
  - **Mitigation:** Keep the first-party example checkout-based or deliberately scope the legacy assertion to the Consensus recovery section while retaining its immutable-pin check.
- **Partial new installation:** A filesystem failure after exclusive reservation can leave an incomplete destination.
  - **Likelihood:** Low
  - **Impact:** Medium
  - **Mitigation:** Write an incomplete marker first, create entries without overwriting, verify before removing the marker, and report the recovery path without recursive automatic cleanup.
- **Overstated verification:** Copy hashes could be described as proof of upstream authenticity.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation:** Document exact-tag resolution, transport trust, and copy-fidelity guarantees separately.

## Next Steps

Keep the lightweight design and plan aligned to the reused patterns, then continue through `oat-project-implement` without another pre-implementation gate cycle unless the user explicitly requests one.
