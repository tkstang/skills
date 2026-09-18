# Session schema evidence — 2026-09-18

Structure-only evidence about the native session transcript formats written by
Codex CLI, Claude Code, and Cursor, gathered from one developer machine on 2026-09-18
for the `session-fidelity` project (backlog item "Session fidelity: opt-in
--include-activity for observer and exporter", BL-260916-session-fidelity-opt).

This is a dated research snapshot. It is read-only history: do not update it when
clients change. Re-run the inventory and add a new dated snapshot instead. The
maintained reference lives in the docs site under
`documentation/docs/engineering/architecture/session-schemas/`.

## Contents

| Path | What it is |
| ---- | ---------- |
| `inventory.mjs` | Dependency-free structure-only inventory script (Node >= 22). |
| `reviewed-vocabulary.json` | Human-reviewed key names and enum values the script may emit. |
| `inventory.canary.test.mjs` | Synthetic privacy canaries (`node --test inventory.canary.test.mjs`). |
| `codex/findings.md`, `codex/inventory.json` | Codex rollout JSONL. |
| `claude-code/findings.md`, `claude-code/inventory.json` | Claude Code project JSONL and sidecar layout. |
| `cursor/findings.md`, `cursor/inventory.json` | Cursor agent-transcript JSONL and sidecar layout. |

## How the evidence was produced

1. Three bounded recon workers (one per runtime) sampled roughly 330–350 transcript
   files each, stratified by client version where the transcript records one
   (Codex, Claude Code) and by file mtime where it does not (Cursor). Each wrote a
   findings report from structural queries only.
2. The root reviewer independently re-checked the load-bearing claims on separate
   samples. Claims that were re-checked are marked **[verified]** in the findings.
3. `inventory.json` files were regenerated at the end from a simple reproducible
   sample (the 300 most recently modified transcript files per runtime) with the
   final `inventory.mjs` and **no post-processing**. Counts quoted in `findings.md`
   come from the workers' samples and will not equal the counts in `inventory.json`.

Reproduce an inventory (macOS `stat` syntax):

```bash
find ~/.codex/sessions -name '*.jsonl' -print0 \
  | xargs -0 stat -f '%m %N' | sort -rn | head -300 | cut -d' ' -f2- \
  | node inventory.mjs --allowlist reviewed-vocabulary.json > codex/inventory.json
```

The script refuses to run without a mode. `--allowlist <file>` produces a committable
report. `--discover` produces an **unreviewed, machine-local** report used only to find
new vocabulary; review new keys and values by hand, add the provider-defined ones to
`reviewed-vocabulary.json`, then re-run with `--allowlist`. Never commit a discover
report.

Use `~/.claude/projects` for Claude Code, and
`find ~/.cursor/projects -path '*agent-transcripts*' -name '*.jsonl'` for Cursor.

## Privacy rules

Transcripts contain private content; this directory is tracked. The rules, enforced
by `inventory.mjs` and applied by hand to the findings:

- No message text, commands, file contents, tool output, user paths, or session ids.
  The only ids that appear are the two Codex thread ids already recorded in the
  project's own artifacts.
- Field values appear only at an explicit allowlist of schema paths (record types,
  roles, statuses, built-in tool names, client versions, model ids) **and** only when
  the value is in the human-reviewed vocabulary. Anything else is emitted as
  `<unreviewed-value>`. MCP-style tool names are generalised to `mcp__<server>__<tool>`.
- Object keys appear only when they are in the human-reviewed vocabulary. Other
  identifier-shaped keys become `<unreviewed-key>`; non-identifier keys become
  `<dynamic-key>`; keys seen in fewer than three files become `<rare-key>`. None of
  those subtrees is described. Frequency alone is never treated as evidence that a key
  is safe: a private name can repeat across sessions.
- Data-keyed maps (tool schemas, file-history maps, per-agent state, per-model usage,
  structured tool content) and third-party/MCP tool arguments and results are counted,
  not described.
- JSON-encoded strings are decoded only for first-party tool argument carriers, never
  for tool output.
- Depth limits (12 levels overall, 3 levels inside a decoded argument carrier) stop
  description of deeper structure. Every such omission is counted in
  `diagnostics.depthTruncated` / `diagnostics.jsonDepthTruncated`, so a report never
  presents a truncated shape as complete. The Codex snapshot has 64 argument-carrier
  truncations; the other two have none.
- `inventory.canary.test.mjs` plants synthetic private values, keys, discriminators,
  tool names, paths, and U+2028/U+2029 separators, and asserts none reach a report.

## Corrections made during review

- **"Multi-line records" is a reader artifact, not a format property.** One worker
  reported ~290 Claude Code lines that fail `JSON.parse`. The cause is Node's
  `readline`, which also breaks lines on U+2028/U+2029; those code points occur
  unescaped inside transcript strings. Splitting on the LF byte yields zero malformed
  lines. Readers must split on `\n` bytes only.
- An early statement in the collaboration that no Claude Code sidecar directories
  exist was wrong (a shell glob error). `tool-results/` and `subagents/` directories
  are present and documented in `claude-code/findings.md`.
- Workers' original inventories depended on ad-hoc post-processing; they were
  discarded and regenerated reproducibly.

## Relationship to the 2026-09-10 research packet

`../session-fidelity-2026-09-10/schemas/native/` was derived from third-party parser
source, not from recorded sessions. Each `findings.md` here lists where that packet's
schema for the runtime is contradicted or silent. Prefer this snapshot and the docs
site pages for native shapes; the packet remains valid for its design reasoning.
