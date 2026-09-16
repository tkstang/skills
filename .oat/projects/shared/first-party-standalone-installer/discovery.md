---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-09-16
oat_generated: false
---

# Discovery: first-party-standalone-installer

## Initial Request

Add a first-party command that installs any declared generated standalone skill from an explicit pinned release tag into the selected host's project-scoped skills directory. Preserve the existing zero-argument Consensus recovery installer, verify the complete copied payload, print the host invocation name, and document both this path and the existing third-party Skills CLI path.

The kickoff handoff selects quick mode with a lightweight design focused on integrity, destination, refusal, and partial-failure boundaries.

## Solution Space

### Approach 1: Additive mode in the existing installer _(Chosen)_

Keep the existing no-argument Consensus installation contract unchanged and activate standalone installation only when `--skill` is present. The shell entrypoint delegates standalone arguments to a dependency-free Node.js 22 helper, which resolves an exact tag into a temporary checkout, selects only `skills/<name>/`, stages and verifies its complete inventory, then publishes it into the host's project-scoped directory with true exclusive filesystem opens.

This is the best fit because the repository already documents `install.sh`, compatibility can be mechanically tested, and the feature remains dependency-free while using Node standard-library primitives for safe publication.

### Approach 2: Separate standalone installer

Create a second top-level command dedicated to standalone skills. This gives the new contract a clean surface, but duplicates bootstrap documentation and leaves users to distinguish two first-party installers.

### Approach 3: Commit a release manifest and installer runtime

Generate a catalog with per-file hashes and install through a dedicated runtime. This gives stronger release metadata but expands the generated-output contract and build pipeline beyond the small backlog item. It remains a possible follow-up if independently attested release manifests are needed.

### Chosen Direction

**Approach:** Additive mode in the existing installer.

**Rationale:** It preserves the established Consensus entrypoint, meets the first-party requirement with a small durable surface, and can verify copy fidelity without package dependencies or a second catalog.

**User validated:** Yes — the supplied handoff explicitly chose a focused quick project and required preservation of the Consensus-wrapper contract.

## Key Decisions

1. **CLI activation:** Zero arguments continue to install the Consensus provider CLI exactly as today. Standalone mode requires explicit `--skill`, `--agent`, and `--ref`; malformed or mixed inputs fail before modifying a destination.
2. **Pinned source:** `--ref` must resolve to an exact tag in the configured repository. Tests may point the same mechanism at a temporary local Git repository; production networking is not required by the unit suite.
3. **Payload boundary:** Only the generated `skills/<name>/` directory is eligible. The installer never falls back to `src/skills/`, recursive skill discovery, plugin payloads, or historical compatibility names.
4. **Project destinations:** Install beneath the selected project's host directory: `.agents/skills/` for Codex, `.claude/skills/` for Claude Code, and `.cursor/skills/` for Cursor.
5. **Invocation output:** Print `$<name>` for Codex, `/<name>` for Claude Code, and the installed skill name with Cursor inventory guidance for Cursor.
6. **Existing destination:** Refuse an existing destination. The initial feature has no force/merge mode, avoiding stale files and non-atomic replacement semantics.
7. **Integrity semantics:** Reject symlinks and non-regular payload entries; inventory every file by relative path, mode, and SHA-256; copy into a same-parent staging directory; verify the staged inventory; atomically reserve the absent destination with exclusive directory creation; mark it; populate directories with exclusive creation and files through Node `wx` descriptors retained for writing and permission changes; verify the result; and remove the marker only on success. A post-reservation failure leaves the marked partial directory for explicit recovery instead of overwriting or recursively deleting content whose identity may have changed.
8. **Authenticity wording:** An exact tag and Git transport establish which repository revision was selected. Inventory comparison proves copy fidelity. The feature does not claim signed-tag verification or independent release attestation.
9. **Skill dependencies:** Required sibling workflows remain explicit prerequisites and are not silently installed.
10. **Acceptance boundary:** Automated fixtures prove installer behavior and payload fidelity. Fresh host discovery and bounded invocation remain separate, explicitly authorized release checks.

## Constraints

- Keep shipped runtime dependency-free and compatible with Node.js 22 or newer.
- Preserve all current Consensus installer environment overrides, target path, default `v0.1.2` pin, optional checksum behavior, and local-checkout preference for the zero-argument path.
- Use temporary directories and local Git fixtures for deterministic tests; do not require production networking or paid/live provider calls.
- Keep the canonical installation guide and release checklist accurate without changing the plugin install matrix.
- Do not install globally, publish a release, push a branch, open a PR, or run live provider acceptance without separate authority.
- Do not edit generated skill payloads or canonical skill owners for installer fixtures; therefore no skill version bump is expected.

## Success Criteria

- An explicit pinned tag and declared generated standalone skill install into the selected host's project-scoped directory.
- The complete payload's paths, bytes, and executable modes are verified before publication.
- Missing tags, missing skills, unsupported hosts, malformed names, source-tree attempts, symlinks, special files, and existing destinations fail clearly without damaging an installation.
- The existing zero-argument Consensus installation behavior and contract tests remain green.
- The installation guide presents the first-party procedure beside the Skills CLI procedure and distinguishes static copy verification from live host acceptance.
- The release checklist calls for live first-party install, discovery, and bounded invocation evidence for every advertised host.
- Scoped tests use temporary local fixtures and require no network.

## Out of Scope

- Global/user-scope installation.
- In-place updates, force replacement, merging, or automatic rollback of an overwritten installation.
- Automatic installation of required or optional sibling skills.
- Signed-tag enforcement or a new independently attested release manifest.
- Plugin installation or changes to the provider plugin matrix.
- Live provider discovery/invocation, publishing, tagging, pushing, or PR creation in this work session.

## Deferred Ideas

- **Release manifest:** Generate per-file release attestations if independent source authenticity becomes a release requirement.
- **Safe update mode:** Add an explicit replacement workflow only with a separately designed backup/rollback contract.
- **Catalog command:** Expose declared standalone names directly if users need discovery rather than an install of a known skill.

## Open Questions

None blocking. The lightweight design will pin the exact staging and error-handling sequence and the tests that exercise it.

## Assumptions

- The project-scoped host directories already used by this repository are the intended first-party destinations.
- Release tags contain build-validated committed `skills/<name>/` payloads.
- Git is an acceptable external boundary for resolving and checking out an exact tag; no package installation is required.

## Risks

- **Docs contract collision:** The existing Consensus test assumes exactly one raw `install.sh` URL in the installation guide.
  - **Likelihood:** High
  - **Impact:** Medium
  - **Mitigation:** Keep the first-party example checkout-based or deliberately scope the legacy assertion to the Consensus recovery section while retaining its immutable-pin check.
- **Partial copy or traversal:** A malformed payload or racing destination could escape, overwrite competing content, or leave a partial destination.
  - **Likelihood:** Low
  - **Impact:** High
  - **Mitigation:** Validate names and entry types, stage beside the destination, compare complete inventories, acquire the final path only through atomic exclusive directory creation, and never recursively clean the final path after reservation; retain a marker and report explicit recovery instead.
- **Overstated verification:** Copy hashes could be described as proof of upstream authenticity.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation:** Document exact-tag resolution, transport trust, and copy-fidelity guarantees separately.

## Next Steps

Produce the handoff-selected lightweight design, generate and review the executable plan, then continue through `oat-project-implement` without pausing at ordinary task or phase boundaries.
