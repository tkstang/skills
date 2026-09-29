---
name: author-skill
description: Use when any task creates, edits, migrates, audits, or reviews an agent skill or SKILL.md, including skill instructions, references, templates, helpers, tests, and packaging. Apply proactively without requiring an explicit skill invocation.
metadata:
  author: thomas.stang
  version: '1.3.0'
license: MIT
compatibility: Agent Skills baseline; instruction-only, with no runtime or package dependencies.
disable-model-invocation: false
user-invocable: true
---

# Author Skill

Author skills whose instructions, supporting material, and executable behavior form
one coherent capability. Use this guide for product skills and
repository tooling. For ordinary documentation edits, use the applicable docs guide.

## Inputs

Accept a skill name or path and the requested creation, revision, migration, or
review. Infer these from the conversation when clear. For review-only requests,
report findings without editing. Ask only for missing information that materially
changes the outcome; continue independent work while optional choices are pending.

## Workflow

### Step 1: Establish the contract

Read repository instructions and the target skill before changing it. Identify:

- the user requests that should and should not activate it;
- required inputs, defaults, expected outputs, and completion evidence;
- permitted side effects, existing authorization, and failure behavior;
- dependencies on tools, providers, other skills, or external resources.

Prefer composing an existing capability when it already solves the task. Confirm
source ownership for imports. Preserve behavior and useful regressions during a
migration; do not silently expand the workflow.

For a CLI-backed workflow, place a cheap executable and compatibility check before
expensive reference loading or dependent actions. Check the supported version or
required capabilities and provide the owner's installation/update link on failure.
Missing or incompatible prerequisites block dependent execution. A known newer
compatible release merits a warning, not a forced upgrade or network dependency.
Reuse same-host/session checks when still valid; never auto-install tools. Keep
optional enrichments and documentation-only requests independent of unrelated CLIs.

Use the user's existing authorization for the stated work. Present a plan when it
helps review a consequential choice; do not insert an unconditional approval gate
before ordinary authorized file creation. Resolve required capability or authority
before work that depends on it. Read [delegation guidance](references/delegation.md)
when the authored workflow uses workers or independent review.

### Step 2: Place source and choose what loads

Read the target repository's authoring and contribution guidance. Identify its
canonical source, generated distributions, provider views, build commands, and
installation paths before editing. Edit the canonical owner and regenerate derived
copies. If no convention exists, choose a source location appropriate to the requested
scope and state it; ask only if the choice is materially ambiguous. Do not impose
this skill's own repository layout on another repository.

Keep each skill's instructions and required supporting files together. For imported
material, identify the upstream owner, revision, license, and intended ownership
transition. Follow the repository's import policy: preserve pinned snapshots when
required, and distinguish a maintained adaptation from an unchanged upstream copy.
Do not overwrite unrelated files or active installations to complete a promotion.

Design three levels:

1. A concise description that leads with triggering conditions and distinguishes
   the skill from nearby capabilities. Prefer `Use when`, `Run when`, or `Trigger when`.
2. A focused `SKILL.md` containing the normal workflow, essential constraints,
   expected output, and instructions for selecting supporting material.
3. Supporting references and assets loaded for a named condition or task stage.
   State what each linked file provides and when to read it.

Keep reference links directly reachable from `SKILL.md`. Avoid duplicate guidance,
empty directories, and extraction that merely makes the agent load every file on
all invocations. Keep essential privacy and authorization boundaries in the body.
Use `references/` for supplementary guidance, `assets/` for templates/data, and the
repository's build for generated executable `scripts/`, when applicable.

Treat 500 lines and roughly 5,000 tokens as upper guidance for the main body, not a
target or a quality score. A short file can still load irrelevant material. Assess
whether each paragraph helps the current task.

### Step 3: Author the smallest sufficient workflow

Use imperative instructions with concrete inputs and outputs. Document accepted
arguments, defaults, scope limits, resource resolution, and meaningful failure
cases. Use ordered steps for workflows where order matters. Use the
[starter template](assets/skill-template.md) when scaffolding; omit sections that
add no value.

Include representative natural-language and explicit-invocation examples when
applicable. Match invocation syntax to the host; do not assume `/name` works in all
providers. Exact headings, example labels, and progress-marker syntax are style
choices. Give brief progress updates during sustained work without narrating every
command.

Follow the target repository's skill-version policy. When none exists, use a quoted
stable SemVer string at `metadata.version`: preserve imported version history, or
start a new stable skill at `1.0.0`. Under that default, bump patch for compatible
corrections, minor for added capabilities, and major for incompatible
workflow/interface changes.
Apply the repository's version-impact policy and run its version guard, if present,
against the actual comparison base, including stacked PR parents. Do not assume every
repository versions tests or documentation identically. Prefer a single-line
description of at most 500 characters unless the target repository specifies another
budget. Read [provider notes](references/provider-notes.md) before adding
provider-specific fields or making compatibility claims.

Prefer instructions for reasoning workflows. Add executable helpers only when
repeatability, parsing, filesystem behavior, or deterministic checks justify code.
Follow the repository's language, dependencies, test placement, and build conventions;
do not introduce a new toolchain merely to author a skill. Exclude implementation-only
tests from installed payloads. Resolve installed resources
from the loaded skill location, with external prerequisites explicitly identified.

### Step 4: Verify the intended behavior

Use the [review checklist](references/review-checklist.md) for the changed surface.
Check metadata and links, then exercise representative behavior appropriate to the
change. Treat static validity, source review, runtime tests, provider discovery,
and live execution as separate evidence.

For distributed changes, run the repository's generation and freshness checks. Use
a temporary destination when verifying a changed installation boundary. For prompt-only
changes, check metadata and links and review representative requests; do not add an
evaluation framework or redundant tests merely to prove prose was packaged. Do not
execute production actions or replace active installations merely to test a skill.

Follow the repository's branch and review conventions. Keep independent changes
separate and place dependent changes in their owning layer when using a stack.
Include relevant documentation and version changes. Report the authored
path, behavior changed, checks performed, and any unverified outcome. Publish or
merge only within the current authorization.

## Examples

- Codex: `$author-skill review src/skills/bookmark-sync`
- Claude Code: `/author-skill create release-notes`
- Natural language: “Revise this skill so API details load only for live requests.”
- Natural language: “Review this skill's delegation fallback without editing it.”

## Provenance

Originally adapted from `create-agnostic-skill` 1.4.1 as authoring guidance in
`tkstang/personal-skills`. Promoted from its `author-skill` 1.2.1 into
`tkstang/skills` as a repository-adaptive standalone skill. This repository owns the
maintained public adaptation; it does not replace the upstream creation skill.
