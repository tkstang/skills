---
name: fork-to-destination
description: Use when the user wants to continue a Claude Code or Codex session in an existing destination worktree, including importing supported history into the other provider before running its native fork command.
license: MIT
compatibility: Alpha workflow; provider coverage and end-to-end verification are incomplete. Requires Node.js 22+ and local provider transcript stores. Cross-provider apply writes an imported seed; the user runs the native fork command manually.
argument-hint: '[source-worktree] [destination-worktree]'
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Bash(node <skill-dir>/scripts/session-fork-to-destination.mjs:*)
metadata:
  author: Thomas Stang
  version: '0.3.4'
---

# fork-to-destination

> **Alpha.** This skill discovers and previews local sessions
> read-only, then prepares instructions. Cross-provider import can write a reconstructed
> seed after a reviewed plan. It does not run a provider, authenticate, create the
> native fork, or control an IDE tab.

Provider capabilities are based on documented evidence, not complete live
verification. Review the reported provider and entry-point limitations before
running any prepared command.

Current Cursor transcript discovery is unavailable. Its store layout supplies a lossy
project slug rather than independent exact cwd evidence, so a matching store returns a
path-free `discovery-incomplete` result. No Cursor candidate can be selected or
previewed.

Use this skill for one of three entry points, named by the `--entry-point` selector
`prepare` expects:

1. `source-current` — the user invokes it inside the exact source session they want to
   fork.
2. `source-other` — the user invokes it from another session in the source worktree.
3. `destination-fresh` — the user invokes it from a fresh session in the existing
   destination worktree and supplies the source worktree.

## Prerequisites

Before discovery or import, check the bundled executable:

```bash
node <skill-dir>/scripts/session-fork-to-destination.mjs --help
```

Use Node.js 22 or newer and confirm the required command appears (`import` for a
cross-provider request). If the executable is missing or incompatible, stop dependent
steps and point to the [installation guide](https://github.com/tkstang/skills/blob/main/documentation/docs/user-guide/installation.md).
Reuse a successful same-session check; do not auto-install or require a network
freshness check. The user needs the target provider CLI when running the final
native fork command. This skill does not launch it to verify compatibility.

Use this workflow for session history. A request for only a concise continuation
summary does not need a native-history import.

## Workflow

1. Establish the canonical source worktree. For the third entry point, ask for it.
2. Run read-only discovery for the expected provider. Use `--provider claude` or
   `--provider codex`, and repeat for the other provider when needed:

   ```bash
   node <skill-dir>/scripts/session-fork-to-destination.mjs discover \
     --source "/absolute/source/worktree" --provider claude --json
   ```

   `--provider all` remains fail closed when Cursor discovery is incomplete, so it is
   not the default workflow while Cursor lacks independent exact cwd evidence.

3. Current identity is never guessed. If direct identity is unavailable or does not
   corroborate exactly, show the candidates and ask the user to choose one qualified
   `provider:surface:id` selector. Modified time is display context only.
4. Offer a sanitized preview when it helps selection:

   ```bash
   node <skill-dir>/scripts/session-fork-to-destination.mjs preview \
     --source "/absolute/source/worktree" \
     --session "codex:cli:00000000-0000-4000-8000-000000000001" --json
   ```

   Repeat the warning that sanitization is not a guarantee that text is secret-free.

5. Require an existing destination worktree registered to the same Git repository.
   Preparing instructions refuses a dirty source and reports destination dirt without
   transferring it.
6. For the same provider, prepare the destination-side instructions with the matching entry point. For Claude ↔ Codex, use the import workflow below instead:

   ```bash
   node <skill-dir>/scripts/session-fork-to-destination.mjs prepare \
     --source "/absolute/source/worktree" \
     --target "/absolute/destination/worktree" \
     --session "claude:cli:00000000-0000-4000-8000-000000000002" \
     --entry-point destination-fresh --json
   ```

7. Explain that no fork exists yet. The user switches to the destination tab and acts
   there. For a fresh provider session, follow a documented in-provider switch only
   when the output supplies one; otherwise exit that session and run the guarded
   terminal command in the same tab.

## Cross-provider import

For Claude CLI → Codex CLI or Codex CLI → Claude CLI, import supported history as a
new target-provider seed, then have the user fork that seed. The source must be
inactive and end with a completed assistant turn. Cross-provider `source-current`
is unsupported: finish the source turn, exit, and invoke from another session or
the destination. Same-provider `prepare` still supports all three entry points.

1. Establish the exact source selector and distinct existing destination worktree
   using steps 1–5 above. Source discovery uses conventional `~/.claude` and
   `~/.codex` homes; alternate source-home environment routing is unsupported.
2. Plan without writes, choosing the other target provider:

   ```bash
   node <skill-dir>/scripts/session-fork-to-destination.mjs import \
     --source "/absolute/source/worktree" \
     --target "/absolute/destination/worktree" \
     --session "claude:cli:00000000-0000-4000-8000-000000000002" \
     --to codex --entry-point destination-fresh --json
   ```

   Optional `--target-home PATH` selects an existing target home. Otherwise target
   routing uses its environment variable, then its conventional home. Review the
   seed location, conversion counts, omissions, and limitations. Imported supported
   text and tool payloads are **raw**, unlike sanitized previews: they can include
   secrets. Metadata omissions do not make an import secret-free.

3. Within the user's authorization to import that source into that target, repeat
   the same command with `--apply --expect-plan DIGEST`, using the returned plan
   digest. If the plan changes, explain the new plan before applying it. Never
   bypass a refusal, automatically retry, or replace an existing transcript.
4. Report **seed imported; native fork not created** (or exact seed already present).
   The user exits any fresh provider session and runs the returned guarded command
   from the canonical destination. Its native operation is `codex fork SEED` or
   `claude --resume SEED --fork-session`. Preserve its home routing and cwd guard.

If a sandbox denies writing to the target store, return the reported terminal
apply command and its required routing; do not escalate automatically. If a seed
has gained turns, import refuses instead of including unreviewed history. The user
may fork that existing seed manually if desired. Archived seeds must be restored
through the provider's supported workflow before replanning.

Supported conversion includes user/assistant text and completed matched native
function/custom calls and results. Reasoning and recognized runtime context are
omitted with counts; media becomes visible placeholders. Unsupported or incomplete
histories refuse, including queued Claude input and summary-only Codex compaction.
Safely delimited slash-command arguments remain user text. Raw input limits apply
before media replacement. Read [import limits and evidence](references/provider-guidance.md#import-limits-and-evidence)
for compatibility and verification boundaries.

Never replace fork with resume, launch an interactive provider as a nested process,
merge the fresh conversation with source history, or infer Cursor CLI compatibility
from an IDE transcript. When a provider/surface transition is unsupported, present the
reason and stop before suggesting syntax.

See [provider guidance](references/provider-guidance.md) for the dated capability
evidence and limitations.

Adapted conversion algorithms are covered by the [upstream MIT notice](references/teleporter-license.txt); read it for attribution, not invocation steps.
