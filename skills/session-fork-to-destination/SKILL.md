---
name: session-fork-to-destination
description: Use when the user wants to find a Codex or Claude Code conversation in one Git worktree and prepare safe instructions for creating and opening a fork in an existing destination worktree tab. Cursor capability evidence is reported, but current transcript discovery fails closed without independent source-worktree evidence.
license: MIT
compatibility: Experimental and not released. Requires Node.js 22+ and local provider transcript stores for read-only discovery. The user runs any provider command manually.
argument-hint: '[source-worktree] [destination-worktree]'
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Bash(node <skill-dir>/scripts/session-fork-to-destination.mjs:*)
metadata:
  author: thomas.stang
  version: '0.2.0'
---

# session-fork-to-destination

> **Experimental / not released.** This skill discovers and previews local sessions
> read-only, then prepares instructions. It does not run a provider, authenticate,
> create a fork, write a receipt, retry, reconcile a child ID, or control an IDE tab.

Current Cursor transcript discovery is unavailable. Its store layout supplies a lossy
project slug rather than independent exact cwd evidence, so a matching store returns a
path-free `discovery-incomplete` result. No Cursor candidate can be selected or
previewed.

Use this skill for one of three entry points:

1. The user invokes it inside the exact source session they want to fork.
2. The user invokes it from another session in the source worktree.
3. The user invokes it from a fresh session in the existing destination worktree and
   supplies the source worktree.

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
6. Prepare the destination-side instructions with the matching entry point:

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

Never replace fork with resume, launch an interactive provider as a nested process,
merge the fresh conversation with source history, or infer Cursor CLI compatibility
from an IDE transcript. When a provider/surface transition is unsupported, present the
reason and stop before suggesting syntax.

See [provider guidance](references/provider-guidance.md) for the dated capability
evidence and limitations.
