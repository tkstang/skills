# Scoped tool access for a one-shot peer

Read this before any `phone-a-friend` turn that expects the peer to use tools.
An advice-only turn can use the short invocation in `SKILL.md` with compact
context already in the prompt. Do not grant tools just because they exist.

## Decide the scope before invoking

1. List the exact files the peer must read, the exact files it may edit or
   create, whether WebSearch is needed, and the domains it may WebFetch. Get
   user approval before sending private context or allowing external writes.
2. Prefer an empty scratch `--cwd` for a tool-using research turn. Resolve file
   paths to their canonical absolute spelling, including `/private/tmp` on
   macOS, and put only approved material in the prompt. Read targets must
   already be regular files. An Edit target may be an existing regular file
   or a new filename in an existing canonical directory; directory grants,
   symlinks, and wildcard paths are rejected. An exact file grant is not a
   directory grant, but Claude may still read files in its working
   directory under its ordinary permission rules. Do not place unrelated
   private files in that scratch directory.
3. Preflight only the selected provider. `ready` means the CLI can run; it
   does **not** verify Read, WebSearch, WebFetch, Write, a particular path,
   workspace trust, or network access.
4. Invoke once with only the grants the task needs. The flags below are
   Claude-only and rejected for other providers. Repeat file/domain flags
   for multiple approved targets. Do not use `--permission-mode read-only`
   together with these grants; the wrapper uses Claude's `dontAsk` mode.

```bash
node <skill-dir>/scripts/consensus.mjs run --provider claude \
  --schema <skill-dir>/schemas/advisory.schema.json \
  --prompt-file "/absolute/path/to/question.md" \
  --cwd "/absolute/path/to/empty-scratch" \
  --allow-read "/absolute/path/to/approved-brief.md" \
  --allow-web-search \
  --allow-web-fetch-domain example.org \
  --json --max-depth 1 --max-attempts 1
```

For a separately authorized output file, add
`--allow-edit "/absolute/path/to/answer.md"`. Do not include this flag for
read-only research. The wrapper passes Claude exact `Read(//...)` and
`Edit(//...)` rules plus `WebSearch` and domain-scoped `WebFetch` rules. It
limits available built-in tools to those named, sets `dontAsk` and
`--permission-prompts none`, and ignores ambient MCP servers. It does not use
`bypassPermissions`, make a global settings change, or create broad
`--add-dir` access. Unapproved calls normally deny under `dontAsk`; however,
pre-existing user/project allow rules can still grant a selected tool more
broadly, while managed policies and higher-priority deny/ask rules can still
block a requested grant. Inspect ambient settings for sensitive runs and do
not silently retry with broader grants. These controls are Claude Code
permission rules, **not** an OS sandbox or a guarantee that unrelated cwd
files are inaccessible.

The tool-using profile intentionally excludes Bash. The wrapper therefore
does not ask the peer to run `consensus submit` for such a turn; final-message
JSON matching the advisory schema is the supported output path. Avoid relying
on shell heredocs or implicit Bash permissions for submission.

## Check the result, not just the envelope

Read `ok`, `code`, `attempts.terminal_reason`, `json`, and
`diagnostics.permission_denials`. The latter contains only a count and tool
names; raw provider stdout can contain private paths and prompt material, so
keep the full receipt private. A schema-valid response saying “blocked” still
has `ok: true` and `terminal_reason: success`: that is a successful exchange,
not proof that the requested research was done. Verify the required reads,
web evidence, and output file before using the advisory. An optional denied
call need not invalidate a complete answer; decide from the requested scope
and evidence. If required access was denied, report the missing evidence and
ask for a narrower correction or user direction instead of inventing findings
or escalating permissions automatically.

Exact rules can fail if a requested path and its resolved filesystem path use
different spellings or a higher-priority policy denies it. Inspect the denied
tool name and the private local receipt, then correct only the affected path
with user authorization. The CLI's syntactic validation does not prove that
the named file exists, that a domain will respond, or that Claude honors a
particular grant in a live session.

Claude permission semantics: [CLI flags](https://code.claude.com/docs/en/cli-reference)
and [permission rules and precedence](https://code.claude.com/docs/en/permissions).
