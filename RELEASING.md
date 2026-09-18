# Releasing

The `consensus` and `session` plugins have independent release versions. Select
one plugin release target, run the full automated gate, and verify the provider
paths affected by that plugin before tagging it. A passing static package check
does not establish live provider discovery or permission behavior.

## Checklist

- Run `pnpm run build`.
- Run `pnpm run type-check`.
- Run `pnpm run build:check`.
- Run `pnpm run test`.
- Run `pnpm run validate`.
- Run `pnpm run smoke`.
- For a consensus release, run the live provider E2E release gate in
  `plugins/consensus/references/live-e2e.md` and capture Refine plus Evaluate
  evidence.
- Run `pnpm run test:live-e2e` (or record why it was waived for this release).
  It proves the provider-CLI submit-tool boundary
  (`src/plugins/consensus/provider-cli/e2e/submit-live.e2e.test.ts`) end-to-end
  against a real provider, as the automatable subset of the manual runbook
  above — it is not a replacement for it. Prerequisites: an authenticated
  `codex` CLI by default (`CONSENSUS_LIVE_SUBMIT_PROVIDER` selects
  `claude`/`codex`/`cursor`), real API quota, and roughly one provider call
  (a few seconds to low minutes depending on the provider). It requires
  `CONSENSUS_LIVE_SUBMIT_E2E=1` and fails loudly (not a silent skip) if that
  is set without a usable provider CLI; `pnpm test` on its own continues to
  skip this suite by default.
- Verify sequential `consensus-refine` on a real markdown artifact when the
  live E2E runbook does not already cover the release delta.
- Verify resume from a generated deliberation artifact.
- Verify user-direction continuation after an impasse or max-rounds stop.
- Verify corrupt resume handling with explicit skip controls before continuing from damaged state.
- Verify host-mediated parallel prepare, section dispatch, and fan-in on a multi-section markdown artifact.
- Verify Claude Code plugin install and Bash permission shape.
- Verify Cursor plugin install and exec permission shape.
- Verify Codex Git/local install, interface metadata, skill path syntax, and exec permission shape.
- Verify the intended standalone skills through `npx skills add <username>/skills`
  discovery and an isolated install. Do not infer every authored skill is
  standalone; only declarations in `src/distributions.ts` produce that form.
- In an isolated project, verify the README quick start:
  `npx skills add https://github.com/tkstang/skills/tree/main/skills/next-steps --agent codex`.
  Record installer selection, project-scoped placement, fresh-session discovery,
  and a bounded invocation separately. Verify other advertised host paths when
  affected; do not infer discovery from a successful file copy.
