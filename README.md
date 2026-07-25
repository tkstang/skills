# skills

> Personal home for Agent Skills and packaged plugins, running across Claude Code,
> Codex, and Cursor. Standalone skills in `skills/`, plugins in `plugins/<name>/`.

Status: **v0.1** · [Full documentation →](https://tkstang.github.io/skills/)

## Peers, not personas

Most "multi-agent" workflows are one model wearing several hats. The **consensus**
plugin isn't that — it invokes _other providers' CLIs as independent peers_, literally
separate OS subprocesses: `claude --print --output-format json`, `codex exec --json`,
`cursor-agent --output-format json`. Those peers deliberate in structured verdict
rounds, and the wrapper writes a markdown artifact holding the converged output, a
`consensus-resolution` block, and a full `## Deliberation Log` you can actually read.

The non-obvious part is what happens when the peers _don't_ agree. **Disagreement is a
first-class outcome, not something synthesis averages away.**

- `IMPASSE` is checked _before_ convergence — an impasse stops the run and gets
  reported, rather than forced into a merged answer.
- `decide` always emits a `## Dissent / Unresolved Disagreement` section.
- `panel` refuses to synthesize at all.

## Try it

```
/consensus:refine draft.md --goal "tighten the failure-handling section"

/consensus:panel --question "Should retries live in the client or the gateway?" --panel-size 3
```

The first deliberates to convergence, or to a reported impasse. The second doesn't
converge on purpose — you read three attributed takes and decide yourself.

Invocation depends on how the skills are loaded. Installed as a plugin they're
namespaced — `/consensus:refine` in Claude Code, `$consensus:refine` in Codex.
Cursor's `--plugin-dir` is session-scoped rather than a plugin install, so there
it's just `/refine`.

## Consensus skills

| Skill            | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `create`         | New artifact from a brief                                |
| `decide`         | Choose between options, surfacing dissent                |
| `plan`           | Goal + constraints → structured plan                     |
| `refine`         | Deliberate a draft toward convergence                    |
| `evaluate`       | Judge an artifact against a rubric                       |
| `panel`          | Same question to several peers, attributed, no synthesis |
| `phone-a-friend` | One peer, one advisory take — no deliberation loop       |

[Consensus guide →](https://tkstang.github.io/skills/user-guide/consensus/)

## Standalone skills

Two jobs: watching _another_ agent, and exporting _your own_ session.

| Skill                       | What it does                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `session-observer`          | Digest another runtime's transcript for this project — tool-free, and tracks a read offset so repeat checks show only what's new         |
| `session-observer-collab`   | Coordination protocol for two mutually-watching sessions plus the human — pinned review, bounded wake behavior, explicit authority rules |
| `export-session-transcript` | Export your own session to sanitized, branch-named Markdown — tool calls and hidden payloads stripped                                    |

[Skills guide →](https://tkstang.github.io/skills/user-guide/skills/)

## Install

v0.1 installs from a local marketplace in this checkout. Claude Code, from the repo root:

```bash
claude plugin marketplace add "$PWD" --scope user
claude plugin install consensus@skills --scope user
```

Requires Node.js 22+, plus the local provider CLIs for whichever peers you ask for.
Codex and Cursor paths, caveats, and readiness checks:
[Installation →](https://tkstang.github.io/skills/user-guide/installation/)

## Development

Shipped skills are dependency-free Node ESM — stdlib only, no install step. Developer
tooling uses pnpm.

```bash
pnpm run premerge   # build + type-check + build:check + test + validate + smoke
```

Conventions, commit format, and the docs authoring contract:
[Contributing →](https://tkstang.github.io/skills/engineering/contributing/) ·
[Architecture →](https://tkstang.github.io/skills/engineering/architecture/)
