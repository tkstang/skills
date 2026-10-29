# Release CI references for session toolkit

Inspected 2026-10-29 UTC through read-only reconnaissance. No changes were made to donor repositories, publication credentials, registry settings, or trusted-publisher configuration.

## Evidence boundary

- Exhibit: `/Users/tstang/Code/exhibit`, commit `40687f9074f65443a020275ee97b1164d04dda70`.
- Open Agent Toolkit: `/Users/tstang/Code/open-agent-toolkit`, commit `56f864ae0c3b070b8fb227e97983caab3c062fdf` (upstream `voxmedia/open-agent-toolkit`).
- Foundations: `conventions/git-ci-release.md`, especially the library release flow and standalone-library versioning exception, as already referenced by the toolkit brainstorm.
- A read-only recon worker compared the two release processes. The root independently reopened the Node declarations, publish workflows, archive verification, and packed dependency checks below. These findings describe configuration; they do not establish publish rights for the new package.

## Recommended reuse

**Exhibit supplies the single-package release shape.** Its release workflow runs on `v*` tags, with a manual rerun path for an existing tag. The validation job builds and validates a release archive, then uploads it. The publish job downloads and publishes that exact archive rather than rebuilding. Publishing permissions are confined to that job, behind the `npm` environment and a release-enable variable.

Sources: [release workflow, lines 1–64](https://github.com/tkstang/exhibit/blob/40687f9074f65443a020275ee97b1164d04dda70/.github/workflows/release.yml#L1), [preparation, lines 59–103](https://github.com/tkstang/exhibit/blob/40687f9074f65443a020275ee97b1164d04dda70/tools/release/prepare.ts#L59), [publication validation, lines 19–41](https://github.com/tkstang/exhibit/blob/40687f9074f65443a020275ee97b1164d04dda70/tools/release/publish.ts#L19).

Its archive smoke test installs into a temporary prefix and invokes installed binaries. Adapt the pattern for `seshtk --version`, machine-readable capabilities, a representative session operation using controlled fixtures, and a public-library import outside the repository. Validate that npm contents exclude local state and private material. An existing published version is a successful recovery only when its registry integrity matches the validated archive.

Sources: [package checks and installed smoke, lines 76–138](https://github.com/tkstang/exhibit/blob/40687f9074f65443a020275ee97b1164d04dda70/tools/packaging/package.ts#L76), [registry decision, lines 93–105](https://github.com/tkstang/exhibit/blob/40687f9074f65443a020275ee97b1164d04dda70/tools/release/contracts.ts#L93).

**OAT supplies the workspace publication checks.** Its validator reads the actual packed `package.json` and file inventory. It rejects unresolved `workspace:` dependency specifications and dependencies on non-public workspace package names. Check both: packing can rewrite a protocol while retaining an unusable private dependency name.

Sources: [reading packed metadata, lines 186–217](https://github.com/voxmedia/open-agent-toolkit/blob/56f864ae0c3b070b8fb227e97983caab3c062fdf/tools/release/validate-public-packages.ts#L186), [validation inputs, lines 294–314](https://github.com/voxmedia/open-agent-toolkit/blob/56f864ae0c3b070b8fb227e97983caab3c062fdf/tools/release/validate-public-packages.ts#L294), [dependency rejection, lines 353–362](https://github.com/voxmedia/open-agent-toolkit/blob/56f864ae0c3b070b8fb227e97983caab3c062fdf/tools/release/validate-public-packages.ts#L353).

## Consumer Node version and CI Node version are separate

OAT's CLI declares `node >=22.17.0`. Its release workflow explicitly runs Node 24 because the publication job needs that npm runtime. Therefore, adopting its release pattern does not imply a Node 24 minimum for toolkit users. Exhibit declares Node >=24 for its own consumers; that is its package decision rather than an inherent publishing requirement.

Sources: [OAT consumer engines, lines 72–73](https://github.com/voxmedia/open-agent-toolkit/blob/56f864ae0c3b070b8fb227e97983caab3c062fdf/packages/cli/package.json#L72), [OAT release runtime, lines 88–95](https://github.com/voxmedia/open-agent-toolkit/blob/56f864ae0c3b070b8fb227e97983caab3c062fdf/.github/workflows/release.yml#L88), [Exhibit engines, lines 109–112](https://github.com/tkstang/exhibit/blob/40687f9074f65443a020275ee97b1164d04dda70/package.json#L109).

The user selected support for Node 22 and 24. Validate the chosen dependencies and built artifact against both, and use Node 24 for release tooling. Select an exact supported Node 22 patch floor from actual code and dependency requirements.

## Bootstrap and trusted publishing

Both donors use npm trusted publishing through GitHub OIDC. The toolkit requires its own trusted-publisher identity for the Skills repository, package, workflow, and any configured environment. Existing donor trust does not carry over. Exhibit documents a maintainer first-publish bootstrap using the validated tarball, followed by trusted-publisher setup and automation enablement. Verify current npm bootstrap requirements and account rights before execution; request any necessary secret through the host secret mechanism.

Sources: [Exhibit bootstrap documentation, lines 84–145](https://github.com/tkstang/exhibit/blob/40687f9074f65443a020275ee97b1164d04dda70/docs/engineering/releases.md#L84), [publish-job permissions](https://github.com/tkstang/exhibit/blob/40687f9074f65443a020275ee97b1164d04dda70/.github/workflows/release.yml#L39).

## Keep the adaptation small

Use one independently versioned package and curated changelog, with validation-only CI, a publication dry run, and publication of the validated release artifact. Keep existing skill and plugin release versions independent. The precise tag namespace must coexist with current Skills release tags and is a package-establishment decision.

Do not copy OAT's five-package lockstep coordinator, Turbo, docs deployments, or Exhibit-specific browser/Terraform checks. Cross-OS consumer smoke checks can be selected based on toolkit behavior; byte-identical cross-OS archive comparisons are not a requirement of this proposal.

## Publication evidence reported by reconnaissance

Anonymous registry reads returned `@tkstang/exhibit@0.2.0` and `@open-agent-toolkit/cli@0.3.35`, each with a provenance-attestation link. Attestations were not cryptographically verified. The worker found Exhibit release run [37808932014](https://github.com/tkstang/exhibit/actions/runs/37808932014) with successful validation and publication jobs. OAT run [40779149782](https://github.com/voxmedia/open-agent-toolkit/actions/runs/40779149782) had publication skipped; that workflow's green status alone is not publication evidence. These observations do not establish new toolkit publishing rights.
