# skills

Agent Skills and plugins for independent perspectives, clearer decisions, and
continuity between coding sessions. Use them with Claude Code, Codex, or Cursor;
installation and available capabilities vary by host.

[Get started](https://tkstang.github.io/skills/user-guide/getting-started/) ·
[Browse the documentation](https://tkstang.github.io/skills/) ·
[Contribute](https://tkstang.github.io/skills/engineering/contributing/development/)

## Choose what you need

| I want to…                                                                 | Start with                                                                                                                                                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create, refine, evaluate, review, or decide with independent AI peers      | [Consensus plugin](https://tkstang.github.io/skills/user-guide/consensus/)                                                                                                                |
| Hand off work, export a transcript, or review a session                    | [Session plugin](https://tkstang.github.io/skills/user-guide/plugins/session/)                                                                                                            |
| Get a justified next step, question unnecessary work, or review complexity | [Standalone skills](https://tkstang.github.io/skills/user-guide/skills/)                                                                                                                  |
| Observe another session or collaborate across two sessions                 | [Observer](https://tkstang.github.io/skills/user-guide/skills/session-observer/) or [Collaborative Observer](https://tkstang.github.io/skills/user-guide/skills/session-observer-collab/) |

Plugins group related capabilities; standalone skills let you install one
capability. Where both forms exist, they share one implementation and one guide.
Choose one form of a skill to avoid duplicate entries in your agent.

## Try one skill

Next Steps recommends an action and explains why, without starting the work.
From the project where you want to use it, install its generated standalone
payload for Codex:

```bash
npx skills add https://github.com/tkstang/skills/tree/main/skills/next-steps --agent codex
```

For other hosts, local-checkout sources, and verification, see
[Installation](https://tkstang.github.io/skills/user-guide/installation/#install-one-standalone-skill).
The command uses the [Skills CLI](https://github.com/vercel-labs/skills) and
installs at project scope by default. Review its confirmation before proceeding.

In a new Codex session, invoke `$next-steps` with a bounded request:

> The feature is implemented, but review found one empty-input bug. Recommend
> what to do next and why. Do not change files yet.

Prefer a plugin? The [plugin installation guide](https://tkstang.github.io/skills/user-guide/installation/#install-matrix)
covers Claude Code, Codex, and Cursor without requiring every skill in this repo.

## What the plugins do

**Consensus** asks provider-backed peers for independent work, rather than
assigning several personas to one conversation. It offers artifact creation,
planning, decisions, refinement, evaluation, one bounded independent review,
panels without synthesis, and one-shot advice. Disagreement is preserved, and an impasse is a valid outcome.
It also includes Observer and Collaborative Observer.

**Session** offers portable handoffs, sanitized transcript exports, and
evidence-backed retrospectives. Its **alpha** Fork to Destination skill discovers
and previews sessions and prepares same-provider fork instructions; it does not
run the provider or create the fork. Provider coverage and end-to-end
verification are incomplete.

Provider-backed workflows need the local provider CLIs they invoke. Executable
skills require Node.js 22+ but no runtime dependency installation. See each
guide for supported behavior and verification limits.

## Development

Authored product skills live in `src/skills/`, shared runtime in `src/shared/`,
and plugin runtime in `src/plugins/`. `src/distributions.ts` declares generated
installation units under `skills/` and `plugins/`. Edit source, not generated
payloads; TypeScript, tests, and bundling are contributor tools only.

```bash
pnpm install
pnpm run premerge
```

[Development](https://tkstang.github.io/skills/engineering/contributing/development/) ·
[Architecture](https://tkstang.github.io/skills/engineering/architecture/) ·
[CI and releases](https://tkstang.github.io/skills/engineering/operations/)