- Confirm the [Installation guide's provider matrix](documentation/docs/user-guide/installation.md#install-matrix)
  matches the live provider CLIs and the README still routes readers there.
- Confirm no plugin manifest references `.oat/` or project-local infrastructure.
- For a session release, verify the complete session plugin in an isolated
  directory, execute the generated transcript exporter outside the checkout,
  and separately record live Claude Code, Codex, and Cursor discovery/permission
  evidence when authorized. Static and isolated checks alone leave those live
  claims unverified.
- Keep Session Fork to Destination labeled alpha while provider coverage and
  end-to-end verification are incomplete. Before claiming a verified provider
  path, ensure its capability evidence is current against official documentation and
  an explicitly authorized live or human verification covers each claimed
  provider surface and entry point. Record unsupported Cursor transitions as
  unsupported; do not infer CLI fork or cross-worktree behavior from IDE
  Duplicate Chat or CLI resume documentation. The older paused executor and its
  behavior gate are not prerequisites for distributing the alpha guidance skill.
- Publish the `consensus.mjs` SHA-256 checksum alongside the tag/release notes
  (`shasum -a 256 plugins/consensus/scripts/consensus.mjs`), so operators can
  verify with `CONSENSUS_INSTALL_SHA256` in `install.sh`.

## First-party standalone acceptance

Before advertising the first-party standalone installer for a release, confirm
the pinned tag contains `install.sh`, `scripts/install-standalone.mjs`, and the
current generated `skills/<name>/` payloads. The Installation guide uses
`v0.1.2` as a planned example; a passing local test does not publish that tag.

Run the focused installer suite with local tagged repositories and a temporary
`HOME`. Record automated placement and payload verification separately from
the live checks below. The installer resolves an exact tag and verifies copy
fidelity; it does not verify signed provenance.

For each row, record the pinned tag, selected skill, placement, payload
verification result, printed invocation, host version, fresh-session discovery,
and a bounded invocation with its permission behavior. Compare the printed
path and invocation against the selected host and scope. Do not infer a
passing row from another host or scope.

| Host        | Scope   | Required live evidence                                                       |
| ----------- | ------- | ---------------------------------------------------------------------------- |
| Codex       | project | Install, fresh-session discovery, bounded invocation and permission behavior |
| Codex       | user    | Install, fresh-session discovery, bounded invocation and permission behavior |
| Claude Code | project | Install, fresh-session discovery, bounded invocation and permission behavior |
| Claude Code | user    | Install, fresh-session discovery, bounded invocation and permission behavior |
| Cursor      | project | Install, fresh-session discovery, bounded invocation and permission behavior |
| Cursor      | user    | Install, fresh-session discovery, bounded invocation and permission behavior |

Live host install, discovery, and invocation require explicit authorization.
Use an isolated project for project scope. Mutation of the real user home is
a separate step requiring explicit authorization even when project-scope live
checks are approved. Record pending or waived checks with their reason; keep
those host/scope claims unverified. Static tests with a temporary `HOME` do not
establish real user-scope acceptance.

## Consensus v0.1.0 historical readiness snapshot

Last updated: 2026-06-20.

This evidence covers the Consensus package and membership tested on that date.
It does not establish readiness for the Session plugin, later skill additions,
or the current generated-distribution layout. Use the current release checklist
above for the selected plugin; static packaging is not live-provider acceptance.

### Automated checks

| Check                  | Status | Evidence                                                                                                 |
| ---------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `pnpm run build`       | passed | Generated all committed runtime outputs from canonical TypeScript source                                 |
| `pnpm run type-check`  | passed | `tsc --noEmit` completed                                                                                 |
| `pnpm run build:check` | passed | All generated outputs reported `in sync`                                                                 |
| `pnpm run test`        | passed | Vitest-only suite: 72 test files passed, 726 tests passed                                                |
| `pnpm run validate`    | passed | `validation passed`                                                                                      |
| `pnpm run smoke`       | passed | `smoke passed`                                                                                           |
| `pnpm run premerge`    | passed | Build, type-check, build-check, test, validate, and smoke all passed                                     |
| Prior live dogfood     | reused | PR #9 verified `consensus-refine` with live Claude+Codex across all iteration modes and escalation flows |
| Provider CLI inventory | passed | `claude`, `codex`, and `cursor` ready after unlocking the SSH-session keychain                           |
| Default peers          | passed | Per-provider preflight passed for `claude` and `codex`                                                   |

### Manual provider checks

| Provider     | Status   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code  | verified | `claude` CLI `2.1.185` is present and provider CLI preflight reports `usable: true`. `claude plugin validate plugins/consensus` passed with warnings only. `claude plugin marketplace add "$PWD"` and `claude plugin install consensus@skills` passed, and `claude plugin details consensus` reports 2 skills (`evaluate`, `refine`) plus 1 agent (`consensus-section-runner`). Interactive smoke passed in a live Claude Code runtime on 2026-06-20: the operator approved the `Bash(node)` permission prompt and the consensus wrapper ran `preflight --json` to `ok: true` / `usable: true`.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Cursor       | verified | `cursor-agent` `2026.06.19-20-24-33-653a7fb` is present. In SSH sessions, the macOS login keychain may need to be unlocked in that same shell before `cursor-agent` and provider CLI preflight report ready. After unlocking, direct provider CLI smoke, Refine E2E, and Evaluate E2E passed with Cursor as a peer using `strategy_used: "prompt_only"` and first-attempt schema success. Submit-tool support remains reserved and is not selected by default. Plugin load verified on 2026-06-20 via `cursor agent --plugin-dir "$PWD/plugins/consensus"`: Cursor surfaced a `node` exec permission prompt, and after approval the consensus wrapper ran `preflight --json` to `ok: true` / `usable: true`.                                                                                                                                                                                                                                                                                                          |
| Codex        | verified | `codex-cli 0.139.0` is present and provider CLI preflight reports `usable: true`. `codex plugin marketplace add "$PWD"` confirms local marketplace support but cannot add this release-candidate worktree while the configured `skills` marketplace already points at `/Users/tstang/Code/skills`. `codex plugin add consensus --marketplace skills --json` passed and installed `consensus@skills` 0.1.0 from the configured local marketplace. Interactive runtime smoke passed on 2026-06-20: in a live Codex session, tested under both the default and `--ask-for-approval on-request` policies, the consensus wrapper ran under Codex's sandboxed exec path and `preflight --json` returned `ok: true` / `usable: true`. Codex did not surface an approval prompt for this read-only command under either policy — by design, its `on-request` approval gates sandbox _escalation_ (writes/network outside the workspace), not in-sandbox read-only execution, so a read-only preflight runs without prompting. |
| Agent Skills | partial  | `npx skills@latest --help` resolves `skills` 1.5.12. `npx skills@latest add tkstang/skills --list --full-depth` cloned the GitHub source and listed 60 source-discovered skills. This is not a post-tag skills.sh indexing check and does not prove public listing/discovery for the consensus plugin; do not claim skills.sh availability until indexing is verified after publication.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

All interactive provider permission/runtime checks above are green as of
2026-06-20 (Claude Code and Cursor surfaced and approved a `node` exec prompt;
Codex ran the wrapper under its sandboxed exec path, which by design does not
prompt for read-only commands even under `on-request`).

**v0.1.0 is released (2026-06-20).** The tag is pushed on `main` (`e4e9348`),
`release.yml` ran green (build, type-check, build:check, test, validate, smoke,
`--check-tag v0.1.0`), and the GitHub Release is published at
<https://github.com/tkstang/skills/releases/tag/v0.1.0>. Post-tag `npx skills add
tkstang/skills` source discovery passes; skills.sh **hosted indexing is not yet
live** (expected async lag) and stays a non-claim until it indexes.

## Versioning

Update `CHANGELOG.md` and the selected plugin's provider/marketplace manifests
together. Contributions land their notes under `## [Unreleased]`; releasing moves
those entries under the new version heading with its release date, leaving
`## [Unreleased]` empty for the next change. Plugin versions and skill versions
are separate release boundaries.

Use:

```bash
pnpm tsx scripts/bump-version.ts 0.1.2 --plugin consensus
# or
pnpm tsx scripts/bump-version.ts 0.1.0 --plugin session
```

The plugin form updates that plugin's three provider manifests and any existing
marketplace version entries. It does not rewrite member skill versions. For a
skill behavior/content release, bump its sole authored version field instead:

```bash
pnpm tsx scripts/bump-version.ts 1.2.3 --skill session-handoff
```

Every canonical `src/skills/<name>/SKILL.md` uses one quoted stable
`metadata.version`. Generated standalone and plugin forms inherit it; top-level
`version` is rejected.

Before pushing a release tag, verify the tag and manifests match:

```bash
pnpm tsx scripts/bump-version.ts --check-tag v0.1.2 --plugin consensus
```

The structural validator enforces provider manifest consistency during normal
development. The release workflow checks the pushed tag against the selected
plugin's manifests and present marketplace version fields. Release the other
plugin independently rather than changing both version sets together.

## Ownership cutover after the public merge

This repository becomes the editable owner of `session-handoff` and the newer
`complexity-review` content only after the public migration is merged and its
supported source is available. Then open the separately authorized
personal-skills PR that removes the private authored copies or changes retained
distribution entries to consume this public source. Do not merge that private
PR, replace active user installations, uninstall old copies, or run a global
sync merely to prove packaging. Record the transitional owner until the
separate PR is merged.
