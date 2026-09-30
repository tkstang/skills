# Format and provider notes

Consult this before adding provider extensions, changing invocation behavior, or
claiming cross-provider support. These notes were checked against the linked
primary documentation on 2026-09-07. Recheck affected claims when behavior matters;
this is not an exhaustive provider compatibility matrix.

## Portable format and authoring defaults

The [Agent Skills specification](https://agentskills.io/specification) requires
`SKILL.md`, a directory-matching name of at most 64 characters, and a non-empty
description of at most 1,024 characters. Use lowercase letters, digits, and single
hyphens; avoid leading, trailing, or consecutive hyphens.

The specification permits a string-to-string `metadata` mapping and demonstrates
`metadata.version`. This skill recommends quoted stable SemVer there rather than
root `version` or `meta.version`. SemVer and a tighter single-line, 500-character
description budget are authoring defaults, not universal provider requirements.
Follow the target repository's policy. The portable root `license` field may describe the skill's
license or point to a bundled license file.

The main-body guidance is roughly 5,000 tokens and fewer than 500 lines, not 5,000
words. Supporting directories are optional; the specification does not prescribe
our heading names, source-code language, build system, or canonical authoring root.

## Invocation and permission behavior

[Codex skills documentation](https://learn.chatgpt.com/docs/build-skills) describes
explicit `$skill` mentions in CLI/IDE and optional `agents/openai.yaml` for metadata,
dependencies, and `policy.allow_implicit_invocation`. Use that file only when the
skill needs its supported behavior. A YAML policy file does not grant tool access.

[Claude Code skills documentation](https://code.claude.com/docs/en/skills) describes
`/skill-name`, `argument-hint`, `disable-model-invocation`, and `user-invocable`. It
distinguishes `allowed-tools` permission grants from `disallowed-tools` restrictions.
The Agent Skills specification marks `allowed-tools` experimental and uses
space-separated values. Do not describe it as a portable sandbox or assume tools
omitted from it are unavailable.

Choose manual-only versus implicit invocation based on the workflow. Provider flags
can supplement instructions; they do not replace the user's authorization or the
host's permission controls. Use a conservative fallback if an extension is ignored.

Static validation of invocation fields does not prove a provider honors them.
Do not claim that every provider
safely ignores every unknown field. Verify the particular extension and target version
when correctness depends on it. Check
[Cursor](https://cursor.com/docs/context/skills) and
[Gemini CLI](https://geminicli.com/docs/cli/skills/) documentation before asserting
their current invocation or extension behavior; neither was exhaustively tested here.

## Distribution boundary

A portable installed skill must contain its invocation-time references or clearly
declare external dependencies. Root paths such as `.agents/docs/` cannot stand in
for bundled resources in a distributed skill. Follow the repository's actual build
when sharing material; a symlink and `cp -RL` are one implementation, not a universal
requirement. Verify what the target repository's packager actually ships.

Project-local tooling may link to repository documentation because its repository
is an explicit prerequisite. A distributed skill must bundle its required guidance
or resolve the target repository's own conventions without assuming a fixed layout.
