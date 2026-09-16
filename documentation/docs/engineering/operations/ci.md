---
title: 'CI & Quality Gates'
description: 'Know which checks run on PRs, main pushes, manual live-provider runs, and release tags.'
---

# CI & Quality Gates

The workflows distinguish deterministic repository checks from documentation
deployment and opt-in live-provider verification.

## What runs when

| Workflow                                                                                        | Trigger                                   | What it establishes                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Validate](https://github.com/tkstang/skills/blob/main/.github/workflows/validate.yml)          | Pull requests and pushes to `main`        | Generated-output freshness, type checks, tests, structure validation, and mocked smoke behavior. Separate PR-only jobs check skill versions, internal flags, commit conventions, and changed-file lint/format. |
| [Docs CI](https://github.com/tkstang/skills/blob/main/.github/workflows/docs-ci.yml)            | PRs changing `documentation/**`           | The docs app builds at the `/skills` base path and passes its formatting check. It does not publish.                                                                                                           |
| [Deploy Docs](https://github.com/tkstang/skills/blob/main/.github/workflows/deploy-docs.yml)    | Manual dispatch or relevant `main` pushes | Builds a static export and publishes `documentation/out/` to GitHub Pages.                                                                                                                                     |
| [Live Provider E2E](https://github.com/tkstang/skills/blob/main/.github/workflows/live-e2e.yml) | Manual dispatch only                      | Exercises the provider submit boundary against a real authenticated provider, spending real quota.                                                                                                             |
| [Release](https://github.com/tkstang/skills/blob/main/.github/workflows/release.yml)            | `consensus-v*` or `session-v*` tags       | Rebuilds, checks committed generated output, runs deterministic gates, and checks the selected plugin's version. It does not itself publish a GitHub Release.                                                  |

## Reproduce deterministic checks

From the repository root, with the documented Node and pnpm prerequisites:

```bash
pnpm install --frozen-lockfile
pnpm run build:check
pnpm run type-check
pnpm test
pnpm run validate
pnpm run smoke
```

Run `build:check` before repairing generated output so drift is visible. If the
change intentionally affects installation units, edit canonical source and
run `pnpm run build`, inspect the generated diff, then repeat the checks. See
[Generated installation units](../architecture/generated-runtime.md).

PR-only policies are additional gates, not implied by the command set above.
The local pre-push hook runs validate, build freshness, type checking, skill
versions, and internal flags; it deliberately does not run tests or smoke.
For their local behavior, see [Hooks & Safety](../contributing/development/hooks-and-safety.md)
and [Commit Conventions](../contributing/development/commit-conventions.md).
Repository lint/format checks are changed-file scoped; do not format the entire
tree to resolve a scoped PR failure.

## Documentation build and deployment

The docs app has its own dependencies and lockfile. To reproduce its build:

```bash
pnpm --dir documentation install --frozen-lockfile
NEXT_PUBLIC_BASE_PATH=/skills pnpm --dir documentation build
pnpm --dir documentation run docs:format:check
```

The build includes generated MDX and inventory steps. Inspect their changes;
never fix a generated inventory by hand. Also check the actual sidebar, links,
images, and light/dark rendering: a successful export is not a visual review.

GitHub Pages must be configured to use GitHub Actions. Docs CI only checks;
the separate deployment workflow publishes. Its push filter includes changes
under `documentation/**` and changes to the deployment workflow itself.

## Live checks are opt-in

Ordinary tests use deterministic fixtures; the live submit test is skipped
unless its live guard is enabled. `pnpm run test:live-e2e` enables that guard
and requires an authenticated provider plus permission to spend quota.
`CONSENSUS_LIVE_SUBMIT_PROVIDER` selects the provider.

The checked-in manual workflow provisions Codex or Claude on its GitHub-hosted
runner. Selecting Cursor fails explicitly: it has no pinned provisioning path
there. Cursor verification needs a separately prepared, authenticated environment;
choosing the input does not automatically switch this workflow to a self-hosted
runner.

Static checks and live submit E2E still do not replace all installation,
permission, and workflow acceptance checks. Use
[Releases & Versioning](releases-and-versioning.md) for that boundary.
