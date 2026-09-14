# skills

> Personal home for Agent Skills and packaged plugins, running across Claude Code,
> Codex, and Cursor. Authored skills live in `src/skills/`; generated standalone
> and plugin payloads live under `skills/` and `plugins/`.

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

## Plugins

The repo now declares two independently versioned plugins. **Consensus** owns
peer deliberation plus session observation/collaboration; **Session** owns
handoff, sanitized export, and destination-fork guidance.

### Consensus skills

| Skill             | What it does                                             |
| ----------------- | -------------------------------------------------------- |
| `create`          | New artifact from a brief                                |
| `decide`          | Choose between options, surfacing dissent                |
| `plan`            | Goal + constraints → structured plan                     |
| `refine`          | Deliberate a draft toward convergence                    |
| `evaluate`        | Judge an artifact against a rubric                       |
| `panel`           | Same question to several peers, attributed, no synthesis |
| `phone-a-friend`  | One peer, one advisory take — no deliberation loop       |
| `observer`        | Plugin-local form of `session-observer`                  |
| `observer-collab` | Plugin-local form of `session-observer-collab`           |

[Consensus guide →](https://tkstang.github.io/skills/user-guide/consensus/)

### Session skills

| Plugin-local skill    | Standalone name               | What it does                                       |
| --------------------- | ----------------------------- | -------------------------------------------------- |
| `handoff`             | `session-handoff`             | Prepare concise continuation context               |
| `export-transcript`   | `session-export-transcript`   | Export a sanitized Markdown transcript             |
| `fork-to-destination` | `session-fork-to-destination` | Prepare experimental destination-tab fork guidance |

## Optional standalone skills

Six skills have explicitly generated standalone forms. Installing a plugin and
its standalone form together may expose duplicate host entries; choose one form
unless you have verified how your host resolves duplicates.

| Skill                         | What it does                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session-observer`            | Digest another runtime's transcript for this project — tool-free, and tracks a read offset so repeat checks show only what's new                           |
| `session-observer-collab`     | Coordination protocol for two mutually-watching sessions plus the human — pinned review, bounded wake behavior, explicit authority rules                   |
| `session-export-transcript`   | Export your own session to sanitized, branch-named Markdown — tool calls and hidden payloads stripped                                                      |
| `session-fork-to-destination` | Experimental, not released: prepare destination-safe fork guidance from bounded, explicit session evidence; it does not invoke a provider or create a fork |
| `session-handoff`             | Prepare an evidence-grounded continuation brief, with observer and transcript export as optional integrations                                              |
| `complexity-review`           | Review a plan, design, or implementation against its contract — a ledger of what to keep, simplify, defer, or delete, plus the minimum sufficient version  |

[Skills guide →](https://tkstang.github.io/skills/user-guide/skills/)

## Install

v0.1 installs from a local marketplace in this checkout. Run these from the repo root.

**Claude Code**

```bash
claude plugin marketplace add "$PWD" --scope user
claude plugin install consensus@skills --scope user
claude plugin install session@skills --scope user
```

**Codex**

```bash
codex plugin marketplace add "$PWD"
codex plugin add consensus --marketplace skills
codex plugin add session --marketplace skills
```

**Cursor** — session-scoped rather than a plugin install, which is why its skills
load unnamespaced:

```bash
cursor agent --plugin-dir "$PWD/plugins/consensus"
# or: cursor agent --plugin-dir "$PWD/plugins/session"
```

Requires Node.js 22+. Consensus peer workflows additionally require the local
provider CLIs they invoke. Session plugin packaging and isolated export execution
are verified; live provider discovery and permissions remain release checks.
Prerequisites, standalone links, caveats, and provider-readiness checks:
[Installation →](https://tkstang.github.io/skills/user-guide/installation/)

## Development

Shipped skills are dependency-free Node ESM — stdlib only, no install step.
Canonical owners live under `src/skills/`; build declarations generate complete
installation units under `skills/` and `plugins/`. Developer tooling uses pnpm.

```bash
pnpm run premerge   # build + type-check + build:check + test + validate + smoke
```

Conventions, commit format, and the docs authoring contract:
[Contributing →](https://tkstang.github.io/skills/engineering/contributing/) ·
[Architecture →](https://tkstang.github.io/skills/engineering/architecture/)
