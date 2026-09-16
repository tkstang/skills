---
title: 'Releases & Versioning'
description: 'Separate canonical skill versions from plugin releases and verify the correct boundary before tagging.'
---

# Releases & Versioning

Consensus and Session release independently. Canonical skills also have their
own versions. Choose the boundary you changed before updating a version or
claiming release readiness.

## Version boundaries

| Boundary        | Authored version                                                 | What inherits it                                                                                    |
| --------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Canonical skill | Quoted stable `metadata.version` in `src/skills/<name>/SKILL.md` | Its generated standalone and plugin-local forms. Top-level `version` is rejected.                   |
| Plugin release  | The selected plugin's provider and marketplace manifest versions | That complete plugin distribution, independently of its member skill versions and the other plugin. |

Any change under a canonical skill directory requires increasing its skill
version, including instructions, runtime, tests, references, assets, and build
declarations. Never edit generated skill versions directly. See
[Repository Conventions](../contributing/development/conventions.md).

The version tool keeps the selected boundary together. For example, after
choosing the appropriate new version:

```bash
pnpm tsx scripts/bump-version.ts 1.2.3 --skill session-handoff
pnpm tsx scripts/bump-version.ts 0.3.0 --plugin session
```

These are example target versions, not a statement of the current release.
The plugin command does not bump member skills. Update the changelog and review
the selected manifests along with the generated payloads.

## Release evidence

Follow the complete [release checklist](https://github.com/tkstang/skills/blob/main/RELEASING.md).
Keep these kinds of evidence separate:

1. **Deterministic gates:** build, type checks, output freshness, tests,
   structure validation, and mocked smoke behavior.
2. **Isolated installation:** the complete plugin or standalone payload works
   outside the checkout, without developer dependencies or sibling-source imports.
3. **Live acceptance:** the relevant provider discovers the installed skills,
   permissions behave correctly, and the affected workflow works. These checks
   need separate authorization and may spend real quota.

For Consensus, the checklist includes the live Refine/Evaluate runbook and
resume, continuation, and provider-install checks. For Session, it includes
an isolated complete-plugin check and executing the generated transcript
exporter outside the checkout, with live discovery/permission evidence tracked
separately.

Session Fork to Destination is distributed as an alpha guidance skill. Provider
coverage and end-to-end verification remain incomplete; packaging it is not
evidence that a native fork works. Keep those limits explicit until current
capability evidence and authorized verification cover each claimed surface.

## Tags and the release workflow

The workflow triggers on plugin-qualified tags, such as `session-v0.3.0` or
`consensus-v0.2.0`. It extracts the plugin and passes the `v<version>` portion
to the version checker. To check the Session example before any tag push:

```bash
pnpm tsx scripts/bump-version.ts --check-tag v0.3.0 --plugin session
```

The [release workflow](https://github.com/tkstang/skills/blob/main/.github/workflows/release.yml)
rebuilds outputs, rejects generated drift, runs automated checks, and validates
the selected manifests. It does not run live-provider acceptance or create a
GitHub Release for you. Tagging, publishing, and claiming availability remain
separate release actions.

Historical readiness evidence applies only to the revision and membership it
tested; it does not establish readiness for newly added skills or another plugin.
See [CI & Quality Gates](ci.md) for trigger and verification details.
