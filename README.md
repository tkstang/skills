# skills

> Status: v0.1.

A personal Agent Skills home: standalone skills under `skills/` and packaged
plugins under `plugins/<name>/`, runnable across Claude Code, Codex, and Cursor.

It ships the **consensus** plugin — `create` (draft a new artifact from a brief),
`decide` (choose between options while surfacing dissent), `plan` (turn a goal
and constraints into a structured plan), `refine` (deliberate a markdown draft
toward a converged artifact), and `evaluate` (judge an artifact against a
rubric) — plus standalone session skills (`session-observer`,
`export-session-transcript`).

📖 **Full documentation** is the Fumadocs site under [`documentation/`](documentation/):
the [User Guide](documentation/docs/user-guide/index.md) (install / use / configure)
and [Engineering](documentation/docs/engineering/index.md) (how it works /
contribute). Run it locally with `cd documentation && pnpm install && pnpm dev`.

## Local Git Repository Install

The v0.1 path is local marketplace installation from this checkout. Run from the
repository root.

**Claude Code:**

```bash
claude plugin marketplace add "$PWD" --scope user
claude plugin install consensus@skills --scope user
claude plugin details consensus
```

**Codex:**

```bash
codex plugin marketplace add "$PWD"
codex plugin add consensus --marketplace skills
codex plugin list | rg 'consensus@skills'
```

**Cursor Agent:**

```bash
cursor agent --plugin-dir "$PWD/plugins/consensus"
```

Prerequisites: Node.js 22+ and local provider CLIs for the requested peers
(`claude`, `codex`, `cursor`). The full install guide — caveats, prerequisites,
and provider-readiness checks — is in the
[User Guide → Installation](documentation/docs/user-guide/installation.md).

## Alternative Consensus Installer

Use the full consensus plugin install when possible. If a consensus skill was
installed standalone through skills.sh without the plugin tree, run the pinned
installer to provision the shared provider CLI at `~/.consensus/consensus.mjs`:

```bash
curl -fsSL https://raw.githubusercontent.com/tkstang/skills/v0.1.2/install.sh | bash
```

This gives standalone consensus skills the same shared `consensus.mjs` runtime
they would find in a plugin install. The remote one-liner goes live once
`v0.1.2` is released; until then, running `bash install.sh` from a clone copies
the in-tree `plugins/consensus/scripts/consensus.mjs` without network access.

## Documentation

- **[User Guide](documentation/docs/user-guide/index.md)** — install, use, and configure what this repo ships.
  - [Installation](documentation/docs/user-guide/installation.md) · [Consensus](documentation/docs/user-guide/consensus/index.md) · [Skills](documentation/docs/user-guide/skills/index.md)
- **[Engineering](documentation/docs/engineering/index.md)** — internals and contribution guidance.
  - [Architecture](documentation/docs/engineering/architecture/index.md) · [Repository Layout](documentation/docs/engineering/repository-layout.md) · [Contributing](documentation/docs/engineering/contributing/index.md)

## Development

Shipped skills run with **no install step** (dependency-free Node ESM, standard
library only); developer tooling uses pnpm. Verify with:

```bash
pnpm run type-check
pnpm test
pnpm run build:check
pnpm run validate
pnpm run smoke
```

See [Engineering → Contributing](documentation/docs/engineering/contributing/index.md)
for repository conventions, commit format, git hooks, and the docs authoring
contract.
